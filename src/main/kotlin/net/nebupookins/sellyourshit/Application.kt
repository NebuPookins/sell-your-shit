package net.nebupookins.sellyourshit

import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.io.File
import java.net.BindException
import java.time.ZoneOffset

private val appLogger = LoggerFactory.getLogger("Application")

fun main() {
    val dataDir = File("data")
    loadDotEnv()
    val configDir = System.getenv().getOrDefault("CONFIG_DIR", "config").let(::File)
    val settings = loadConfigOrThrow(configDir)
    val anthropicApiKey = loadAnthropicApiKey()

    val port = System.getenv("PORT")?.toIntOrNull()
        ?: System.getProperty("PORT")?.toIntOrNull()
        ?: error("PORT environment variable is not set. Coolify sets this automatically; for local dev, add PORT=45966 to a .env file.")

    try {
        appLogger.info("Starting server on port $port")
        embeddedServer(Netty, port = port) {
            module(settings, anthropicApiKey, dataDir)
        }.start(wait = true)
    } catch (e: BindException) {
        throw BindException("Failed to bind to port $port: ${e.message}")
    }
}

fun Application.module(settings: AppSettings, anthropicApiKey: String, dataDir: File) {
    val itemRepo = ItemRepository(dataDir)
    val claudeClient = ClaudeClient(anthropicApiKey, dataDir)

    environment.monitor.subscribe(io.ktor.server.application.ApplicationStopped) {
        claudeClient.close()
    }

    install(StatusPages) {
        exception<Throwable> { call, cause ->
            appLogger.error("Unhandled exception on ${call.request.httpMethod.value} ${call.request.uri}", cause)
            call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (cause.message ?: "Internal server error")))
        }
    }

    install(ContentNegotiation) {
        json(Json { prettyPrint = true; encodeDefaults = true })
    }

    routing {
        get("/api/v1/health") {
            val checks = listOf(
                mapOf("name" to "disk_space", "healthy" to (dataDir.freeSpace >= 1_048_576L)),
                mapOf("name" to "anthropic_api_key", "healthy" to anthropicApiKey.isNotBlank())
            )
            val allHealthy = checks.all { it["healthy"] == true }
            call.respond(
                if (allHealthy) HttpStatusCode.OK else HttpStatusCode.ServiceUnavailable,
                mapOf("status" to if (allHealthy) "healthy" else "unhealthy", "checks" to checks)
            )
        }

        get("/api/v1/config/platforms") {
            call.respond(settings.platforms)
        }

        get("/api/v1/config/decay") {
            call.respond(settings.config.decay)
        }

        get("/api/v1/dashboard") {
            val zoneOffset = call.request.queryParameters["tz"]?.toIntOrNull()?.let { ZoneOffset.ofTotalSeconds(it * 60) }
            call.respond(itemRepo.getDashboard(settings.config.decay, zoneOffset))
        }

        itemRoutes(itemRepo, claudeClient, settings.platforms, settings.config.decay)

        get("/photos/{itemId}/{filename}") {
            val itemId = call.parameters["itemId"]!!
            val filename = call.parameters["filename"]!!
            val file = itemRepo.getResizedPhotoFile(itemId, filename)
            if (!file.exists()) {
                call.respond(HttpStatusCode.NotFound)
                return@get
            }
            call.respondBytes(file.readBytes(), ContentType.Image.JPEG)
        }

        // Serve frontend static files (must be last)
        staticFiles()
    }
}
