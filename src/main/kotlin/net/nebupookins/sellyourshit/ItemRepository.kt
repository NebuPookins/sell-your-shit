package net.nebupookins.sellyourshit

import com.charleskorn.kaml.Yaml
import org.slf4j.LoggerFactory
import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit
import java.util.UUID
import javax.imageio.IIOImage
import javax.imageio.ImageIO
import javax.imageio.ImageWriteParam

class ItemRepository(private val dataDir: File) {
    private val logger = LoggerFactory.getLogger(ItemRepository::class.java)
    private val itemsDir = File(dataDir, "items").also { it.mkdirs() }
    private val photosDir = File(dataDir, "photos")

    fun createItem(rawDescription: String): Item {
        val now = Instant.now().toString()
        val item = Item(
            id = UUID.randomUUID().toString(),
            rawDescription = rawDescription,
            createdAt = now,
            updatedAt = now
        )
        saveItem(item)
        return item
    }

    fun listItems(): List<Item> {
        return (itemsDir.listFiles { f -> f.extension == "yaml" } ?: emptyArray())
            .mapNotNull { file ->
                try {
                    Yaml.default.decodeFromString(Item.serializer(), file.readText())
                } catch (e: Exception) {
                    logger.warn("Failed to read item file ${file.name}: ${e.message}")
                    null
                }
            }
            .sortedByDescending { it.createdAt }
    }

    fun getItem(id: String): Item? {
        val file = File(itemsDir, "$id.yaml")
        if (!file.exists()) return null
        return try {
            Yaml.default.decodeFromString(Item.serializer(), file.readText())
        } catch (e: Exception) {
            logger.warn("Failed to read item $id: ${e.message}")
            null
        }
    }

    fun updateItem(id: String, rawDescription: String? = null): Item? {
        val item = getItem(id) ?: return null
        val updated = item.copy(
            rawDescription = rawDescription ?: item.rawDescription,
            updatedAt = Instant.now().toString()
        )
        saveItem(updated)
        return updated
    }

    fun archiveItem(id: String): Item? {
        val item = getItem(id) ?: return null
        if (item.archivedAt != null) return item
        val archived = item.copy(
            archivedAt = Instant.now().toString(),
            updatedAt = Instant.now().toString()
        )
        saveItem(archived)
        return archived
    }

    fun addPhoto(itemId: String, bytes: ByteArray): Item? {
        val item = getItem(itemId) ?: return null
        val filename = "${UUID.randomUUID()}.jpg"
        File(photosDir, "$itemId/original").also { it.mkdirs() }
        File(photosDir, "$itemId/resized").also { it.mkdirs() }
        File(photosDir, "$itemId/original/$filename").writeBytes(bytes)
        File(photosDir, "$itemId/resized/$filename").writeBytes(processImage(bytes))
        val updated = item.copy(
            photos = item.photos + filename,
            updatedAt = Instant.now().toString()
        )
        saveItem(updated)
        return updated
    }

    fun deletePhoto(itemId: String, filename: String): Item? {
        val item = getItem(itemId) ?: return null
        File(photosDir, "$itemId/original/$filename").delete()
        File(photosDir, "$itemId/resized/$filename").delete()
        val updated = item.copy(
            photos = item.photos.filter { it != filename },
            updatedAt = Instant.now().toString()
        )
        saveItem(updated)
        return updated
    }

    fun reorderPhotos(itemId: String, order: List<String>): Item? {
        val item = getItem(itemId) ?: return null
        val existing = item.photos.toSet()
        val updated = item.copy(
            photos = order.filter { it in existing },
            updatedAt = Instant.now().toString()
        )
        saveItem(updated)
        return updated
    }

    fun addGeneratedListing(
        itemId: String,
        platformId: String,
        fields: Map<String, String>,
        askingPrice: Double?
    ): Item? {
        val item = getItem(itemId) ?: return null
        val now = Instant.now().toString()
        val listing = Listing(
            id = UUID.randomUUID().toString(),
            platformId = platformId,
            status = ListingStatus.DRAFT,
            generatedFields = fields,
            askingPrice = askingPrice,
            createdAt = now,
            updatedAt = now
        )
        val existingIdx = item.listings.indexOfFirst { it.platformId == platformId }
        val updatedListings = if (existingIdx >= 0) {
            item.listings.toMutableList().also { it[existingIdx] = listing }
        } else {
            item.listings + listing
        }
        val updated = item.copy(listings = updatedListings, updatedAt = now)
        saveItem(updated)
        return updated
    }

