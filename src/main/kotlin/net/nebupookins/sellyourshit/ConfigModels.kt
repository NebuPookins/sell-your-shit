package net.nebupookins.sellyourshit

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

enum class FieldType {
    @SerialName("text") TEXT,
    @SerialName("number") NUMBER,
    @SerialName("enum") ENUM,
    @SerialName("multiline") MULTILINE
}

@Serializable
data class FieldSpec(
    val name: String,
    val label: String,
    val type: FieldType,
    @SerialName("max-length") val maxLength: Int? = null,
    val values: List<String>? = null
)

@Serializable
data class PlatformProfile(
    val id: String,
    val label: String,
    val fields: List<FieldSpec>,
    val listingDurationDays: Int? = null
)

@Serializable
data class DecayConfig(
    @SerialName("check-interval-days") val checkIntervalDays: Int,
    @SerialName("drop-percent") val dropPercent: Double
)

@Serializable
data class AppConfig(
    val port: Int,
    val decay: DecayConfig
)

@Serializable
data class SecretsConfig(
    @SerialName("anthropic-api-key") val anthropicApiKey: String
)
