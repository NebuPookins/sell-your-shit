package net.nebupookins.sellyourshit

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import org.slf4j.LoggerFactory
import java.io.File
import java.util.Base64

class ClaudeApiException(message: String) : Exception(message)
class ClaudeParseException(message: String, val rawResponse: String) : Exception(message)

data class GeneratedPlatformData(
    val fields: Map<String, String>,
    val uncertainFields: List<String>,
    val suggestedPrice: Double?
)

@Serializable
private data class ClaudeContent(val type: String, val text: String? = null)

@Serializable
private data class ClaudeResponse(val content: List<ClaudeContent>)


class ClaudeClient(private val apiKey: String, private val dataDir: File) {
    private val logger = LoggerFactory.getLogger(ClaudeClient::class.java)
    private val httpClient = HttpClient(CIO) {
        install(HttpTimeout) {
            requestTimeoutMillis = 120_000
            connectTimeoutMillis = 10_000
        }
    }
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    suspend fun generateListings(
        item: Item,
        platforms: List<PlatformProfile>
    ): Map<String, GeneratedPlatformData> {
        val systemPrompt = """
            You are a marketplace listing assistant. Given an item description, optional photos, and platform field requirements, generate listing content for each platform.
            Return ONLY a valid JSON object with no other text, markdown, or explanation.
            The JSON must use the platform IDs as keys.
        """.trimIndent()

        val platformsJson = Json.encodeToString(
            kotlinx.serialization.builtins.ListSerializer(PlatformProfile.serializer()),
            platforms
        )
        val userText = buildString {
            append("Item description:\n${item.rawDescription}\n\n")
            append("Platform definitions (use these IDs as JSON keys):\n$platformsJson\n\n")
            append(
                """Return JSON in exactly this format:
{
  "platform_id": {
    "fields": {
      "fieldname": "value"
    },
    "uncertainFields": ["fieldname_if_unsure"],
    "suggestedPrice": 50.0
  }
}
Rules:
- "fields" must contain a value for every field defined for that platform
- "uncertainFields" lists field names where you are not confident
- "suggestedPrice" is your recommended asking price as a number
- For enum fields, use one of the listed values exactly
- Respect max-length constraints for each field
- Do not include markdown, only raw JSON"""
            )
        }

        val contentParts = buildList {
            add(
                buildJsonObject {
                    put("type", "text")
                    put("text", userText)
                }
            )
            for (photo in item.photos) {
                val photoFile = File(dataDir, "photos/${item.id}/resized/$photo")
                if (photoFile.exists()) {
                    val base64 = Base64.getEncoder().encodeToString(photoFile.readBytes())
                    add(
                        buildJsonObject {
                            put("type", "image")
                            put(
                                "source", buildJsonObject {
                                    put("type", "base64")
                                    put("media_type", "image/jpeg")
                                    put("data", base64)
                                }
                            )
                        }
                    )
                }
            }
        }

        val requestBody = buildJsonObject {
            put("model", "claude-sonnet-4-20250514")
            put("max_tokens", 4096)
            put("system", systemPrompt)
            put("messages", buildJsonArray {
                add(buildJsonObject {
                    put("role", "user")
                    put("content", buildJsonArray { contentParts.forEach { add(it) } })
                })
            })
        }

        logger.info("Calling Claude API: model=claude-sonnet-4-20250514, platforms=${platforms.map { it.id }}, photos=${item.photos.size}")
        val response = httpClient.post("https://api.anthropic.com/v1/messages") {
            headers {
                append("x-api-key", apiKey)
                append("anthropic-version", "2023-06-01")
            }
            contentType(ContentType.Application.Json)
            setBody(requestBody.toString())
        }

        val responseText = response.bodyAsText()

        logger.info("Claude API responded with status=${response.status}")
        if (!response.status.isSuccess()) {
            throw ClaudeApiException("Claude API returned ${response.status}: $responseText")
        }

        val claudeResponse = try {
            json.decodeFromString(ClaudeResponse.serializer(), responseText)
        } catch (e: Exception) {
            throw ClaudeApiException("Failed to parse Claude API envelope: ${e.message}")
        }

        val textContent = claudeResponse.content.firstOrNull { it.type == "text" }?.text
            ?: throw ClaudeApiException("No text content in Claude response")

        logger.info("Claude raw response: $textContent")

        return try {
            // Strip markdown code fences if Claude included them
            val cleaned = textContent.trim()
                .removePrefix("```json")
                .removePrefix("```")
                .removeSuffix("```")
                .trim()

            val root = json.parseToJsonElement(cleaned).jsonObject
            root.mapValues { (_, platformElement) ->
                val obj = platformElement.jsonObject
                val fieldsObj = obj["fields"]?.jsonObject ?: JsonObject(emptyMap())
                val uncertainFields = obj["uncertainFields"]?.jsonArray
                    ?.map { it.jsonPrimitive.content }
                    ?: emptyList()
                val suggestedPrice = obj["suggestedPrice"]?.jsonPrimitive?.doubleOrNull
                GeneratedPlatformData(
                    fields = fieldsObj.mapValues { (_, v) ->
                        if (v is JsonPrimitive) v.content else v.toString()
                    },
                    uncertainFields = uncertainFields,
                    suggestedPrice = suggestedPrice
                )
            }
        } catch (e: Exception) {
            throw ClaudeParseException("Failed to parse Claude's JSON output: ${e.message}", textContent)
        }
    }

    fun close() = httpClient.close()
}
