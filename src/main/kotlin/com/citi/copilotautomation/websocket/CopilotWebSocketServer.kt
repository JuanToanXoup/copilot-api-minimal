package com.citi.copilotautomation.websocket

import com.citi.copilotautomation.bridge.CopilotChatToolWindowUtil
import com.citi.copilotautomation.bridge.CopilotChatUtil
import com.citi.copilotautomation.bridge.CopilotClassNames
import com.citi.copilotautomation.bridge.UIDiagnostics
import com.citi.copilotautomation.bridge.UIFinderUtil
import com.citi.copilotautomation.config.ProjectAgentConfig
import com.fasterxml.jackson.databind.ObjectMapper
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import java.awt.Component
import java.lang.reflect.Field
import java.net.InetSocketAddress
import java.nio.file.Files
import java.nio.file.Paths
import java.util.*
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.locks.ReentrantLock
import javax.swing.JScrollPane

class CopilotWebSocketServer(
    port: Int,
    private val project: Project
) : WebSocketServer(InetSocketAddress("localhost", port)) {

    init {
        isReuseAddr = true
    }

    private val promptLock = ReentrantLock()
    private val promptQueue: BlockingQueue<Map<String, Any?>> = LinkedBlockingQueue()
    private val objectMapper = ObjectMapper()
    private val connectionIds = ConcurrentHashMap<WebSocket, String>()
    private val startLatch = CountDownLatch(1)

    private val workerExecutor: ExecutorService = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "CopilotPromptWorker-${project.name}").apply { isDaemon = true }
    }

    private val scheduledExecutor: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor { runnable ->
        Thread(runnable, "CopilotPollScheduler-${project.name}").apply { isDaemon = true }
    }

    private val currentPrompt = AtomicReference<String?>(null)
    @Volatile private var running = false
    private var actualPort = 0
    @Volatile private var startupError: Exception? = null

    fun startServerAndWait(timeoutMillis: Long): Boolean {
        LOG.debug("Attempting to start CopilotWebSocketServer on $address for project: ${project.name}")
        return try {
            LOG.debug("Calling start() on WebSocketServer...")
            start()
            LOG.debug("start() call returned, waiting for onStart()...")
            val latchReleased = startLatch.await(timeoutMillis, TimeUnit.MILLISECONDS)

            startupError?.let { err ->
                LOG.error("CopilotWebSocketServer: Server startup failed with error: ${err.message}")
                return false
            }

            if (!latchReleased) {
                LOG.error("CopilotWebSocketServer: Server did not start within the timeout of $timeoutMillis ms.")
            } else {
                LOG.debug("CopilotWebSocketServer: Server started successfully on port: $port")
            }
            latchReleased
        } catch (e: Exception) {
            LOG.error("CopilotWebSocketServer failed to start: ${e.message}", e)
            false
        }
    }

    override fun onStart() {
        LOG.debug("onStart() called for CopilotWebSocketServer instance for project '${project.name}'.")
        running = true
        actualPort = address.port
        LOG.info("CopilotWebSocketServer for project '${project.name}' started on port: $actualPort")
        startLatch.countDown()
    }

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
        val connectionId = UUID.randomUUID().toString()
        connectionIds[conn] = connectionId
        LOG.info("WebSocket connection established: $connectionId from ${handshake.resourceDescriptor}")

        try {
            val configFile = Paths.get(project.basePath!!, ProjectAgentConfig.CONFIG_PATH)
            if (!Files.exists(configFile)) {
                throw java.io.FileNotFoundException("Agent config file not found at $configFile")
            }

            val agentDetails = objectMapper.readValue(configFile.toFile(), Map::class.java)
            val response = mapOf(
                "type" to "agent_details",
                "status" to "success",
                "details" to agentDetails
            )
            conn.send(objectMapper.writeValueAsString(response))
            LOG.debug("Proactively sent agent config to new connection $connectionId")
        } catch (e: Exception) {
            LOG.error("Could not send agent details onOpen: ${e.message}")
            val errorResponse = mapOf("type" to "error", "message" to "Failed to retrieve agent details on connection: ${e.message}")
            conn.send(objectMapper.writeValueAsString(errorResponse))
        }
    }

    override fun onClose(conn: WebSocket, code: Int, reason: String, remote: Boolean) {
        val connectionId = connectionIds.remove(conn)
        LOG.info("WebSocket connection closed: $connectionId, code: $code, reason: $reason")
    }

    override fun onError(conn: WebSocket?, ex: Exception) {
        LOG.error("CopilotWebSocketServer encountered an error: ${ex.message}", ex)
        if (conn == null) {
            startupError = ex
            startLatch.countDown()
        }
    }

    override fun onMessage(conn: WebSocket, message: String) {
        if (message == "ping") {
            conn.send("pong")
            return
        }

        try {
            @Suppress("UNCHECKED_CAST")
            val request = objectMapper.readValue(message, Map::class.java) as Map<String, Any?>
            val type = request["type"] as? String

            val response: Map<String, Any?> = when (type) {
                "copilotPrompt" -> handleCopilotPrompt(request["prompt"] as? String, conn)
                "shutdown" -> handleShutdown()
                "setAskChatMode" -> executeEdtAction(type) { CopilotChatToolWindowUtil.setAskChatMode(project) }
                "setAgentChatMode" -> executeEdtAction(type) { CopilotChatToolWindowUtil.setAgentChatMode(project) }
                "setModelGPT" -> executeEdtAction(type) { CopilotChatToolWindowUtil.setModelGPT(project) }
                "setModelGeminiPro" -> executeEdtAction(type) { CopilotChatToolWindowUtil.setModelGeminiPro(project) }
                "setModelClaudeSonnet4" -> executeEdtAction(type) { CopilotChatToolWindowUtil.setModelClaudeSonnet4(project) }
                "newAgentSession" -> executeEdtAction(type) { CopilotChatToolWindowUtil.startNewAgentSession(project) }
                "getCurrentPrompt" -> mapOf("type" to "currentPrompt", "status" to "success", "currentPrompt" to getCurrentPrompt())
                "getPendingPrompts" -> mapOf("type" to "pendingPrompts", "status" to "success", "pendingPrompts" to getPendingPrompts())
                "runCliCommand" -> handleCliCommand(request["command"] as? String ?: "")
                "diagnoseUI" -> handleDiagnoseUI()
                else -> mapOf("type" to "error", "status" to "error", "message" to "Unknown message type: $type")
            }

            val responseWithPort = response.toMutableMap()
            responseWithPort["port"] = port
            conn.send(objectMapper.writeValueAsString(responseWithPort))
        } catch (e: Exception) {
            LOG.error("Error processing message", e)
            val errorResponse = mutableMapOf<String, Any?>(
                "type" to "error",
                "status" to "error",
                "message" to "Error processing message: ${e.message}",
                "port" to port
            )
            conn.send(objectMapper.writeValueAsString(errorResponse))
        }
    }

    /**
     * Execute an EDT action that returns a success/failure boolean.
     * Reports accurate status based on the action's return value.
     */
    private fun executeEdtAction(typeName: String, action: () -> Boolean): Map<String, Any?> {
        return try {
            var success = false
            ApplicationManager.getApplication().invokeAndWait {
                success = action()
            }
            if (success) {
                mapOf("type" to typeName, "status" to "success")
            } else {
                LOG.warn("$typeName action returned false (UI component not found or operation failed)")
                mapOf("type" to typeName, "status" to "error", "message" to "Operation failed - UI component may not be available")
            }
        } catch (e: Exception) {
            LOG.warn("Failed to execute $typeName: ${e.message}")
            mapOf("type" to typeName, "status" to "error", "message" to e.message)
        }
    }

    private fun handleCopilotPrompt(prompt: String?, conn: WebSocket): Map<String, Any?> {
        if (prompt.isNullOrEmpty()) {
            return mapOf("type" to "copilotPrompt", "status" to "error", "message" to "Prompt cannot be empty")
        }

        val wasEmpty = promptQueue.isEmpty()
        promptQueue.offer(mapOf("prompt" to prompt, "conn" to conn))
        if (wasEmpty) {
            submitWorkerTask()
        }
        return mapOf("type" to "copilotPrompt", "status" to "executing", "message" to "Prompt is being executed")
    }

    private fun submitWorkerTask() {
        workerExecutor.submit {
            val job = promptQueue.poll() ?: return@submit
            currentPrompt.set(job["prompt"] as? String)

            val result = executeCopilotPrompt(job["prompt"] as String)
            val responseMsg = mutableMapOf<String, Any?>(
                "type" to "copilotPromptResult",
                "status" to "success",
                "prompt" to job["prompt"],
                "content" to result,
                "port" to port
            )

            val clientConn = job["conn"] as? WebSocket
            sendMessageSafely(clientConn, responseMsg)

            if (promptQueue.isNotEmpty()) {
                submitWorkerTask()
            }
        }
    }

    private fun executeCopilotPrompt(prompt: String): String {
        promptLock.lock()
        try {
            LOG.info("Executing prompt: '${prompt.take(70)}...'")

            ApplicationManager.getApplication().invokeAndWait {
                CopilotChatUtil.sendToCopilotChat(project, prompt) {}
            }

            val timeoutMs = 60000L
            val pollIntervalMs = 250L

            LOG.debug("Waiting for generation to start...")
            val generationStarted = pollUntil(timeoutMs, pollIntervalMs) {
                var buttonCount = 0
                ApplicationManager.getApplication().invokeAndWait {
                    buttonCount = UIFinderUtil.countVisibleStopActionButtons(getToolWindowComponent())
                }
                buttonCount > 0
            }

            if (!generationStarted) {
                return "Error: Timed out waiting for Copilot to start generating a response."
            }
            LOG.debug("Generation started.")

            LOG.debug("Waiting for generation to complete...")
            val generationComplete = pollUntil(timeoutMs, pollIntervalMs) {
                var buttonCount = 0
                ApplicationManager.getApplication().invokeAndWait {
                    buttonCount = UIFinderUtil.countVisibleStopActionButtons(getToolWindowComponent())
                }
                buttonCount == 0
            }

            if (!generationComplete) {
                return "Error: Timed out waiting for Copilot to finish generating a response."
            }

            LOG.debug("Generation complete.")
            Thread.sleep(200)

            var finalResponse = ""
            ApplicationManager.getApplication().invokeAndWait {
                val markdowns = getAllMarkdowns()
                if (markdowns.isNotEmpty()) {
                    finalResponse = markdowns.last()
                }
            }
            return finalResponse

        } catch (e: Exception) {
            LOG.error("Exception during prompt execution", e)
            return "Error: An exception occurred during execution."
        } finally {
            promptLock.unlock()
        }
    }

    private fun pollUntil(timeoutMs: Long, intervalMs: Long, condition: () -> Boolean): Boolean {
        val future = CompletableFuture<Boolean>()
        val startTime = System.currentTimeMillis()

        val scheduledTask = scheduledExecutor.scheduleAtFixedRate({
            try {
                if (System.currentTimeMillis() - startTime >= timeoutMs) {
                    future.complete(false)
                    return@scheduleAtFixedRate
                }
                if (condition()) {
                    future.complete(true)
                }
            } catch (e: Exception) {
                LOG.warn("Error during polling: ${e.message}")
            }
        }, 0, intervalMs, TimeUnit.MILLISECONDS)

        return try {
            future.get(timeoutMs + 1000, TimeUnit.MILLISECONDS)
        } catch (e: TimeoutException) {
            false
        } finally {
            scheduledTask.cancel(false)
        }
    }

    private fun getToolWindowComponent(): Component? {
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow(CopilotClassNames.TOOL_WINDOW_ID)
        return toolWindow?.component
    }

    private fun getAllMarkdowns(): List<String> {
        val toolWindowComponent = getToolWindowComponent() ?: return emptyList()

        val chatScrollPane = UIFinderUtil.findChatScrollPane(toolWindowComponent)
        val searchRoot = if (chatScrollPane is JScrollPane) chatScrollPane.viewport else toolWindowComponent

        // Try new extraction method first
        val messageTexts = UIFinderUtil.findAllMessageTexts(searchRoot)
        if (messageTexts.isNotEmpty()) {
            LOG.debug("getAllMarkdowns: Found ${messageTexts.size} messages using new method")
            return messageTexts
        }

        // Fallback to old method
        val allMarkdownPanes = mutableListOf<Component>()
        UIFinderUtil.findMarkdownPanes(searchRoot, allMarkdownPanes)

        LOG.debug("getAllMarkdowns: Found ${allMarkdownPanes.size} panes using old method")

        return allMarkdownPanes.mapNotNull { pane ->
            try {
                getMarkdownField(pane.javaClass)?.get(pane) as? String
            } catch (e: Exception) {
                LOG.debug("getAllMarkdowns: Failed to extract from ${pane.javaClass.name}: ${e.message}")
                null
            }
        }
    }

    private fun handleShutdown(): Map<String, Any?> {
        LOG.info("Shutting down CopilotWebSocketServer...")
        scheduledExecutor.schedule({
            stopServer()
        }, 1, TimeUnit.SECONDS)
        return mapOf("type" to "shutdown", "status" to "success", "message" to "Server is shutting down")
    }

    fun getCurrentPrompt(): String? = currentPrompt.get()

    fun getPendingPrompts(): List<String> = promptQueue.mapNotNull { it["prompt"] as? String }

    private fun handleDiagnoseUI(): Map<String, Any?> {
        return try {
            var report = ""
            ApplicationManager.getApplication().invokeAndWait {
                report = UIDiagnostics.generateDiagnosticReport(project)
            }
            LOG.info("UI Diagnostics:\n$report")
            mapOf(
                "type" to "diagnoseUI",
                "status" to "success",
                "report" to report
            )
        } catch (e: Exception) {
            LOG.error("Failed to run UI diagnostics: ${e.message}", e)
            mapOf(
                "type" to "diagnoseUI",
                "status" to "error",
                "message" to "Failed to run diagnostics: ${e.message}"
            )
        }
    }

    private fun sendMessageSafely(conn: WebSocket?, message: Map<String, Any?>) {
        if (conn == null) return
        synchronized(conn) {
            try {
                if (conn.isOpen) {
                    conn.send(objectMapper.writeValueAsString(message))
                } else {
                    LOG.debug("Skipping send to closed connection")
                }
            } catch (ex: Exception) {
                LOG.warn("Error sending message to client: ${ex.message}")
            }
        }
    }

    private fun handleCliCommand(fullCommandString: String): Map<String, Any?> {
        return try {
            val commandTokens = fullCommandString.split("\\s+".toRegex())
            if (commandTokens.isEmpty()) {
                return mapOf("type" to "runCliCommand", "status" to "error", "message" to "Command cannot be empty")
            }

            val baseCommand = commandTokens.first()
            if (baseCommand !in SAFE_COMMANDS) {
                return mapOf(
                    "type" to "runCliCommand",
                    "status" to "error",
                    "message" to "Command '$baseCommand' not allowed. Allowed: ${SAFE_COMMANDS.joinToString(", ")}"
                )
            }

            if (UNSAFE_PATTERN.containsMatchIn(fullCommandString)) {
                return mapOf(
                    "type" to "runCliCommand",
                    "status" to "error",
                    "message" to "Command contains potentially unsafe shell metacharacters."
                )
            }

            val proc = ProcessBuilder("/bin/sh", "-c", fullCommandString)
                .redirectErrorStream(false)
                .start()

            val output = proc.inputStream.bufferedReader().use { it.readText() }
            val errorOutput = proc.errorStream.bufferedReader().use { it.readText() }

            val exitCode = proc.waitFor()

            if (exitCode != 0) {
                return mapOf(
                    "type" to "runCliCommand",
                    "status" to "error",
                    "message" to "Command failed with exit code $exitCode: ${errorOutput.ifEmpty { output }}"
                )
            }

            mapOf("type" to "runCliCommand", "status" to "success", "output" to output)
        } catch (e: Exception) {
            LOG.warn("CLI command execution error: ${e.message}")
            mapOf("type" to "runCliCommand", "status" to "error", "message" to "Execution error: ${e.message}")
        }
    }

    fun isRunning(): Boolean = running

    fun stopServer(): Boolean {
        LOG.info("CopilotWebSocketServer for project '${project.name}' stopping on port: $actualPort")

        workerExecutor.shutdown()
        scheduledExecutor.shutdown()

        try {
            if (!workerExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
                LOG.warn("Worker executor did not terminate gracefully, forcing shutdown")
                workerExecutor.shutdownNow()
            }
            if (!scheduledExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
                LOG.warn("Scheduled executor did not terminate gracefully, forcing shutdown")
                scheduledExecutor.shutdownNow()
            }
        } catch (e: InterruptedException) {
            LOG.warn("Interrupted while waiting for executor shutdown")
            workerExecutor.shutdownNow()
            scheduledExecutor.shutdownNow()
            Thread.currentThread().interrupt()
        }

        try {
            stop(1000)
        } catch (e: Exception) {
            LOG.warn("Error stopping server: ${e.message}")
        } finally {
            running = false
        }
        return true
    }

    companion object {
        private val LOG = Logger.getInstance(CopilotWebSocketServer::class.java)

        private val SAFE_COMMANDS = setOf(
            "ls", "pwd", "whoami", "date", "echo", "cat", "uptime", "gradlew",
            "find", "grep", "curl", "python3", "sh", "git", "jq", "node", "java"
        )

        private val UNSAFE_PATTERN = Regex("[;|&`<>]|\\$\\(|&&|\\|\\|")

        private val markdownFieldCache = ConcurrentHashMap<Class<*>, Field?>()

        private fun getMarkdownField(clazz: Class<*>): Field? {
            return markdownFieldCache.computeIfAbsent(clazz) {
                try {
                    clazz.getDeclaredField("markdown").apply { isAccessible = true }
                } catch (e: Exception) {
                    null
                }
            }
        }
    }
}
