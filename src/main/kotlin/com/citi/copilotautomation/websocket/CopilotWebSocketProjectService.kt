package com.citi.copilotautomation.websocket

import com.citi.copilotautomation.config.ProjectAgentConfig
import com.citi.copilotautomation.core.ServerConfig
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import java.io.IOException
import java.net.BindException
import java.net.ServerSocket

@Service(Service.Level.PROJECT)
class CopilotWebSocketProjectService(
    private val project: Project
) : Disposable {

    private var server: CopilotWebSocketServer? = null
    private val serverLock = Any()

    init {
        ApplicationManager.getApplication().executeOnPooledThread {
            startServer()
        }
    }

    fun getPort(): Int = synchronized(serverLock) { server?.port ?: 0 }

    fun startServer(): Boolean = synchronized(serverLock) {
        LOG.info("Service [${System.identityHashCode(this)}] received start command for project '${project.name}'.")

        if (server != null && server!!.isRunning()) {
            LOG.info("Service [${System.identityHashCode(this)}] reports server is already running. Aborting start.")
            return true
        }

        stopServerInternal()

        return try {
            val projectRoot = project.basePath ?: return false
            val config = ProjectAgentConfig.load(projectRoot, project)
            var portToUse = 0

            if (config.port != null && config.port!! > 0 && isPortAvailable(config.port!!)) {
                portToUse = config.port!!
                LOG.info("Using port from config: $portToUse")
            } else {
                LOG.info("No valid port in config or port unavailable. Will use random port.")
            }

            var attempt = 0
            var started = false
            var lastException: Exception? = null

            while (attempt < ServerConfig.PORT_RETRY_ATTEMPTS && !started) {
                try {
                    server = CopilotWebSocketServer(portToUse, project)
                    LOG.debug("Service [${System.identityHashCode(this)}]: Created new server object. ID: ${System.identityHashCode(server)}")

                    started = server!!.startServerAndWait(ServerConfig.SERVER_START_TIMEOUT_MS)
                    if (started) {
                        val startedPort = server!!.port
                        LOG.info("Service [${System.identityHashCode(this)}]: SUCCESS. Server for project '${project.name}' started on port: $startedPort")

                        if (config.port != startedPort) {
                            config.port = startedPort
                            config.save(projectRoot)
                            LOG.info("Saved new port $startedPort to config file.")
                        }
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

    private fun isPortAvailable(port: Int): Boolean {
        return try {
            ServerSocket(port).close()
            true
        } catch (ignored: IOException) {
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

    override fun dispose() {
        stopServer()
    }

    companion object {
        private val LOG = Logger.getInstance(CopilotWebSocketProjectService::class.java)
    }
}
