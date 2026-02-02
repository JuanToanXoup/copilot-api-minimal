import org.jetbrains.intellij.platform.gradle.TestFrameworkType

plugins {
    id("java")
    kotlin("jvm") version "1.9.22"
    id("org.jetbrains.intellij.platform") version "2.2.1"
}

group = "com.citi"
version = file("version.txt").takeIf { it.exists() }?.readText()?.trim() ?: "1.0.0"

kotlin {
    jvmToolchain(21)
}

sourceSets {
    main {
        kotlin {
            srcDirs("src/main/kotlin")
        }
        resources {
            srcDirs("src/main/resources")
        }
    }
    test {
        kotlin {
            srcDirs("src/test/kotlin")
        }
    }
}

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        intellijIdeaCommunity("2024.3.3")
        bundledPlugin("com.intellij.java")
        pluginVerifier()
        zipSigner()
        testFramework(TestFrameworkType.Platform)
    }

    // WebSocket dependencies
    implementation("org.java-websocket:Java-WebSocket:1.5.4")

    // JSON serialization
    implementation("com.fasterxml.jackson.core:jackson-databind:2.16.1")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.16.1")

    // Logging
    implementation("org.slf4j:slf4j-simple:2.0.12")

    // Testing
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

intellijPlatform {
    buildSearchableOptions = false

    pluginConfiguration {
        id = "com.citi.copilot-api-minimal"
        name = "Copilot API Minimal"
        version = project.version.toString()
        description = """
            Minimal plugin providing WebSocket API for Copilot chat automation.
            Only displays the WebSocket port number - no other UI.
        """.trimIndent()
        vendor {
            name = "Citigroup"
            email = "support@citi.com"
            url = "http://www.citi.com"
        }
        ideaVersion {
            sinceBuild = "243"
            untilBuild = provider { null }
        }
    }

    signing {
        // Configure if publishing to JetBrains Marketplace
    }

    publishing {
        // token = providers.environmentVariable("PUBLISH_TOKEN")
    }

    pluginVerification {
        ides {
            recommended()
        }
    }
}

tasks {
    test {
        useJUnitPlatform()
    }

    register("incrementVersion") {
        group = "versioning"
        description = "Increment patch version in version.txt"

        doLast {
            val versionFile = file("version.txt")
            if (!versionFile.exists()) {
                versionFile.writeText("1.0.0\n")
                println("Created version.txt with initial version 1.0.0")
                return@doLast
            }

            val currentVersion = versionFile.readText().trim()
            val parts = currentVersion.split(".").map { it.toInt() }.toMutableList()

            if (parts.size == 3) {
                parts[2] = parts[2] + 1
            }

            val newVersion = parts.joinToString(".")
            versionFile.writeText("$newVersion\n")
            println("Version incremented: $currentVersion -> $newVersion")
        }
    }

    register("buildPluginWithVersion") {
        group = "build"
        description = "Build plugin and increment version"
        dependsOn("buildPlugin", "incrementVersion")
    }

    register("info") {
        group = "help"
        description = "Show plugin build information"

        val pluginVersion = project.version.toString()
        val gradleVersion = gradle.gradleVersion

        doLast {
            println("""
                |
                |=== Copilot API Minimal Plugin ===
                |Version: $pluginVersion
                |IntelliJ Target: 2024.3.3 (Community)
                |Java: ${System.getProperty("java.version")}
                |Kotlin: 1.9.22
                |Gradle: $gradleVersion
                |============================================
                |
                |Available tasks:
                |  ./gradlew :plugin:build            - Compile and test
                |  ./gradlew :plugin:buildPlugin      - Create installable plugin ZIP
                |  ./gradlew :plugin:runIde           - Run IDE with plugin installed
                |  ./gradlew :plugin:verifyPlugin     - Verify plugin compatibility
                |  ./gradlew :plugin:incrementVersion - Bump patch version
                |
            """.trimMargin())
        }
    }

    named<ProcessResources>("processResources") {
        duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    }
}
