package net.nebupookins.sellyourshit

import com.charleskorn.kaml.Yaml
import org.slf4j.LoggerFactory
import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.io.File
import java.time.Instant
import java.util.UUID
import javax.imageio.IIOImage
import javax.imageio.ImageIO
import javax.imageio.ImageWriteParam

class ItemRepository(private val dataDir: File) {
    private val logger = LoggerFactory.getLogger(ItemRepository::class.java)
    private val itemsDir = File(dataDir, "items").also { it.mkdirs() }
    private val photosDir = File(dataDir, "photos")

    fun createItem(rawDescription: String, minimumPrice: Double?): Item {
        val now = Instant.now().toString()
        val item = Item(
            id = UUID.randomUUID().toString(),
            rawDescription = rawDescription,
            minimumPrice = minimumPrice,
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

    fun updateItem(id: String, rawDescription: String? = null, minimumPrice: Double? = null): Item? {
        val item = getItem(id) ?: return null
        val updated = item.copy(
            rawDescription = rawDescription ?: item.rawDescription,
            minimumPrice = minimumPrice ?: item.minimumPrice,
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
