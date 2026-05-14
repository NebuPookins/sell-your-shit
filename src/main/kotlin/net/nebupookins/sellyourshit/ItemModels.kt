package net.nebupookins.sellyourshit

import kotlinx.serialization.Serializable

@Serializable
enum class ListingStatus { DRAFT, ACTIVE, SOLD, CANCELLED }

@Serializable
data class PriceHistoryEntry(
    val price: Double,
    val reason: String,
    val date: String
)

@Serializable
data class Listing(
    val id: String,
    val platformId: String,
    val status: ListingStatus = ListingStatus.DRAFT,
    val generatedFields: Map<String, String> = emptyMap(),
    val askingPrice: Double? = null,
    val notes: String = "",
    val createdAt: String,
    val updatedAt: String,
    val postedAt: String? = null,
    val expiresAt: String? = null,
    val externalId: String? = null,
    val priceHistory: List<PriceHistoryEntry> = emptyList()
)

@Serializable
data class Item(
    val id: String,
    val rawDescription: String,
    val createdAt: String,
    val updatedAt: String,
    val archivedAt: String? = null,
    val listings: List<Listing> = emptyList(),
    val photos: List<String> = emptyList()
)

@Serializable
data class CreateItemRequest(
    val rawDescription: String
)

@Serializable
data class PatchItemRequest(
    val rawDescription: String? = null
)

@Serializable
data class PhotoOrderRequest(val order: List<String>)

@Serializable
data class GenerateRequest(val platforms: List<String>)

@Serializable
data class PatchListingRequest(
    val generatedFields: Map<String, String>,
    val askingPrice: Double? = null,
    val notes: String = "",
    val postedAt: String? = null,
    val expiresAt: String? = null,
    val externalId: String? = null
)

@Serializable
data class MarkPostedRequest(
    val postedAt: String,
    val expiresAt: String,
    val externalId: String? = null
)

@Serializable
data class DashboardEntry(
    val itemId: String,
    val itemDescription: String,
    val itemThumbnail: String?,
    val listingId: String,
    val platformId: String,
    val title: String?,
    val askingPrice: Double?,
    val postedAt: String?,
    val expiresAt: String?,
    val daysActive: Int?,
    val renewalReasons: List<String> = emptyList(),
    val externalId: String? = null,
    val suggestedDropPrice: Double? = null,
    val dropPercent: Double? = null
)

@Serializable
data class ApplyPriceDropRequest(
    val newPrice: Double
)

@Serializable
data class RenewRequest(
    val newPrice: Double? = null,
    val expiresAt: String? = null
)

@Serializable
data class MarkListingStatusRequest(
    val status: ListingStatus
)

@Serializable
data class DashboardResponse(
    val renewalQueue: List<DashboardEntry>,
    val activeListings: List<DashboardEntry>,
    val closedItems: List<Item>,
    val needsAction: List<DashboardEntry> = emptyList()
)
