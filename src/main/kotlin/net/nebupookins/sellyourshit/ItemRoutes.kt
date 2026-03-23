package net.nebupookins.sellyourshit

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Route.itemRoutes(itemRepo: ItemRepository) {
    route("/api/v1/items") {
        post {
            val request = call.receive<CreateItemRequest>()
            val item = itemRepo.createItem(request.rawDescription, request.minimumPrice)
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
        }
    }
}
