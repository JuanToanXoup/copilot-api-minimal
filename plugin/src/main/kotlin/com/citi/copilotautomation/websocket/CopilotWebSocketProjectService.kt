package com.citi.copilotautomation.websocket

import com.citi.copilotautomation.config.PortRegistry
import com.citi.copilotautomation.core.ServerConfig
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import java.net.BindException
import java.net.ServerSocket

@Service(Service.Level.PROJECT)
class CopilotWebSocketProjectService(
    private val project: Project
) : Disposable {

    private var server: CopilotWebSocketServer? = null
    private val serverLock = Any()

    // Unique instance ID for this IDE instance
    val instanceId: String = PortRegistry.generateInstanceId()

    init {
        // Clean up stale entries on startup
        PortRegistry.cleanupStaleEntries()

        ApplicationManager.getApplication().executeOnPooledThread {
            startServer()
        }
    }

    fun getPort(): Int = synchronized(serverLock) { server?.port ?: 0 }

    fun startServer(): Boolean = synchronized(serverLock) {
        LOG.info("Service [${System.identityHashCode(this)}] received start command for project '${project.name}'. Instance: $instanceId")

        if (server != null && server!!.isRunning()) {
            LOG.info("Service [${System.identityHashCode(this)}] reports server is already running. Aborting start.")
            return true
        }

        stopServerInternal()

        return try {
            val projectRoot = project.basePath ?: return false
            var portToUse = 0

            // Check if we have a port from a previous run of this instance
            val registryPort = PortRegistry.getPort(instanceId)
            if (registryPort != null && registryPort > 0) {
                portToUse = registryPort
                LOG.info("Using port from registry: $portToUse")
            } else {
                LOG.info("No existing port for this instance. Will use random port.")
            }

            var attempt = 0
            var started = false
            var lastException: Exception? = null

            while (attempt < ServerConfig.PORT_RETRY_ATTEMPTS && !started) {
                try {
                    server = CopilotWebSocketServer(portToUse, project, instanceId)
                    LOG.debug("Service [${System.identityHashCode(this)}]: Created new server object. ID: ${System.identityHashCode(server)}")

                    started = server!!.startServerAndWait(ServerConfig.SERVER_START_TIMEOUT_MS)
                    if (started) {
                        val startedPort = server!!.port
                        LOG.info("Service [${System.identityHashCode(this)}]: SUCCESS. Server for project '${project.name}' started on port: $startedPort")

                        // Register this instance in the registry
                        PortRegistry.registerInstance(
                            instanceId = instanceId,
                            projectPath = projectRoot,
                            port = startedPort,
                            agentName = "Default Agent",
                            agentDescription = "Default description"
                        )
                        LOG.info("Registered instance $instanceId with port $startedPort")
                        return true
                    } else {
                        LOG.error("Service [${System.identityHashCode(this)}]: FAILED. Server did not start within the timeout.")
                        stopServerInternal()
                        return false
                    }
                } catch (be: BindException) {
                    LOG.error("Port $portToUse is already in use (BindException). Retrying with a new port.", be)
                    ServerSocket(0).use { s ->
                        portToUse = s.localPort
                    }
                    LOG.info("Selected new random available port: $portToUse")
                    attempt++
                    lastException = be
                    stopServerInternal()
                } catch (e: Exception) {
                    LOG.error("Service [${System.identityHashCode(this)}]: EXCEPTION during server start.", e)
                    stopServerInternal()
                    return false
                }
            }

            if (!started && lastException != null) {
                LOG.error("Service [${System.identityHashCode(this)}]: Could not start server after ${ServerConfig.PORT_RETRY_ATTEMPTS} attempts.", lastException)
            }
            false
        } catch (e: Exception) {
            LOG.error("Service [${System.identityHashCode(this)}]: EXCEPTION during server start.", e)
            stopServerInternal()
            false
        }
    }

    fun stopServer() = synchronized(serverLock) {
        stopServerInternal()
    }

    private fun stopServerInternal() {
        LOG.debug("Service [${System.identityHashCode(this)}] received stop command.")
        val serverToStop = server
        if (serverToStop != null) {
            LOG.debug("Service [${System.identityHashCode(this)}] is stopping server instance [${System.identityHashCode(serverToStop)}].")
            try {
                serverToStop.stopServer()
            } catch (e: Exception) {
                LOG.warn("Exception while stopping server: ${e.message}")
            }
            server = null
            LOG.info("CopilotWebSocketProjectService: Server stopped and port released.")
        } else {
            LOG.debug("CopilotWebSocketProjectService: No server instance to stop.")
        }
    }

    fun getCurrentPrompt(): String? = synchronized(serverLock) { server?.getCurrentPrompt() }

    fun getPendingPrompts(): List<String> = synchronized(serverLock) { server?.getPendingPrompts() ?: emptyList() }

    fun getWebSocketServer(): CopilotWebSocketServer? = synchronized(serverLock) { server }

    fun isServerRunning(): Boolean = synchronized(serverLock) { server?.isRunning() ?: false }

    fun getConnectionCount(): Int = synchronized(serverLock) { server?.getConnectionCount() ?: 0 }

    override fun dispose() {
        stopServer()
        // Remove this instance from the registry
        PortRegistry.removeInstance(instanceId)
        LOG.info("Disposed service and removed instance $instanceId from registry")
    }

    companion object {
        private val LOG = Logger.getInstance(CopilotWebSocketProjectService::class.java)
    }
}
