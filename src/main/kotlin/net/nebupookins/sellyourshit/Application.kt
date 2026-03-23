package net.nebupookins.sellyourshit

import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.engine.*
import io.ktor.server.netty.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.Json
import java.io.File

fun main() {
    val dataDir = File("data")
    val settings = loadConfig(dataDir)

    embeddedServer(Netty, port = settings.config.port) {
        module(settings)
    }.start(wait = true)
}

fun Application.module(settings: AppSettings) {
    install(ContentNegotiation) {
        json(Json { prettyPrint = true })
    }

    routing {
        get("/api/v1/health") {
            call.respond(mapOf("status" to "ok"))
        }

        get("/api/v1/config/platforms") {
            call.respond(settings.platforms)
        }

        get("/api/v1/config/decay") {
            call.respond(settings.config.decay)
        }

        // Serve frontend static files (must be last)
        staticFiles()
    }
}
