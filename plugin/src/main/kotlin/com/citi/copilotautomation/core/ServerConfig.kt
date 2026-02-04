package com.citi.copilotautomation.core

/**
 * Centralized configuration constants for the Copilot API server.
 * All magic numbers and tunable parameters should be defined here.
 */
object ServerConfig {
    // Server startup
    const val SERVER_START_TIMEOUT_MS = 15_000L
    const val PORT_RETRY_ATTEMPTS = 3
    const val PORT_AVAILABILITY_CHECK_TIMEOUT_MS = 500

    // Prompt execution
    const val GENERATION_START_TIMEOUT_MS = 60_000L
    const val GENERATION_COMPLETE_TIMEOUT_MS = 60_000L
    const val POLL_INTERVAL_MS = 250L
    const val POST_GENERATION_DELAY_MS = 1000L

    // UI polling (for port display)
    const val UI_POLL_INTERVAL_MS = 500
    const val UI_POLL_MAX_ATTEMPTS = 40  // 40 * 500ms = 20 seconds

    // CLI execution
    val SAFE_COMMANDS = setOf(
        "ls", "pwd", "whoami", "date", "echo", "cat", "uptime", "gradlew",
        "find", "grep", "curl", "python3", "sh", "git", "jq", "node", "java"
    )
    val UNSAFE_PATTERN = Regex("[;|&`<>]|\\$\\(|&&|\\|\\|")

    // Shutdown
    const val EXECUTOR_SHUTDOWN_TIMEOUT_SEC = 5L
    const val SERVER_STOP_TIMEOUT_MS = 1000
    const val SHUTDOWN_DELAY_SEC = 1L
}
