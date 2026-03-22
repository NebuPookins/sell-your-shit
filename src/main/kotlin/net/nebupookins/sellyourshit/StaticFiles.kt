package net.nebupookins.sellyourshit

import io.ktor.http.*
import io.ktor.server.http.content.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Routing.staticFiles() {
    // Serve the React SPA from the classpath static directory.
    // Any unknown path falls back to index.html so React Router handles it.
    staticResources("/", "static") {
        default("index.html")
    }
}
