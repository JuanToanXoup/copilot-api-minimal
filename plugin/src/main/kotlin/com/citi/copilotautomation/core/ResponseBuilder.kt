package com.citi.copilotautomation.core

/**
 * Builder for consistent WebSocket response structure.
 * Ensures all responses have the same format.
 */
object ResponseBuilder {

    /**
     * Build a success response.
     */
    fun success(
        type: String,
        port: Int,
        data: Map<String, Any?> = emptyMap()
    ): Map<String, Any?> {
        return buildResponse(type, "success", port, data = data)
    }

    /**
     * Build an error response.
     */
    fun error(
        type: String,
        port: Int,
        message: String
    ): Map<String, Any?> {
        return buildResponse(type, "error", port, message = message)
    }

    /**
     * Build an executing/in-progress response.
     */
    fun executing(
        type: String,
        port: Int,
        message: String = "Operation is being executed"
    ): Map<String, Any?> {
        return buildResponse(type, "executing", port, message = message)
    }

    /**
     * Build a prompt result response.
     */
    fun promptResult(
        port: Int,
        prompt: String,
        content: String
    ): Map<String, Any?> {
        return mapOf(
            "type" to "copilotPromptResult",
            "status" to "success",
            "prompt" to prompt,
            "content" to content,
            "port" to port
        )
    }

    /**
     * Build an agent details response.
     */
    fun agentDetails(
        port: Int,
        details: Map<*, *>
    ): Map<String, Any?> {
        return mapOf(
            "type" to "agent_details",
            "status" to "success",
            "details" to details,
            "port" to port
        )
    }

    /**
     * Build a CLI command result response.
     */
    fun cliResult(
        port: Int,
        output: String
    ): Map<String, Any?> {
        return mapOf(
            "type" to "runCliCommand",
            "status" to "success",
            "output" to output,
            "port" to port
        )
    }

    /**
     * Build a CLI command error response.
     */
    fun cliError(
        port: Int,
        message: String
    ): Map<String, Any?> {
        return mapOf(
            "type" to "runCliCommand",
            "status" to "error",
            "message" to message,
            "port" to port
        )
    }

    /**
     * Build a diagnostics response.
     */
    fun diagnostics(
        port: Int,
        report: String
    ): Map<String, Any?> {
        return mapOf(
            "type" to "diagnoseUI",
            "status" to "success",
            "report" to report,
            "port" to port
        )
    }

    private fun buildResponse(
        type: String,
        status: String,
        port: Int,
        message: String? = null,
        data: Map<String, Any?> = emptyMap()
    ): Map<String, Any?> {
        val response = mutableMapOf<String, Any?>(
            "type" to type,
            "status" to status,
            "port" to port
        )
        message?.let { response["message"] = it }
        response.putAll(data)
        return response
    }
}
