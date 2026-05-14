package net.nebupookins.sellyourshit

import com.charleskorn.kaml.Yaml
import kotlinx.serialization.encodeToString
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import java.io.File
import java.nio.file.Files
import java.time.Instant
import java.time.ZoneOffset

private val PAST = "2025-01-01T00:00:00Z"

class ItemRepositoryTest {

    private fun createTempRepo(vararg items: Item): ItemRepository {
        val tmpDir = Files.createTempDirectory("sell-your-shit-test").toFile()
        tmpDir.deleteOnExit()
        val itemsDir = File(tmpDir, "items").also { it.mkdirs() }
        for (item in items) {
            val yaml = Yaml.default.encodeToString(Item.serializer(), item)
            File(itemsDir, "${item.id}.yaml").writeText(yaml)
        }
        return ItemRepository(tmpDir)
    }

    @Test
    fun `renewal queue is empty when item has any sold listing`() {
        val now = Instant.now().toString()
        val item = Item(
            id = "test-1",
            rawDescription = "Test item",
            createdAt = now,
            updatedAt = now,
            listings = listOf(
                Listing(
                    id = "sold-1",
                    platformId = "kijiji",
                    status = ListingStatus.SOLD,
                    createdAt = now,
                    updatedAt = now,
                    postedAt = PAST,
                    expiresAt = PAST
                ),
                Listing(
                    id = "active-1",
                    platformId = "craigslist",
                    status = ListingStatus.ACTIVE,
                    createdAt = now,
                    updatedAt = now,
                    postedAt = PAST,
                    expiresAt = PAST
                )
            )
        )
        val repo = createTempRepo(item)
        val dashboard = repo.getDashboard(DecayConfig(checkIntervalDays = 14, dropPercent = 0.1))

        assertTrue(dashboard.renewalQueue.isEmpty(), "Should not suggest renewal when item has sold listings")
        assertEquals(1, dashboard.activeListings.size)
        assertEquals("active-1", dashboard.activeListings[0].listingId)
    }

    @Test
    fun `active listing goes to needsAction when item has sold listings`() {
        val now = Instant.now().toString()
        val item = Item(
            id = "test-2",
            rawDescription = "Test item",
            createdAt = now,
            updatedAt = now,
            listings = listOf(
                Listing(
                    id = "sold-1",
                    platformId = "kijiji",
                    status = ListingStatus.SOLD,
                    createdAt = now,
                    updatedAt = now
                ),
                Listing(
                    id = "active-1",
                    platformId = "craigslist",
                    status = ListingStatus.ACTIVE,
                    createdAt = now,
                    updatedAt = now,
                    postedAt = PAST,
                    expiresAt = PAST
                )
            )
        )
        val repo = createTempRepo(item)
        val dashboard = repo.getDashboard(DecayConfig(checkIntervalDays = 14, dropPercent = 0.1))

        assertEquals(1, dashboard.needsAction.size)
        assertEquals("active-1", dashboard.needsAction[0].listingId)
    }

    @Test
    fun `item with sold and draft listings appears in closed items`() {
        val now = Instant.now().toString()
        val item = Item(
            id = "test-3",
            rawDescription = "Test item",
            createdAt = now,
            updatedAt = now,
            listings = listOf(
                Listing(
                    id = "sold-1",
                    platformId = "kijiji",
                    status = ListingStatus.SOLD,
                    createdAt = now,
                    updatedAt = now
                ),
                Listing(
                    id = "draft-1",
                    platformId = "facebook",
                    status = ListingStatus.DRAFT,
                    createdAt = now,
                    updatedAt = now
                )
            )
        )
        val repo = createTempRepo(item)
        val dashboard = repo.getDashboard(DecayConfig(checkIntervalDays = 14, dropPercent = 0.1))

        // All non-DRAFT listings are SOLD, so the item is closed
        assertEquals(1, dashboard.closedItems.size)
        assertEquals("test-3", dashboard.closedItems[0].id)
        assertTrue(dashboard.needsAction.isEmpty(), "Draft only on sold item should not be needs-action")
    }

    @Test
    fun `no price drop suggestion when item has sold listing`() {
        val now = Instant.now().toString()
        val item = Item(
            id = "test-4",
            rawDescription = "Test item",
            createdAt = now,
            updatedAt = now,
            listings = listOf(
                Listing(
                    id = "sold-1",
                    platformId = "kijiji",
                    status = ListingStatus.SOLD,
                    createdAt = now,
                    updatedAt = now
                ),
                Listing(
                    id = "active-1",
                    platformId = "craigslist",
                    status = ListingStatus.ACTIVE,
                    createdAt = now,
                    updatedAt = now,
                    postedAt = PAST,
                    askingPrice = 100.0
                )
            )
        )
        val repo = createTempRepo(item)
        val dashboard = repo.getDashboard(DecayConfig(checkIntervalDays = 14, dropPercent = 0.1))

        assertEquals(1, dashboard.activeListings.size)
        assertNull(dashboard.activeListings[0].suggestedDropPrice, "Should not suggest price drop when item has sold listings")
        assertNull(dashboard.activeListings[0].dropPercent, "Should not suggest drop percent when item has sold listings")
        assertTrue(dashboard.activeListings[0].renewalReasons.isEmpty(), "Should not have renewal reasons when item has sold listings")
    }

