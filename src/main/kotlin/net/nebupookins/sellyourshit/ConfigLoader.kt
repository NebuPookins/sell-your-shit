package net.nebupookins.sellyourshit

import com.charleskorn.kaml.Yaml
import org.slf4j.LoggerFactory
import java.io.File

private val logger = LoggerFactory.getLogger("ConfigLoader")

data class AppSettings(
    val config: AppConfig,
    val secrets: SecretsConfig,
    val platforms: List<PlatformProfile>
)

fun loadConfig(dataDir: File): AppSettings {
    val configFile = dataDir.resolve("config/config.yaml")
    val secretsFile = dataDir.resolve("config/secrets.yaml")
    val platformsDir = dataDir.resolve("platforms")

    check(configFile.exists()) {
        "Config file not found: ${configFile.absolutePath}. " +
            "Create it based on data/config/config.yaml.example"
    }
    check(secretsFile.exists()) {
        "Secrets file not found: ${secretsFile.absolutePath}. " +
            "Create it based on data/config/secrets.yaml.example and add your Anthropic API key"
    }
    check(platformsDir.isDirectory) {
        "Platforms directory not found: ${platformsDir.absolutePath}"
    }

    val config = Yaml.default.decodeFromString(AppConfig.serializer(), configFile.readText())
    val secrets = Yaml.default.decodeFromString(SecretsConfig.serializer(), secretsFile.readText())

    val platformFiles = platformsDir.listFiles { f -> f.extension == "yaml" }
        ?: error("Could not list files in ${platformsDir.absolutePath}")
    val platforms = platformFiles
        .sortedBy { it.name }
        .map { Yaml.default.decodeFromString(PlatformProfile.serializer(), it.readText()) }

    logger.info("Loaded config: port=${config.port}, platforms=${platforms.map { it.id }}")
    return AppSettings(config, secrets, platforms)
}
