package com.citi.copilotautomation.websocket

import com.citi.copilotautomation.bridge.CopilotChatToolWindowUtil
import com.citi.copilotautomation.bridge.CopilotChatUtil
import com.citi.copilotautomation.bridge.CopilotClassNames
import com.citi.copilotautomation.bridge.UIDiagnostics
import com.citi.copilotautomation.bridge.UIFinderUtil
import com.citi.copilotautomation.config.PortRegistry
import com.citi.copilotautomation.core.ReflectionUtil
import com.citi.copilotautomation.core.ResponseBuilder
import com.citi.copilotautomation.core.ServerConfig
import com.fasterxml.jackson.databind.ObjectMapper
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import java.awt.Component
import java.net.InetSocketAddress
import java.util.*
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.locks.ReentrantLock
import javax.swing.JScrollPane

class CopilotWebSocketServer(
    port: Int,
    private val project: Project,
    private val instanceId: String = ""
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
    private val busy = AtomicBoolean(false)
    private val running = AtomicBoolean(false)
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
        running.set(true)
        actualPort = address.port
        LOG.info("CopilotWebSocketServer for project '${project.name}' started on port: $actualPort")
        startLatch.countDown()
    }

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
        val connectionId = UUID.randomUUID().toString()
        connectionIds[conn] = connectionId
        LOG.info("WebSocket connection established: $connectionId from ${handshake.resourceDescriptor}")

        try {
            // Read from centralized registry using instance ID
            val entry = PortRegistry.getEntry(instanceId)

            val agentDetails = mutableMapOf<String, Any?>()
            agentDetails["agentName"] = entry?.agentName ?: "Default Agent"
            agentDetails["agentDescription"] = entry?.agentDescription ?: "Default description"
            agentDetails["port"] = port
            agentDetails["instanceId"] = instanceId
            agentDetails["projectPath"] = project.basePath
            agentDetails["role"] = entry?.role
            agentDetails["capabilities"] = entry?.capabilities
            agentDetails["systemPrompt"] = entry?.systemPrompt
            agentDetails["busy"] = busy.get()

            val response = ResponseBuilder.agentDetails(port, agentDetails)
            conn.send(objectMapper.writeValueAsString(response))
            LOG.debug("Proactively sent agent config to new connection $connectionId")
        } catch (e: Exception) {
            LOG.error("Could not send agent details onOpen: ${e.message}")
            val errorResponse = ResponseBuilder.error("agent_details", port, "Failed to retrieve agent details on connection: ${e.message}")
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
                "setModelGPT4o" -> executeEdtAction(type) { CopilotChatToolWindowUtil.setModelGPT4o(project) }
                "setModelGPT41" -> executeEdtAction(type) { CopilotChatToolWindowUtil.setModelGPT41(project) }
                "setModelGeminiPro" -> executeEdtAction(type) { CopilotChatToolWindowUtil.setModelGeminiPro(project) }
                "setModelClaudeSonnet4" -> executeEdtAction(type) { CopilotChatToolWindowUtil.setModelClaudeSonnet4(project) }
                "newAgentSession" -> executeEdtAction(type) { CopilotChatToolWindowUtil.startNewAgentSession(project) }
                "getCurrentPrompt" -> ResponseBuilder.success("currentPrompt", port, mapOf("currentPrompt" to getCurrentPrompt()))
                "getPendingPrompts" -> ResponseBuilder.success("pendingPrompts", port, mapOf("pendingPrompts" to getPendingPrompts()))
                "getStatus" -> ResponseBuilder.success("getStatus", port, mapOf(
                    "busy" to busy.get(),
                    "currentPrompt" to currentPrompt.get()?.take(100),
                    "queueSize" to promptQueue.size
                ))
                "runCliCommand" -> handleCliCommand(request["command"] as? String ?: "")
                "diagnoseUI" -> handleDiagnoseUI()
                "inspectInput" -> handleInspectInput()
                "inspectChatMode" -> handleInspectChatMode()
                "inspectModels" -> handleInspectModels()
                "startEventRecording" -> handleStartEventRecording()
                "stopEventRecording" -> handleStopEventRecording()
                // Multi-agent configuration commands
                "setAgentRole" -> handleSetAgentRole(request["role"] as? String)
                "setAgentCapabilities" -> handleSetAgentCapabilities(request["capabilities"])
                "setAgentSystemPrompt" -> handleSetAgentSystemPrompt(request["systemPrompt"] as? String)
                "setAgentConfig" -> handleSetAgentConfig(request)
                "getAgentConfig" -> handleGetAgentConfig()
                "discoverAgents" -> handleDiscoverAgents()
                "findAgentsByRole" -> handleFindAgentsByRole(request["role"] as? String)
                "findAgentsByCapability" -> handleFindAgentsByCapability(request["capability"] as? String)
                // Agent-to-agent communication
                "delegateToAgent" -> handleDelegateToAgent(request)
                // Agent spawning
                "spawnAgent" -> handleSpawnAgent(request)
                "listProjects" -> handleListProjects()
                else -> ResponseBuilder.error("error", port, "Unknown message type: $type")
            }

            conn.send(objectMapper.writeValueAsString(response))
        } catch (e: Exception) {
            LOG.error("Error processing message", e)
            val errorResponse = ResponseBuilder.error("error", port, "Error processing message: ${e.message}")
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
                ResponseBuilder.success(typeName, port)
            } else {
                LOG.warn("$typeName action returned false (UI component not found or operation failed)")
                ResponseBuilder.error(typeName, port, "Operation failed - UI component may not be available")
            }
        } catch (e: Exception) {
            LOG.warn("Failed to execute $typeName: ${e.message}")
            ResponseBuilder.error(typeName, port, e.message ?: "Unknown error")
        }
    }

    private fun handleCopilotPrompt(prompt: String?, conn: WebSocket): Map<String, Any?> {
        if (prompt.isNullOrEmpty()) {
            return ResponseBuilder.error("copilotPrompt", port, "Prompt cannot be empty")
        }

        val wasEmpty = promptQueue.isEmpty()
        promptQueue.offer(mapOf("prompt" to prompt, "conn" to conn))
        if (wasEmpty) {
            submitWorkerTask()
        }
        return ResponseBuilder.executing("copilotPrompt", port, "Prompt is being executed")
    }

    private fun submitWorkerTask() {
        workerExecutor.submit {
            val job = promptQueue.poll() ?: return@submit
            currentPrompt.set(job["prompt"] as? String)
            setBusyStatus(true)

            try {
                val result = executeCopilotPrompt(job["prompt"] as String)
                val responseMsg = ResponseBuilder.promptResult(port, job["prompt"] as String, result)

                val clientConn = job["conn"] as? WebSocket
                sendMessageSafely(clientConn, responseMsg)
            } finally {
                currentPrompt.set(null)
                if (promptQueue.isNotEmpty()) {
                    submitWorkerTask()
                } else {
                    setBusyStatus(false)
                }
            }
        }
    }

    private fun executeCopilotPrompt(prompt: String): String {
        promptLock.lock()
        try {
            // Prepend system prompt if configured for this agent's role
            val entry = PortRegistry.getEntry(instanceId)
            val systemPrompt = entry?.systemPrompt
            val fullPrompt = if (!systemPrompt.isNullOrBlank()) {
                "$systemPrompt\n\n$prompt"
            } else {
                prompt
            }

            LOG.info("Executing prompt: '${fullPrompt.take(70)}...'")

            // Count existing messages BEFORE sending the prompt
            var messageCountBefore = 0
            ApplicationManager.getApplication().invokeAndWait {
                messageCountBefore = getAllMarkdowns().size
            }
            LOG.debug("Message count before prompt: $messageCountBefore")

            ApplicationManager.getApplication().invokeAndWait {
                CopilotChatUtil.sendToCopilotChat(project, fullPrompt) {}
            }

            LOG.debug("Waiting for generation to start...")
            val generationStarted = pollUntil(ServerConfig.GENERATION_START_TIMEOUT_MS, ServerConfig.POLL_INTERVAL_MS) {
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
            val generationComplete = pollUntil(ServerConfig.GENERATION_COMPLETE_TIMEOUT_MS, ServerConfig.POLL_INTERVAL_MS) {
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
            Thread.sleep(ServerConfig.POST_GENERATION_DELAY_MS)

            var finalResponse = ""
            ApplicationManager.getApplication().invokeAndWait {
                val markdowns = getAllMarkdowns()
                LOG.debug("Message count after prompt: ${markdowns.size}")

                // Only get messages that were added AFTER we sent the prompt
                val newMessages = if (markdowns.size > messageCountBefore) {
                    markdowns.subList(messageCountBefore, markdowns.size)
                } else {
                    markdowns
                }

                if (newMessages.isNotEmpty()) {
                    // Get the last new message (the response)
                    finalResponse = newMessages.last()
                    LOG.debug("Extracted response (${finalResponse.length} chars)")
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

        // Fallback to old method using reflection
        val allMarkdownPanes = mutableListOf<Component>()
        UIFinderUtil.findMarkdownPanes(searchRoot, allMarkdownPanes)

        LOG.debug("getAllMarkdowns: Found ${allMarkdownPanes.size} panes using old method")

        return allMarkdownPanes.mapNotNull { pane ->
            ReflectionUtil.getStringField(pane, "markdown")
        }
    }

    private fun handleShutdown(): Map<String, Any?> {
        LOG.info("Shutting down CopilotWebSocketServer...")
        scheduledExecutor.schedule({
            stopServer()
        }, ServerConfig.SHUTDOWN_DELAY_SEC, TimeUnit.SECONDS)
        return ResponseBuilder.success("shutdown", port, mapOf("message" to "Server is shutting down"))
    }

    fun isBusy(): Boolean = busy.get()

    fun getCurrentPrompt(): String? = currentPrompt.get()

    fun getPendingPrompts(): List<String> {
        // Take a snapshot to avoid ConcurrentModificationException
        return promptQueue.toList().mapNotNull { it["prompt"] as? String }
    }

    private fun handleDiagnoseUI(): Map<String, Any?> {
        return try {
            var report = ""
            ApplicationManager.getApplication().invokeAndWait {
                report = UIDiagnostics.generateDiagnosticReport(project)
            }
            LOG.info("UI Diagnostics:\n$report")
            ResponseBuilder.diagnostics(port, report)
        } catch (e: Exception) {
            LOG.error("Failed to run UI diagnostics: ${e.message}", e)
            ResponseBuilder.error("diagnoseUI", port, "Failed to run diagnostics: ${e.message}")
        }
    }

    private fun handleInspectInput(): Map<String, Any?> {
        return try {
            var report = ""
            ApplicationManager.getApplication().invokeAndWait {
                report = UIDiagnostics.inspectInputComponent(project)
            }
            LOG.info("Input Inspection:\n$report")
            ResponseBuilder.success("inspectInput", port, mapOf("report" to report))
        } catch (e: Exception) {
            LOG.error("Failed to inspect input: ${e.message}", e)
            ResponseBuilder.error("inspectInput", port, "Failed to inspect input: ${e.message}")
        }
    }

    private fun handleInspectChatMode(): Map<String, Any?> {
        return try {
            var report = ""
            ApplicationManager.getApplication().invokeAndWait {
                report = UIDiagnostics.inspectChatModeComboBox(project)
            }
            LOG.info("ChatMode Inspection:\n$report")
            ResponseBuilder.success("inspectChatMode", port, mapOf("report" to report))
        } catch (e: Exception) {
            LOG.error("Failed to inspect chat mode: ${e.message}", e)
            ResponseBuilder.error("inspectChatMode", port, "Failed to inspect chat mode: ${e.message}")
        }
    }

    private fun handleInspectModels(): Map<String, Any?> {
        return try {
            var report = ""
            ApplicationManager.getApplication().invokeAndWait {
                report = UIDiagnostics.inspectModelPickPanel(project)
            }
            LOG.info("Models Inspection:\n$report")
            ResponseBuilder.success("inspectModels", port, mapOf("report" to report))
        } catch (e: Exception) {
            LOG.error("Failed to inspect models: ${e.message}", e)
            ResponseBuilder.error("inspectModels", port, "Failed to inspect models: ${e.message}")
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

    /**
     * Broadcast a message to all connected WebSocket clients.
     */
    private fun broadcastToAll(message: Map<String, Any?>) {
        val msg = objectMapper.writeValueAsString(message)
        for (conn in connectionIds.keys) {
            try {
                if (conn.isOpen) {
                    conn.send(msg)
                }
            } catch (ex: Exception) {
                LOG.warn("Error broadcasting to client: ${ex.message}")
            }
        }
    }

    /**
     * Update busy state and broadcast the change to all connected clients.
     */
    private fun setBusyStatus(isBusy: Boolean) {
        busy.set(isBusy)
        broadcastToAll(mapOf(
            "type" to "busy_status",
            "busy" to isBusy,
            "port" to port,
            "instanceId" to instanceId,
            "currentPrompt" to if (isBusy) currentPrompt.get()?.take(100) else null,
            "queueSize" to promptQueue.size
        ))
        LOG.debug("Busy status changed: $isBusy (queue size: ${promptQueue.size})")
    }

    private fun handleCliCommand(fullCommandString: String): Map<String, Any?> {
        return try {
            val commandTokens = fullCommandString.split("\\s+".toRegex())
            if (commandTokens.isEmpty()) {
                return ResponseBuilder.cliError(port, "Command cannot be empty")
            }

            val baseCommand = commandTokens.first()
            if (baseCommand !in ServerConfig.SAFE_COMMANDS) {
                return ResponseBuilder.cliError(port,
                    "Command '$baseCommand' not allowed. Allowed: ${ServerConfig.SAFE_COMMANDS.joinToString(", ")}")
            }

            if (ServerConfig.UNSAFE_PATTERN.containsMatchIn(fullCommandString)) {
                return ResponseBuilder.cliError(port, "Command contains potentially unsafe shell metacharacters.")
            }

            val proc = ProcessBuilder("/bin/sh", "-c", fullCommandString)
                .redirectErrorStream(false)
                .start()

            val output = proc.inputStream.bufferedReader().use { it.readText() }
            val errorOutput = proc.errorStream.bufferedReader().use { it.readText() }

            val exitCode = proc.waitFor()

            if (exitCode != 0) {
                return ResponseBuilder.cliError(port,
                    "Command failed with exit code $exitCode: ${errorOutput.ifEmpty { output }}")
            }

            ResponseBuilder.cliResult(port, output)
        } catch (e: Exception) {
            LOG.warn("CLI command execution error: ${e.message}")
            ResponseBuilder.cliError(port, "Execution error: ${e.message}")
        }
    }

    // Event recording for debugging
    private var eventListener: java.awt.event.AWTEventListener? = null
    private val recordedEvents = mutableListOf<String>()

    private fun handleStartEventRecording(): Map<String, Any?> {
        return try {
            recordedEvents.clear()

            eventListener = java.awt.event.AWTEventListener { event ->
                val source = event.source
                val sourceClass = source?.javaClass?.simpleName ?: "null"
                val sourceName = (source as? java.awt.Component)?.name ?: ""

                val eventInfo = buildString {
                    append("[${System.currentTimeMillis()}] ")
                    append("${event.javaClass.simpleName} ")
                    append("on $sourceClass")
                    if (sourceName.isNotEmpty()) append(" ($sourceName)")
                    append(": ")

                    when (event) {
                        is java.awt.event.MouseEvent -> {
                            append("${getMouseEventType(event.id)} at (${event.x}, ${event.y}) button=${event.button}")
                        }
                        is java.awt.event.KeyEvent -> {
                            append("${getKeyEventType(event.id)} keyCode=${event.keyCode} char='${event.keyChar}'")
                        }
                        is java.awt.event.ActionEvent -> {
                            append("actionCommand='${event.actionCommand}'")
                        }
                        is java.awt.event.ItemEvent -> {
                            append("stateChange=${if (event.stateChange == java.awt.event.ItemEvent.SELECTED) "SELECTED" else "DESELECTED"} item=${event.item}")
                        }
                        else -> append(event.toString().take(200))
                    }
                }

                synchronized(recordedEvents) {
                    recordedEvents.add(eventInfo)
                    if (recordedEvents.size > 500) {
                        recordedEvents.removeAt(0)
                    }
                }
            }

            val eventMask = java.awt.AWTEvent.MOUSE_EVENT_MASK or
                    java.awt.AWTEvent.KEY_EVENT_MASK or
                    java.awt.AWTEvent.ACTION_EVENT_MASK or
                    java.awt.AWTEvent.ITEM_EVENT_MASK or
                    java.awt.AWTEvent.FOCUS_EVENT_MASK

            java.awt.Toolkit.getDefaultToolkit().addAWTEventListener(eventListener, eventMask)

            LOG.info("Started AWT event recording")
            ResponseBuilder.success("startEventRecording", port, mapOf("message" to "Recording started. Interact with UI, then call stopEventRecording."))
        } catch (e: Exception) {
            LOG.error("Failed to start event recording: ${e.message}", e)
            ResponseBuilder.error("startEventRecording", port, "Failed: ${e.message}")
        }
    }

    private fun handleStopEventRecording(): Map<String, Any?> {
        return try {
            eventListener?.let {
                java.awt.Toolkit.getDefaultToolkit().removeAWTEventListener(it)
            }
            eventListener = null

            val events = synchronized(recordedEvents) {
                recordedEvents.toList()
            }

            LOG.info("Stopped AWT event recording. Captured ${events.size} events.")
            ResponseBuilder.success("stopEventRecording", port, mapOf(
                "eventCount" to events.size,
                "events" to events
            ))
        } catch (e: Exception) {
            LOG.error("Failed to stop event recording: ${e.message}", e)
            ResponseBuilder.error("stopEventRecording", port, "Failed: ${e.message}")
        }
    }

    // ==================== Multi-Agent Configuration ====================

    private fun handleSetAgentRole(role: String?): Map<String, Any?> {
        return try {
            PortRegistry.setAgentConfig(instanceId, role = role)
            LOG.info("Set agent role to: $role")
            ResponseBuilder.success("setAgentRole", port, mapOf("role" to role))
        } catch (e: Exception) {
            LOG.error("Failed to set agent role: ${e.message}", e)
            ResponseBuilder.error("setAgentRole", port, "Failed: ${e.message}")
        }
    }

    private fun handleSetAgentCapabilities(capabilities: Any?): Map<String, Any?> {
        return try {
            @Suppress("UNCHECKED_CAST")
            val capList = when (capabilities) {
                is List<*> -> capabilities.filterIsInstance<String>()
                is String -> capabilities.split(",").map { it.trim() }
                else -> null
            }
            PortRegistry.setAgentConfig(instanceId, capabilities = capList)
            LOG.info("Set agent capabilities to: $capList")
            ResponseBuilder.success("setAgentCapabilities", port, mapOf("capabilities" to capList))
        } catch (e: Exception) {
            LOG.error("Failed to set agent capabilities: ${e.message}", e)
            ResponseBuilder.error("setAgentCapabilities", port, "Failed: ${e.message}")
        }
    }

    private fun handleSetAgentSystemPrompt(systemPrompt: String?): Map<String, Any?> {
        return try {
            PortRegistry.setAgentConfig(instanceId, systemPrompt = systemPrompt)
            LOG.info("Set agent system prompt (${systemPrompt?.length ?: 0} chars)")
            ResponseBuilder.success("setAgentSystemPrompt", port, mapOf("systemPrompt" to systemPrompt))
        } catch (e: Exception) {
            LOG.error("Failed to set agent system prompt: ${e.message}", e)
            ResponseBuilder.error("setAgentSystemPrompt", port, "Failed: ${e.message}")
        }
    }

    private fun handleSetAgentConfig(request: Map<String, Any?>): Map<String, Any?> {
        return try {
            val agentName = request["agentName"] as? String
            val agentDescription = request["agentDescription"] as? String
            val role = request["role"] as? String
            @Suppress("UNCHECKED_CAST")
            val capabilities = (request["capabilities"] as? List<*>)?.filterIsInstance<String>()
            val systemPrompt = request["systemPrompt"] as? String

            PortRegistry.setAgentConfig(
                instanceId,
                agentName = agentName,
                agentDescription = agentDescription,
                role = role,
                capabilities = capabilities,
                systemPrompt = systemPrompt
            )
            LOG.info("Updated agent config: role=$role, capabilities=$capabilities")
            ResponseBuilder.success("setAgentConfig", port, mapOf(
                "agentName" to agentName,
                "role" to role,
                "capabilities" to capabilities
            ))
        } catch (e: Exception) {
            LOG.error("Failed to set agent config: ${e.message}", e)
            ResponseBuilder.error("setAgentConfig", port, "Failed: ${e.message}")
        }
    }

    private fun handleGetAgentConfig(): Map<String, Any?> {
        return try {
            val entry = PortRegistry.getEntry(instanceId)
            ResponseBuilder.success("getAgentConfig", port, mapOf(
                "instanceId" to instanceId,
                "projectPath" to project.basePath,
                "agentName" to entry?.agentName,
                "agentDescription" to entry?.agentDescription,
                "role" to entry?.role,
                "capabilities" to entry?.capabilities,
                "systemPrompt" to entry?.systemPrompt
            ))
        } catch (e: Exception) {
            LOG.error("Failed to get agent config: ${e.message}", e)
            ResponseBuilder.error("getAgentConfig", port, "Failed: ${e.message}")
        }
    }

    private fun handleDiscoverAgents(): Map<String, Any?> {
        return try {
            val allAgents = PortRegistry.getAllInstances()
            val agentList = allAgents.map { (id, entry) ->
                mapOf(
                    "instanceId" to id,
                    "projectPath" to entry.projectPath,
                    "port" to entry.port,
                    "agentName" to entry.agentName,
                    "role" to entry.role,
                    "capabilities" to entry.capabilities,
                    "isCurrentInstance" to (id == instanceId)
                )
            }
            ResponseBuilder.success("discoverAgents", port, mapOf(
                "agents" to agentList,
                "count" to agentList.size
            ))
        } catch (e: Exception) {
            LOG.error("Failed to discover agents: ${e.message}", e)
            ResponseBuilder.error("discoverAgents", port, "Failed: ${e.message}")
        }
    }

    private fun handleFindAgentsByRole(role: String?): Map<String, Any?> {
        if (role.isNullOrBlank()) {
            return ResponseBuilder.error("findAgentsByRole", port, "Role parameter is required")
        }
        return try {
            val agents = PortRegistry.findAgentsByRole(role)
            val agentList = agents.map { (id, entry) ->
                mapOf(
                    "instanceId" to id,
                    "projectPath" to entry.projectPath,
                    "port" to entry.port,
                    "agentName" to entry.agentName,
                    "role" to entry.role,
                    "capabilities" to entry.capabilities
                )
            }
            ResponseBuilder.success("findAgentsByRole", port, mapOf(
                "role" to role,
                "agents" to agentList,
                "count" to agentList.size
            ))
        } catch (e: Exception) {
            LOG.error("Failed to find agents by role: ${e.message}", e)
            ResponseBuilder.error("findAgentsByRole", port, "Failed: ${e.message}")
        }
    }

    private fun handleFindAgentsByCapability(capability: String?): Map<String, Any?> {
        if (capability.isNullOrBlank()) {
            return ResponseBuilder.error("findAgentsByCapability", port, "Capability parameter is required")
        }
        return try {
            val agents = PortRegistry.findAgentsByCapability(capability)
            val agentList = agents.map { (id, entry) ->
                mapOf(
                    "instanceId" to id,
                    "projectPath" to entry.projectPath,
                    "port" to entry.port,
                    "agentName" to entry.agentName,
                    "role" to entry.role,
                    "capabilities" to entry.capabilities
                )
            }
            ResponseBuilder.success("findAgentsByCapability", port, mapOf(
                "capability" to capability,
                "agents" to agentList,
                "count" to agentList.size
            ))
        } catch (e: Exception) {
            LOG.error("Failed to find agents by capability: ${e.message}", e)
            ResponseBuilder.error("findAgentsByCapability", port, "Failed: ${e.message}")
        }
    }

    // ==================== Agent-to-Agent Communication ====================

    private fun handleDelegateToAgent(request: Map<String, Any?>): Map<String, Any?> {
        val targetPort = (request["targetPort"] as? Number)?.toInt()
        val targetInstanceId = request["targetInstanceId"] as? String
        val targetRole = request["targetRole"] as? String
        val prompt = request["prompt"] as? String
        val messageType = request["messageType"] as? String ?: "copilotPrompt"

        if (prompt.isNullOrBlank()) {
            return ResponseBuilder.error("delegateToAgent", port, "Prompt is required")
        }

        // Determine target port
        val resolvedPort = when {
            targetPort != null && targetPort > 0 -> targetPort
            targetInstanceId != null -> PortRegistry.getEntry(targetInstanceId)?.port
            targetRole != null -> PortRegistry.findAgentsByRole(targetRole).values.firstOrNull()?.port
            else -> null
        }

        if (resolvedPort == null || resolvedPort <= 0) {
            return ResponseBuilder.error("delegateToAgent", port, "Could not resolve target agent")
        }

        if (resolvedPort == this.port) {
            return ResponseBuilder.error("delegateToAgent", port, "Cannot delegate to self")
        }

        return try {
            LOG.info("Delegating to agent on port $resolvedPort: ${prompt.take(50)}...")

            val resultHolder = java.util.concurrent.CompletableFuture<Map<String, Any?>>()

            val wsClient = DelegationClient(
                uri = java.net.URI("ws://localhost:$resolvedPort"),
                messageType = messageType,
                prompt = prompt,
                resultHolder = resultHolder,
                objectMapper = objectMapper,
                logger = LOG
            )

            wsClient.connectBlocking(10, java.util.concurrent.TimeUnit.SECONDS)

            // Wait for result with timeout
            val result = resultHolder.get(120, java.util.concurrent.TimeUnit.SECONDS)

            ResponseBuilder.success("delegateToAgent", port, mapOf(
                "targetPort" to resolvedPort,
                "delegatedResult" to result,
                "fromAgent" to instanceId
            ))
        } catch (e: java.util.concurrent.TimeoutException) {
            LOG.error("Delegation timed out: ${e.message}")
            ResponseBuilder.error("delegateToAgent", port, "Delegation timed out")
        } catch (e: Exception) {
            LOG.error("Failed to delegate to agent: ${e.message}", e)
            ResponseBuilder.error("delegateToAgent", port, "Failed: ${e.message}")
        }
    }

    // ==================== Agent Spawning ====================

    private fun handleSpawnAgent(request: Map<String, Any?>): Map<String, Any?> {
        val projectPath = request["projectPath"] as? String
        val role = request["role"] as? String
        @Suppress("UNCHECKED_CAST")
        val capabilities = (request["capabilities"] as? List<*>)?.filterIsInstance<String>()
        val waitForReady = request["waitForReady"] as? Boolean ?: false
        val timeoutSeconds = (request["timeout"] as? Number)?.toInt() ?: 30

        if (projectPath.isNullOrBlank()) {
            return ResponseBuilder.error("spawnAgent", port, "projectPath is required")
        }

        val projectDir = java.io.File(projectPath)
        if (!projectDir.exists() || !projectDir.isDirectory) {
            return ResponseBuilder.error("spawnAgent", port, "Project path does not exist: $projectPath")
        }

        return try {
            LOG.info("Spawning new agent for project: $projectPath")

            // Try different ways to open IntelliJ (same approach as tool window)
            val commands = listOf(
                listOf("idea", projectPath),
                listOf("open", "-a", "IntelliJ IDEA", projectPath),
                listOf("open", "-a", "IntelliJ IDEA Ultimate", projectPath),
                listOf("open", "-a", "IntelliJ IDEA CE", projectPath)
            )

            var launched = false
            for (cmd in commands) {
                try {
                    val process = ProcessBuilder(cmd)
                        .redirectErrorStream(true)
                        .start()
                    Thread.sleep(1000)
                    if (process.isAlive || process.exitValue() == 0) {
                        launched = true
                        break
                    }
                } catch (e: Exception) {
                    // Try next command
                }
            }

            if (!launched) {
                return ResponseBuilder.error("spawnAgent", port, "Failed to launch IDE")
            }

            // Optionally wait for the new agent to register
            if (waitForReady) {
                val startTime = System.currentTimeMillis()
                var newAgentPort: Int? = null

                while (System.currentTimeMillis() - startTime < timeoutSeconds * 1000) {
                    Thread.sleep(2000)
                    // Look for a new instance of this project
                    val instances = PortRegistry.getInstancesForProject(projectPath)
                    val newInstance = instances.entries.find { (id, entry) ->
                        entry.port > 0 && isPortResponding(entry.port)
                    }
                    if (newInstance != null) {
                        newAgentPort = newInstance.value.port

                        // Configure the new agent if role/capabilities specified
                        if (role != null || capabilities != null) {
                            try {
                                val configClient = DelegationClient(
                                    uri = java.net.URI("ws://localhost:$newAgentPort"),
                                    messageType = "setAgentConfig",
                                    prompt = "", // Not used for config
                                    resultHolder = java.util.concurrent.CompletableFuture(),
                                    objectMapper = objectMapper,
                                    logger = LOG
                                )
                                // Would need to modify DelegationClient to support config messages
                                // For now, just note the port
                            } catch (e: Exception) {
                                LOG.warn("Could not configure new agent: ${e.message}")
                            }
                        }
                        break
                    }
                }

                if (newAgentPort != null) {
                    ResponseBuilder.success("spawnAgent", port, mapOf(
                        "projectPath" to projectPath,
                        "newAgentPort" to newAgentPort,
                        "status" to "ready"
                    ))
                } else {
                    ResponseBuilder.success("spawnAgent", port, mapOf(
                        "projectPath" to projectPath,
                        "status" to "launched_not_ready",
                        "message" to "IDE launched but agent not yet registered"
                    ))
                }
            } else {
                ResponseBuilder.success("spawnAgent", port, mapOf(
                    "projectPath" to projectPath,
                    "status" to "launched"
                ))
            }
        } catch (e: Exception) {
            LOG.error("Failed to spawn agent: ${e.message}", e)
            ResponseBuilder.error("spawnAgent", port, "Failed: ${e.message}")
        }
    }

    private fun isPortResponding(port: Int): Boolean {
        return try {
            java.net.Socket("localhost", port).use { true }
        } catch (e: Exception) {
            false
        }
    }

    private fun handleListProjects(): Map<String, Any?> {
        return try {
            val instances = PortRegistry.getAllInstances()
            val projects = instances.values
                .map { it.projectPath }
                .distinct()
                .map { path ->
                    val projectInstances = instances.filter { it.value.projectPath == path }
                    mapOf(
                        "projectPath" to path,
                        "projectName" to java.io.File(path).name,
                        "instanceCount" to projectInstances.size,
                        "instances" to projectInstances.map { (id, entry) ->
                            mapOf(
                                "instanceId" to id,
                                "port" to entry.port,
                                "role" to entry.role,
                                "isRunning" to isPortResponding(entry.port)
                            )
                        }
                    )
                }

            ResponseBuilder.success("listProjects", port, mapOf(
                "projects" to projects,
                "totalProjects" to projects.size,
                "totalInstances" to instances.size
            ))
        } catch (e: Exception) {
            LOG.error("Failed to list projects: ${e.message}", e)
            ResponseBuilder.error("listProjects", port, "Failed: ${e.message}")
        }
    }

    /**
     * WebSocket client for delegating tasks to other agents.
     */
    private class DelegationClient(
        uri: java.net.URI,
        private val messageType: String,
        private val prompt: String,
        private val resultHolder: java.util.concurrent.CompletableFuture<Map<String, Any?>>,
        private val objectMapper: ObjectMapper,
        private val logger: Logger
    ) : org.java_websocket.client.WebSocketClient(uri) {

        private var receivedConfig = false

        override fun onOpen(handshakedata: org.java_websocket.handshake.ServerHandshake) {
            logger.debug("Connected to target agent")
        }

        override fun onMessage(message: String) {
            try {
                val response = objectMapper.readValue(message, Map::class.java)
                if (!receivedConfig) {
                    // First message is agent config, skip it
                    receivedConfig = true
                    // Now send the actual prompt
                    send(objectMapper.writeValueAsString(mapOf(
                        "type" to messageType,
                        "prompt" to prompt
                    )))
                } else {
                    // Check if this is an "executing" response
                    if (response["status"] == "executing") {
                        // Wait for actual result
                        return
                    }
                    @Suppress("UNCHECKED_CAST")
                    resultHolder.complete(response as Map<String, Any?>)
                    close()
                }
            } catch (e: Exception) {
                resultHolder.completeExceptionally(e)
                close()
            }
        }

        override fun onClose(code: Int, reason: String, remote: Boolean) {
            if (!resultHolder.isDone) {
                resultHolder.complete(mapOf("error" to "Connection closed: $reason"))
            }
        }

        override fun onError(ex: Exception) {
            resultHolder.completeExceptionally(ex)
        }
    }

    private fun getMouseEventType(id: Int): String = when (id) {
        java.awt.event.MouseEvent.MOUSE_PRESSED -> "PRESSED"
        java.awt.event.MouseEvent.MOUSE_RELEASED -> "RELEASED"
        java.awt.event.MouseEvent.MOUSE_CLICKED -> "CLICKED"
        java.awt.event.MouseEvent.MOUSE_ENTERED -> "ENTERED"
        java.awt.event.MouseEvent.MOUSE_EXITED -> "EXITED"
        java.awt.event.MouseEvent.MOUSE_MOVED -> "MOVED"
        java.awt.event.MouseEvent.MOUSE_DRAGGED -> "DRAGGED"
        else -> "UNKNOWN($id)"
    }

    private fun getKeyEventType(id: Int): String = when (id) {
        java.awt.event.KeyEvent.KEY_PRESSED -> "PRESSED"
        java.awt.event.KeyEvent.KEY_RELEASED -> "RELEASED"
        java.awt.event.KeyEvent.KEY_TYPED -> "TYPED"
        else -> "UNKNOWN($id)"
    }

    fun isRunning(): Boolean = running.get()

    fun getConnectionCount(): Int = connectionIds.size

    fun stopServer(): Boolean {
        LOG.info("CopilotWebSocketServer for project '${project.name}' stopping on port: $actualPort")

        workerExecutor.shutdown()
        scheduledExecutor.shutdown()

        try {
            if (!workerExecutor.awaitTermination(ServerConfig.EXECUTOR_SHUTDOWN_TIMEOUT_SEC, TimeUnit.SECONDS)) {
                LOG.warn("Worker executor did not terminate gracefully, forcing shutdown")
                workerExecutor.shutdownNow()
            }
            if (!scheduledExecutor.awaitTermination(ServerConfig.EXECUTOR_SHUTDOWN_TIMEOUT_SEC, TimeUnit.SECONDS)) {
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
            stop(ServerConfig.SERVER_STOP_TIMEOUT_MS)
        } catch (e: Exception) {
            LOG.warn("Error stopping server: ${e.message}")
        } finally {
            running.set(false)
        }
        return true
    }

    companion object {
        private val LOG = Logger.getInstance(CopilotWebSocketServer::class.java)
    }
}
