package net.nebupookins.sellyourshit

import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.slf4j.LoggerFactory

private val logger = LoggerFactory.getLogger("ItemRoutes")

fun Route.itemRoutes(
    itemRepo: ItemRepository,
    claudeClient: ClaudeClient,
    platforms: List<PlatformProfile>,
    decayConfig: DecayConfig
) {
    route("/api/v1/listings") {
        post("/{listingId}/renew") {
            val listingId = call.parameters["listingId"]!!
            val request = call.receive<RenewRequest>()
            val listing = itemRepo.renewListing(listingId, request.newPrice, decayConfig.dropPercent, request.expiresAt)
            if (listing == null) call.respond(HttpStatusCode.NotFound, mapOf("error" to "Listing not found"))
            else call.respond(listing)
        }

        patch("/{listingId}") {
            val listingId = call.parameters["listingId"]!!
            val request = call.receive<PatchListingRequest>()
            val listing = itemRepo.updateListing(listingId, request.generatedFields, request.askingPrice, request.notes, request.postedAt, request.expiresAt, request.externalId)
            if (listing == null) call.respond(HttpStatusCode.NotFound, mapOf("error" to "Listing not found"))
            else call.respond(listing)
        }

        post("/{listingId}/mark-status") {
            val listingId = call.parameters["listingId"]!!
            val request = call.receive<MarkListingStatusRequest>()
            val listing = itemRepo.markListingStatus(listingId, request.status)
            if (listing == null) call.respond(HttpStatusCode.NotFound, mapOf("error" to "Listing not found"))
            else call.respond(listing)
        }

        post("/{listingId}/apply-price-drop") {
            val listingId = call.parameters["listingId"]!!
            val request = call.receive<ApplyPriceDropRequest>()
            val listing = itemRepo.applyPriceDrop(listingId, request.newPrice)
            if (listing == null) call.respond(HttpStatusCode.NotFound, mapOf("error" to "Listing not found"))
            else call.respond(listing)
        }

        post("/{listingId}/mark-posted") {
            val listingId = call.parameters["listingId"]!!
            val request = call.receive<MarkPostedRequest>()
            val listing = itemRepo.markListingPosted(listingId, request.postedAt, request.expiresAt, request.externalId)
            if (listing == null) call.respond(HttpStatusCode.NotFound, mapOf("error" to "Listing not found"))
            else call.respond(listing)
        }
    }

    route("/api/v1/items") {
        post {
            val multipart = call.receiveMultipart()
            var rawDescription = ""
            val photoBytes = mutableListOf<ByteArray>()

            multipart.forEachPart { part ->
                when (part) {
                    is PartData.FormItem -> when (part.name) {
                        "rawDescription" -> rawDescription = part.value
                    }
                    is PartData.FileItem -> {
                        val bytes = @Suppress("DEPRECATION") part.streamProvider().readBytes()
                        if (bytes.isNotEmpty()) photoBytes.add(bytes)
                    }
                    else -> {}
                }
                part.dispose()
            }

            logger.info("Creating item: descLen=${rawDescription.length}, photos=${photoBytes.size}")
            var item = itemRepo.createItem(rawDescription)
            for (bytes in photoBytes) {
                item = itemRepo.addPhoto(item.id, bytes) ?: item
            }
            logger.info("Created item id=${item.id}")
            call.respond(HttpStatusCode.Created, item)
        }

        get {
            call.respond(itemRepo.listItems())
        }

        get("/archived") {
            call.respond(itemRepo.listArchivedItems())
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
                val item = itemRepo.updateItem(id, request.rawDescription)
                if (item == null) call.respond(HttpStatusCode.NotFound, mapOf("error" to "Item not found"))
                else call.respond(item)
            }

            delete {
                val id = call.parameters["id"]!!
                val item = itemRepo.archiveItem(id)
                if (item == null) call.respond(HttpStatusCode.NotFound, mapOf("error" to "Item not found"))
                else call.respond(item)
            }

            post("/generate") {
                val id = call.parameters["id"]!!
                val item = itemRepo.getItem(id)
                if (item == null) {
                    call.respond(HttpStatusCode.NotFound, mapOf("error" to "Item not found"))
                    return@post
                }
                val request = call.receive<GenerateRequest>()
                val selectedProfiles = platforms.filter { it.id in request.platforms }
                if (selectedProfiles.isEmpty()) {
                    call.respond(item)
                    return@post
                }
                logger.info("Generating listings for item id=$id, platforms=${selectedProfiles.map { it.id }}")
                try {
                    val generated = claudeClient.generateListings(item, selectedProfiles)
                    logger.info("Claude returned listings for platforms=${generated.keys}")
                    var updatedItem: Item = item
                    for ((platformId, data) in generated) {
                        val fields = data.fields +
                            data.uncertainFields.associate { "${it}_uncertain" to "true" }
                        updatedItem = itemRepo.addGeneratedListing(
                            id, platformId, fields, data.suggestedPrice
                        ) ?: updatedItem
                    }
                    call.respond(updatedItem)
                } catch (e: ClaudeApiException) {
                    logger.error("Claude API error for item id=$id: ${e.message}")
                    call.respond(HttpStatusCode.BadGateway, mapOf("error" to (e.message ?: "Claude API error")))
                } catch (e: ClaudeParseException) {
                    logger.error("Claude parse error for item id=$id: ${e.message}\nRaw response: ${e.rawResponse}")
                    call.respond(
                        HttpStatusCode.UnprocessableEntity,
                        mapOf("error" to (e.message ?: "Parse error"), "rawResponse" to e.rawResponse)
                    )
                }
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
