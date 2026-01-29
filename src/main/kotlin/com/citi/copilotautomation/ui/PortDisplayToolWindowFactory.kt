package com.citi.copilotautomation.ui

import com.citi.copilotautomation.core.ServerConfig
import com.citi.copilotautomation.websocket.CopilotWebSocketProjectService
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import java.awt.Color
import java.awt.Cursor
import java.awt.FlowLayout
import java.awt.Font
import javax.swing.JButton
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.Timer

class PortDisplayToolWindowFactory : ToolWindowFactory, DumbAware {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = PortDisplayPanel(project)
        val content = ContentFactory.getInstance().createContent(panel, "", false)
        toolWindow.contentManager.addContent(content)
    }
}

class PortDisplayPanel(private val project: Project) : JPanel(FlowLayout(FlowLayout.LEFT, 15, 5)) {

    private val portLabel = JLabel("Port: Starting...")
    private val statusIndicator = JLabel("\u2022") // Unicode bullet
    private val statusLabel = JLabel("Starting")
    private val connectionsLabel = JLabel("Connections: 0")
    private val restartButton = JButton("Restart")

    private val font = Font("JetBrains Mono", Font.BOLD, 14)

    private var isRestarting = false

    init {
        portLabel.font = font
        statusIndicator.font = Font("JetBrains Mono", Font.BOLD, 18)
        statusLabel.font = font
        connectionsLabel.font = font
        restartButton.font = Font("JetBrains Mono", Font.PLAIN, 12)

        // Initial state - yellow for starting
        statusIndicator.foreground = Color(255, 193, 7) // Amber/Yellow

        // Configure restart button
        restartButton.isVisible = false
        restartButton.toolTipText = "Restart the WebSocket server"
        restartButton.cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
        restartButton.addActionListener { restartServer() }

        add(portLabel)
        add(statusIndicator)
        add(statusLabel)
        add(connectionsLabel)
        add(restartButton)

        // Continuous polling for status updates
        val timer = Timer(ServerConfig.UI_POLL_INTERVAL_MS) {
            updateStatus()
        }
        timer.start()
    }

    private fun restartServer() {
        if (isRestarting) return

        isRestarting = true
        restartButton.isEnabled = false
        restartButton.text = "Restarting..."
        statusLabel.text = "Restarting"
        statusIndicator.foreground = Color(255, 193, 7) // Amber/Yellow

        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                val service = project.getService(CopilotWebSocketProjectService::class.java)
                service?.stopServer()
                Thread.sleep(500) // Brief pause to ensure port is released
                service?.startServer()
            } finally {
                // Update UI on EDT
                ApplicationManager.getApplication().invokeLater {
                    isRestarting = false
                    restartButton.text = "Restart"
                    restartButton.isEnabled = true
                    updateStatus()
                }
            }
        }
    }

    private fun updateStatus() {
        val service = project.getService(CopilotWebSocketProjectService::class.java)

        if (service == null) {
            setFailedState()
            return
        }

        val port = service.getPort()
        val isRunning = service.isServerRunning()
        val connectionCount = service.getConnectionCount()

        if (port > 0 && isRunning) {
            portLabel.text = "Port: $port"
            statusLabel.text = "Running"
            statusIndicator.foreground = Color(76, 175, 80) // Green
            connectionsLabel.text = "Connections: $connectionCount"
            restartButton.isVisible = true
        } else if (port > 0 || !isRunning) {
            portLabel.text = if (port > 0) "Port: $port" else "Port: ---"
            if (!isRestarting) {
                statusLabel.text = "Stopped"
                statusIndicator.foreground = Color(244, 67, 54) // Red
            }
            connectionsLabel.text = "Connections: 0"
            restartButton.isVisible = true
        } else {
            portLabel.text = "Port: ---"
            statusLabel.text = "Starting"
            statusIndicator.foreground = Color(255, 193, 7) // Amber/Yellow
            connectionsLabel.text = "Connections: 0"
            restartButton.isVisible = false
        }
    }

    private fun setFailedState() {
        portLabel.text = "Port: Failed"
        statusLabel.text = "Error"
        statusIndicator.foreground = Color(244, 67, 54) // Red
        connectionsLabel.text = "Connections: 0"
        restartButton.isVisible = true
    }
}
