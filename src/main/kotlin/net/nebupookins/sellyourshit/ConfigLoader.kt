package net.nebupookins.sellyourshit

import com.charleskorn.kaml.Yaml
import org.slf4j.LoggerFactory
import java.io.File

private val logger = LoggerFactory.getLogger("ConfigLoader")

data class AppSettings(
    val config: AppConfig,
    val platforms: List<PlatformProfile>
)

/**
 * Loads key=value pairs from .env in the working directory if it exists.
 * Does not override variables already set in the real environment.
 * This lets Coolify (real env vars) take priority over the local .env file.
 */
fun loadDotEnv() {
    val dotEnvFile = File(".env")
    if (!dotEnvFile.exists()) return

    for (line in dotEnvFile.readLines()) {
        val trimmed = line.trim()
        if (trimmed.isEmpty() || trimmed.startsWith("#")) continue

        val eq = trimmed.indexOf('=')
        if (eq == -1) continue

        val key = trimmed.substring(0, eq).trim()
        val value = trimmed.substring(eq + 1).trim().removeSurrounding("\"").removeSurrounding("'")

        if (System.getenv(key) == null) {
            System.setProperty(key, value)
        }
    }
}

fun loadConfigOrThrow(dataDir: File): AppSettings {
    val configFile = dataDir.resolve("config/config.yaml")
    val platformsDir = dataDir.resolve("platforms")

    check(configFile.exists()) {
        "Config file not found: ${configFile.absolutePath}. " +
            "Create it based on data/config/config.yaml.example"
    }
    check(platformsDir.isDirectory) {
        "Platforms directory not found: ${platformsDir.absolutePath}"
    }

    val config = Yaml.default.decodeFromString(AppConfig.serializer(), configFile.readText())

    val platformFiles = platformsDir.listFiles { f -> f.extension == "yaml" }
        ?: error("Could not list files in ${platformsDir.absolutePath}")
    val platforms = platformFiles
        .sortedBy { it.name }
        .map { Yaml.default.decodeFromString(PlatformProfile.serializer(), it.readText()) }

    logger.info("Loaded config: platforms=${platforms.map { it.id }}")
    return AppSettings(config, platforms)
}

fun loadAnthropicApiKey(): String {
    return System.getenv("ANTHROPIC_API_KEY")
        ?: System.getProperty("ANTHROPIC_API_KEY")
        ?: error("ANTHROPIC_API_KEY environment variable is not set. Set it in your .env file or Coolify environment variables.")
}
