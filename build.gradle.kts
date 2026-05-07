plugins {
    kotlin("jvm") version "2.1.20"
    kotlin("plugin.serialization") version "2.1.20"
    application
}

group = "net.nebupookins.sellyourshit"
version = "1.0-SNAPSHOT"

kotlin {
    jvmToolchain(26)
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_23)
    }
}

tasks.withType<JavaCompile>().configureEach {
    sourceCompatibility = "23"
    targetCompatibility = "23"
}

repositories {
    mavenCentral()
}

val ktorVersion = "3.1.2"

dependencies {
    implementation("io.ktor:ktor-server-netty:$ktorVersion")
    implementation("io.ktor:ktor-server-content-negotiation:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")
    implementation("io.ktor:ktor-server-call-logging:$ktorVersion")
    implementation("io.ktor:ktor-server-status-pages:$ktorVersion")
    implementation("io.ktor:ktor-client-core:$ktorVersion")
    implementation("io.ktor:ktor-client-cio:$ktorVersion")
    implementation("ch.qos.logback:logback-classic:1.5.18")
    implementation("com.charleskorn.kaml:kaml:0.72.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")

    testImplementation(kotlin("test"))
    testImplementation("io.ktor:ktor-server-test-host:$ktorVersion")
}

application {
    mainClass.set("net.nebupookins.sellyourshit.ApplicationKt")
}

// Build frontend and copy output into static resources
tasks.register<Exec>("npmBuild") {
    onlyIf {
        // Skip when frontend is already pre-built (Docker multi-stage build)
        !file("src/main/resources/static/index.html").exists()
    }
    workingDir = file("frontend")
    commandLine("npm", "run", "build")
    inputs.dir("frontend/src")
    inputs.file("frontend/package.json")
    inputs.file("frontend/vite.config.ts")
    outputs.dir("frontend/dist")
}

tasks.register<Copy>("copyFrontend") {
    dependsOn("npmBuild")
    from("frontend/dist")
    into("src/main/resources/static")
}

tasks.named("processResources") {
    dependsOn("copyFrontend")
}

tasks.test {
    useJUnitPlatform()
}

// Dev mode: starts Vite dev server + Kotlin backend concurrently.
// Open http://localhost:5173 (not 45966) — Vite proxies /api and /photos to the backend.
tasks.register("runDev") {
    val mainSourceSet = sourceSets.main.get()
    dependsOn("classes")
    doLast {
        fun Process.pumpStreams() {
            Thread { inputStream.copyTo(System.out) }.also { it.isDaemon = true }.start()
            Thread { errorStream.copyTo(System.err) }.also { it.isDaemon = true }.start()
        }

        val javaExe = "${System.getProperty("java.home")}/bin/java"
        val viteProcess = ProcessBuilder("npm", "run", "dev")
            .directory(file("frontend"))
            .start()
            .also { it.pumpStreams() }
        val backendProcess = ProcessBuilder(
            javaExe, "-cp", mainSourceSet.runtimeClasspath.asPath,
            "net.nebupookins.sellyourshit.ApplicationKt"
        )
            .start()
            .also { it.pumpStreams() }
        fun killAll() {
            listOf(viteProcess, backendProcess).forEach { proc ->
                proc.descendants().forEach { it.destroyForcibly() }
                proc.destroyForcibly()
            }
        }
        Runtime.getRuntime().addShutdownHook(Thread(::killAll))
        try {
            backendProcess.waitFor()
        } finally {
            killAll()
        }
    }
}