    fun updateListing(
        listingId: String,
        fields: Map<String, String>,
        askingPrice: Double?,
        notes: String,
        postedAt: String? = null,
        expiresAt: String? = null,
        externalId: String? = null
    ): Listing? {
        val items = listItems()
        for (item in items) {
            val idx = item.listings.indexOfFirst { it.id == listingId }
            if (idx >= 0) {
                val now = Instant.now().toString()
                val existing = item.listings[idx]
                val updated = existing.copy(
                    generatedFields = fields,
                    askingPrice = askingPrice,
                    notes = notes,
                    postedAt = postedAt ?: existing.postedAt,
                    expiresAt = expiresAt ?: existing.expiresAt,
                    externalId = externalId ?: existing.externalId,
                    updatedAt = now
                )
                val updatedListings = item.listings.toMutableList().also { it[idx] = updated }
                saveItem(item.copy(listings = updatedListings, updatedAt = now))
                return updated
            }
        }
        return null
    }

    fun applyPriceDrop(listingId: String, newPrice: Double): Listing? {
        val items = listItems()
        for (item in items) {
            val idx = item.listings.indexOfFirst { it.id == listingId }
            if (idx >= 0) {
                val now = Instant.now().toString()
                val existing = item.listings[idx]
                val oldPrice = existing.askingPrice
                val updated = existing.copy(
                    askingPrice = newPrice,
                    priceHistory = existing.priceHistory + PriceHistoryEntry(
                        price = oldPrice ?: newPrice,
                        reason = "decay",
                        date = now
                    ),
                    updatedAt = now
                )
                val updatedListings = item.listings.toMutableList().also { it[idx] = updated }
                saveItem(item.copy(listings = updatedListings, updatedAt = now))
                return updated
            }
        }
        return null
    }

    fun markListingStatus(listingId: String, status: ListingStatus): Listing? {
        val items = listItems()
        for (item in items) {
            val idx = item.listings.indexOfFirst { it.id == listingId }
            if (idx >= 0) {
                val now = Instant.now().toString()
                val updated = item.listings[idx].copy(
                    status = status,
                    updatedAt = now
                )
                val updatedListings = item.listings.toMutableList().also { it[idx] = updated }
                saveItem(item.copy(listings = updatedListings, updatedAt = now))
                return updated
            }
        }
        return null
    }

    fun renewListing(listingId: String, newPrice: Double?, dropPercent: Double, newExpiresAt: String? = null): Listing? {
        val items = listItems()
        for (item in items) {
            val idx = item.listings.indexOfFirst { it.id == listingId }
            if (idx >= 0) {
                val now = Instant.now().toString()
                val existing = item.listings[idx]
                val oldPrice = existing.askingPrice
                val effectiveNewPrice = newPrice ?: oldPrice?.let {
                    Math.round(it * (1.0 - dropPercent) * 100.0) / 100.0
                } ?: return null

                val updated = existing.copy(
                    askingPrice = effectiveNewPrice,
                    expiresAt = newExpiresAt ?: existing.expiresAt,
                    priceHistory = existing.priceHistory + PriceHistoryEntry(
                        price = oldPrice ?: effectiveNewPrice,
                        reason = "decay",
                        date = now
                    ),
                    updatedAt = now
                )
                val updatedListings = item.listings.toMutableList().also { it[idx] = updated }
                saveItem(item.copy(listings = updatedListings, updatedAt = now))
                return updated
            }
        }
        return null
    }

    fun markListingPosted(listingId: String, postedAt: String, expiresAt: String, externalId: String?): Listing? {
        val items = listItems()
        for (item in items) {
            val idx = item.listings.indexOfFirst { it.id == listingId }
            if (idx >= 0) {
                val now = Instant.now().toString()
                val existing = item.listings[idx]
                val priceEntry = existing.askingPrice?.let {
                    PriceHistoryEntry(price = it, reason = "initial", date = postedAt)
                }
                val updated = existing.copy(
                    status = ListingStatus.ACTIVE,
                    postedAt = postedAt,
                    expiresAt = expiresAt,
                    externalId = externalId,
                    priceHistory = if (priceEntry != null) existing.priceHistory + priceEntry else existing.priceHistory,
                    updatedAt = now
                )
                val updatedListings = item.listings.toMutableList().also { it[idx] = updated }
                saveItem(item.copy(listings = updatedListings, updatedAt = now))
                return updated
            }
        }
        return null
    }

    private fun parseInstant(s: String): Instant? =
        runCatching { Instant.parse(s) }.getOrNull()
            ?: runCatching { LocalDate.parse(s).atStartOfDay(ZoneOffset.UTC).toInstant() }.getOrNull()

