package net.nebupookins.sellyourshit

import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.itemRoutes(itemRepo: ItemRepository) {
    route("/api/v1/items") {
        post {
            val multipart = call.receiveMultipart()
            var rawDescription = ""
            var minimumPrice = 0.0
            val photoBytes = mutableListOf<ByteArray>()

            multipart.forEachPart { part ->
                when (part) {
                    is PartData.FormItem -> when (part.name) {
                        "rawDescription" -> rawDescription = part.value
                        "minimumPrice" -> minimumPrice = part.value.toDoubleOrNull() ?: 0.0
                    }
                    is PartData.FileItem -> {
                        val bytes = @Suppress("DEPRECATION") part.streamProvider().readBytes()
                        if (bytes.isNotEmpty()) photoBytes.add(bytes)
                    }
                    else -> {}
                }
                part.dispose()
            }

            var item = itemRepo.createItem(rawDescription, minimumPrice)
            for (bytes in photoBytes) {
                item = itemRepo.addPhoto(item.id, bytes) ?: item
            }
            call.respond(HttpStatusCode.Created, item)
        }

        get {
            call.respond(itemRepo.listItems())
        }

        route("/{id}") {
            get {
                val id = call.parameters["id"]!!
                val item = itemRepo.getItem(id)
                if (item == null) call.respond(HttpStatusCode.NotFound, mapOf("error" to "Item not found"))
                else call.respond(item)
            }

            patch {
                val id = call.parameters["id"]!!
                val request = call.receive<PatchItemRequest>()
                val item = itemRepo.updateItem(id, request.rawDescription, request.minimumPrice)
                if (item == null) call.respond(HttpStatusCode.NotFound, mapOf("error" to "Item not found"))
                else call.respond(item)
            }

            delete {
                val id = call.parameters["id"]!!
                val item = itemRepo.archiveItem(id)
                if (item == null) call.respond(HttpStatusCode.NotFound, mapOf("error" to "Item not found"))
                else call.respond(item)
            }

            route("/photos") {
                post {
                    val id = call.parameters["id"]!!
                    val multipart = call.receiveMultipart()
                    var item = itemRepo.getItem(id)
                    if (item == null) {
                        call.respond(HttpStatusCode.NotFound, mapOf("error" to "Item not found"))
                        return@post
                    }
                    multipart.forEachPart { part ->
                        if (part is PartData.FileItem) {
                            val bytes = @Suppress("DEPRECATION") part.streamProvider().readBytes()
                            if (bytes.isNotEmpty()) item = itemRepo.addPhoto(id, bytes)
                        }
                        part.dispose()
                    }
                    call.respond(item!!)
                }

                patch("/order") {
                    val id = call.parameters["id"]!!
                    val request = call.receive<PhotoOrderRequest>()
                    val item = itemRepo.reorderPhotos(id, request.order)
                    if (item == null) call.respond(HttpStatusCode.NotFound, mapOf("error" to "Item not found"))
                    else call.respond(item)
                }

                delete("/{filename}") {
                    val id = call.parameters["id"]!!
                    val filename = call.parameters["filename"]!!
                    val item = itemRepo.deletePhoto(id, filename)
                    if (item == null) call.respond(HttpStatusCode.NotFound, mapOf("error" to "Item not found"))
                    else call.respond(item)
                }
            }
        }
    }
}
