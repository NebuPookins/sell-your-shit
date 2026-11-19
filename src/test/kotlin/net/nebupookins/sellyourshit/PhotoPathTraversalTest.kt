package net.nebupookins.sellyourshit

import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import java.io.File
import java.nio.file.Files
import java.time.Instant
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class PhotoPathTraversalTest {

    private val settings = AppSettings(
        config = AppConfig(DecayConfig(checkIntervalDays = 14, dropPercent = 0.1)),
        platforms = emptyList()
    )

    private fun setUp(): Pair<File, Item> {
        val dataDir = Files.createTempDirectory("sell-your-shit-traversal").toFile()
        dataDir.deleteOnExit()
        val now = Instant.now().toString()
        val item = Item(id = "item-1", rawDescription = "Lamp", createdAt = now, updatedAt = now)
        val repo = ItemRepository(dataDir)
        repo.saveItem(item)
        // A real photo ensures photos/{id}/original and photos/{id}/resized exist,
        // so that ".." segments beneath them resolve on the filesystem.
        val withPhoto = repo.addPhoto(item.id, "not-really-an-image".toByteArray())!!
        File(dataDir, "secret.txt").writeText("TOP SECRET")
        return dataDir to withPhoto
    }

    @Test
    fun `photo route does not serve files outside the photos directory`() {
        val (dataDir, item) = setUp()
        testApplication {
            application { module(settings, "test-key", dataDir) }
            val viaEncodedFilename = client.get("/photos/${item.id}/..%2F..%2F..%2Fsecret.txt")
            assertEquals(HttpStatusCode.NotFound, viaEncodedFilename.status)
            val viaEncodedItemId = client.get("/photos/..%2F..%2F..%2F/secret.txt")
            assertEquals(HttpStatusCode.NotFound, viaEncodedItemId.status)
            assertTrue("TOP SECRET" !in viaEncodedFilename.bodyAsText() + viaEncodedItemId.bodyAsText())
        }
    }

    @Test
    fun `deleting a photo does not delete files outside the item's photos`() {
        val (dataDir, item) = setUp()
        testApplication {
            application { module(settings, "test-key", dataDir) }
            client.delete("/api/v1/items/${item.id}/photos/..%2F..%2F..%2Fsecret.txt")
            client.delete("/api/v1/items/${item.id}/photos/..%2F..%2F..%2Fitems%2F${item.id}.yaml")
        }
        assertTrue(File(dataDir, "secret.txt").exists())
        assertTrue(File(dataDir, "items/${item.id}.yaml").exists())
    }

    @Test
    fun `an item's own photos can still be served and deleted`() {
        val (dataDir, item) = setUp()
        val photo = item.photos.single()
        testApplication {
            application { module(settings, "test-key", dataDir) }
            assertEquals(HttpStatusCode.OK, client.get("/photos/${item.id}/$photo").status)
            assertEquals(HttpStatusCode.OK, client.delete("/api/v1/items/${item.id}/photos/$photo").status)
            assertEquals(HttpStatusCode.NotFound, client.get("/photos/${item.id}/$photo").status)
        }
        assertTrue(!File(dataDir, "photos/${item.id}/original/$photo").exists())
    }

    @Test
    fun `item lookup rejects ids that escape the items directory`() {
        val (dataDir, item) = setUp()
        File(dataDir, "outside.yaml").writeText(File(dataDir, "items/${item.id}.yaml").readText())
        testApplication {
            application { module(settings, "test-key", dataDir) }
            assertEquals(HttpStatusCode.NotFound, client.get("/api/v1/items/..%2Foutside").status)
        }
    }
}