    fun getDashboard(decayConfig: DecayConfig): DashboardResponse {
        val now = Instant.now()

        val renewalQueue = mutableListOf<DashboardEntry>()
        val activeListings = mutableListOf<DashboardEntry>()
        val closedItems = mutableListOf<Item>()

        for (item in listItems()) {
            if (item.archivedAt != null) continue

            val nonDraftListings = item.listings.filter { it.status != ListingStatus.DRAFT }
            if (nonDraftListings.isNotEmpty() && nonDraftListings.all {
                it.status == ListingStatus.SOLD || it.status == ListingStatus.CANCELLED
            }) {
                closedItems.add(item)
                continue
            }

            for (listing in item.listings) {
                if (listing.status != ListingStatus.ACTIVE) continue

                val postedAtInstant = listing.postedAt?.let { parseInstant(it) }
                val expiresAtInstant = listing.expiresAt?.let { parseInstant(it) }
                val daysActive = postedAtInstant?.let { ChronoUnit.DAYS.between(it, now).toInt() }

                val isExpired = expiresAtInstant != null && expiresAtInstant.isBefore(now)
                val lastDecayDate = listing.priceHistory
                    .lastOrNull { it.reason == "decay" }?.date
                    ?.let { parseInstant(it) }
                val decayReference = lastDecayDate ?: postedAtInstant
                val isDecayDue = decayReference != null && ChronoUnit.DAYS.between(decayReference, now) >= decayConfig.checkIntervalDays

                val reasons = buildList {
                    if (isExpired) add("expired")
                    if (isDecayDue) add("decay-due")
                }

                val suggestedDropPrice = if (isDecayDue && listing.askingPrice != null) {
                    (listing.askingPrice * (1.0 - decayConfig.dropPercent)).let { Math.round(it * 100.0) / 100.0 }
                } else null

                val entry = DashboardEntry(
                    itemId = item.id,
                    itemDescription = item.rawDescription,
                    itemThumbnail = item.photos.firstOrNull(),
                    listingId = listing.id,
                    platformId = listing.platformId,
                    title = listing.generatedFields["title"] ?: item.rawDescription.take(60),
                    askingPrice = listing.askingPrice,
                    postedAt = listing.postedAt,
                    expiresAt = listing.expiresAt,
                    daysActive = daysActive,
                    renewalReasons = reasons,
                    externalId = listing.externalId,
                    suggestedDropPrice = suggestedDropPrice,
                    dropPercent = if (isDecayDue) decayConfig.dropPercent else null
                )

                activeListings.add(entry)
                if (reasons.isNotEmpty()) renewalQueue.add(entry)
            }
        }

        return DashboardResponse(
            renewalQueue = renewalQueue,
            activeListings = activeListings.sortedWith(compareBy(nullsLast()) { it.expiresAt }),
            closedItems = closedItems
        )
    }

    fun getResizedPhotoFile(itemId: String, filename: String): File =
        File(photosDir, "$itemId/resized/$filename")

    fun saveItem(item: Item) {
        val yaml = Yaml.default.encodeToString(Item.serializer(), item)
        val file = File(itemsDir, "${item.id}.yaml")
        val tmp = File(itemsDir, "${item.id}.tmp.yaml")
        tmp.writeText(yaml)
        tmp.renameTo(file)
    }

    private fun processImage(bytes: ByteArray, maxDim: Int = 1024, quality: Float = 0.85f): ByteArray {
        val orig = ImageIO.read(bytes.inputStream()) ?: return bytes
        val w = orig.width
        val h = orig.height
        val (newW, newH) = if (w <= maxDim && h <= maxDim) {
            w to h
        } else {
            val ratio = minOf(maxDim.toDouble() / w, maxDim.toDouble() / h)
            (w * ratio).toInt() to (h * ratio).toInt()
        }
        val output = BufferedImage(newW, newH, BufferedImage.TYPE_INT_RGB)
        val g = output.createGraphics()
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC)
        g.drawImage(orig, 0, 0, newW, newH, null)
        g.dispose()
        val bos = ByteArrayOutputStream()
        val writer = ImageIO.getImageWritersByFormatName("jpeg").next()
        val ios = ImageIO.createImageOutputStream(bos)
        writer.output = ios
        val param = writer.defaultWriteParam
        param.compressionMode = ImageWriteParam.MODE_EXPLICIT
        param.compressionQuality = quality
        writer.write(null, IIOImage(output, null, null), param)
        writer.dispose()
        ios.close()
        return bos.toByteArray()
    }
}
