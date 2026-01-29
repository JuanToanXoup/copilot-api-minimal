package com.citi.copilotautomation.ui

import com.citi.copilotautomation.websocket.CopilotWebSocketProjectService
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory
import java.awt.FlowLayout
import java.awt.Font
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.Timer

class PortDisplayToolWindowFactory : ToolWindowFactory {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = PortDisplayPanel(project)
        val content = ContentFactory.getInstance().createContent(panel, "", false)
        toolWindow.contentManager.addContent(content)
    }
}

class PortDisplayPanel(private val project: Project) : JPanel(FlowLayout(FlowLayout.LEFT)) {

    private val portLabel = JLabel("WebSocket Port: Starting...")

    init {
        portLabel.font = Font("JetBrains Mono", Font.BOLD, 14)
        add(portLabel)

        // Poll for port until server starts (max 20 seconds)
        var attempts = 0
        val maxAttempts = 40
        val timer = Timer(500) { event ->
            val service = project.getService(CopilotWebSocketProjectService::class.java)
            val port = service?.getPort() ?: 0
            if (port > 0) {
                portLabel.text = "WebSocket Port: $port"
                (event.source as Timer).stop()
            } else {
                attempts++
                if (attempts >= maxAttempts) {
                    portLabel.text = "WebSocket Port: Failed to start"
                    (event.source as Timer).stop()
                }
            }
        }
        timer.start()
    }
}
