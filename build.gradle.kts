plugins {
    base
}

group = "com.citi"
version = "1.0.0"

tasks.register("info") {
    group = "help"
    description = "Show project information and available tasks"

    doLast {
        println("""
            |
            |=== Copilot API Multi-Agent System ===
            |
            |Modules:
            |  :plugin     - IntelliJ IDEA plugin (Kotlin)
            |  :dashboard  - Dashboard UI (React) + Backend (Python)
            |
            |Common tasks:
            |  ./gradlew build              - Build all modules
            |  ./gradlew :plugin:runIde     - Run IDE with plugin
            |  ./gradlew :plugin:buildPlugin - Build plugin ZIP
            |  ./gradlew :dashboard:start   - Start dashboard (frontend + backend)
            |  ./gradlew :dashboard:buildFrontend - Build React frontend
            |
        """.trimMargin())
    }
}
