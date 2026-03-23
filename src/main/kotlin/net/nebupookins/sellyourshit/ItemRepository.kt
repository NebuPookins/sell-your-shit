package net.nebupookins.sellyourshit

import com.charleskorn.kaml.Yaml
import org.slf4j.LoggerFactory
import java.io.File
import java.time.Instant
import java.util.UUID

class ItemRepository(dataDir: File) {
    private val logger = LoggerFactory.getLogger(ItemRepository::class.java)
    private val itemsDir = File(dataDir, "items").also { it.mkdirs() }

    fun createItem(rawDescription: String, minimumPrice: Double): Item {
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

    fun saveItem(item: Item) {
        val yaml = Yaml.default.encodeToString(Item.serializer(), item)
        val file = File(itemsDir, "${item.id}.yaml")
        val tmp = File(itemsDir, "${item.id}.tmp.yaml")
        tmp.writeText(yaml)
        tmp.renameTo(file)
    }
}