    @Test
    fun `renewal queue works normally when no listings are sold`() {
        val now = Instant.now().toString()
        val item = Item(
            id = "test-5",
            rawDescription = "Test item",
            createdAt = now,
            updatedAt = now,
            listings = listOf(
                Listing(
                    id = "active-1",
                    platformId = "craigslist",
                    status = ListingStatus.ACTIVE,
                    createdAt = now,
                    updatedAt = now,
                    postedAt = PAST,
                    expiresAt = PAST,
                    askingPrice = 100.0
                )
            )
        )
        val repo = createTempRepo(item)
        val dashboard = repo.getDashboard(DecayConfig(checkIntervalDays = 14, dropPercent = 0.1))

        assertEquals(1, dashboard.renewalQueue.size, "Expired listing should appear in renewal queue")
        assertEquals("active-1", dashboard.renewalQueue[0].listingId)
    }

    @Test
    fun `date-only expiry respects timezone offset`() {
        val now = Instant.now().toString()
        val farPast = "2000-01-01"
        val farFuture = "3025-06-01"

        val futureItem = Item(
            id = "tz-future",
            rawDescription = "Future",
            createdAt = now,
            updatedAt = now,
            listings = listOf(
                Listing(
                    id = "future-1",
                    platformId = "test",
                    status = ListingStatus.ACTIVE,
                    createdAt = now,
                    updatedAt = now,
                    postedAt = PAST,
                    expiresAt = farFuture
                )
            )
        )
        val repo = createTempRepo(futureItem)

        // Far-future date is never expired regardless of offset
        var dashboard = repo.getDashboard(DecayConfig(14, 0.1), ZoneOffset.UTC)
        assertTrue(!dashboard.activeListings[0].renewalReasons.contains("expired"), "Future date should not be expired in UTC")

        dashboard = repo.getDashboard(DecayConfig(14, 0.1), ZoneOffset.ofHours(14))
        assertTrue(!dashboard.activeListings[0].renewalReasons.contains("expired"), "Future date should not be expired in +14")

        dashboard = repo.getDashboard(DecayConfig(14, 0.1), ZoneOffset.ofHours(-12))
        assertTrue(!dashboard.activeListings[0].renewalReasons.contains("expired"), "Future date should not be expired in -12")

        val pastItem = Item(
            id = "tz-past",
            rawDescription = "Past",
            createdAt = now,
            updatedAt = now,
            listings = listOf(
                Listing(
                    id = "past-1",
                    platformId = "test",
                    status = ListingStatus.ACTIVE,
                    createdAt = now,
                    updatedAt = now,
                    postedAt = PAST,
                    expiresAt = farPast
                )
            )
        )
        val repo2 = createTempRepo(pastItem)

        // Far-past date is always expired regardless of offset
        for (hours in listOf(0, 14, -12)) {
            dashboard = repo2.getDashboard(DecayConfig(14, 0.1), ZoneOffset.ofHours(hours))
            assertTrue(dashboard.activeListings[0].renewalReasons.contains("expired"),
                "Past date should be expired in offset $hours")
        }
    }

    @Test
    fun `decay suggestions work normally when item has no sold listings`() {
        val now = Instant.now().toString()
        val item = Item(
            id = "test-6",
            rawDescription = "Test item",
            createdAt = now,
            updatedAt = now,
            listings = listOf(
                Listing(
                    id = "active-1",
                    platformId = "craigslist",
                    status = ListingStatus.ACTIVE,
                    createdAt = now,
                    updatedAt = now,
                    postedAt = PAST,
                    askingPrice = 100.0
                )
            )
        )
        val repo = createTempRepo(item)
        val dropPercent = 0.15
        val dashboard = repo.getDashboard(DecayConfig(checkIntervalDays = 14, dropPercent = dropPercent))

        assertEquals(1, dashboard.activeListings.size)
        val entry = dashboard.activeListings[0]
        assertNotNull(entry.suggestedDropPrice, "Should suggest price drop when no sold listings")
        assertEquals(dropPercent, entry.dropPercent!!, 0.001)
        assertEquals(85.0, entry.suggestedDropPrice!!, 0.001)
    }
}
