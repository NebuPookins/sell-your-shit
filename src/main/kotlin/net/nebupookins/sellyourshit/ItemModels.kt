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
    val minimumPrice: Double,
    val createdAt: String,
    val updatedAt: String,
    val archivedAt: String? = null,
    val listings: List<Listing> = emptyList(),
    val photos: List<String> = emptyList()
)

@Serializable
data class CreateItemRequest(
    val rawDescription: String,
    val minimumPrice: Double
)

@Serializable
data class PatchItemRequest(
    val rawDescription: String? = null,
    val minimumPrice: Double? = null
)

@Serializable
data class PhotoOrderRequest(val order: List<String>)
