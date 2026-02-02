package com.citi.agent

import com.citi.copilotautomation.websocket.CopilotWebSocketProjectService
import com.intellij.openapi.project.Project
import com.intellij.openapi.project.ProjectManagerListener

class AgentProjectManagerListener : ProjectManagerListener {
    override fun projectOpened(project: Project) {
        // Trigger service instantiation which auto-starts the WebSocket server
        project.getService(CopilotWebSocketProjectService::class.java)
    }

    override fun projectClosing(project: Project) {
        project.getService(CopilotWebSocketProjectService::class.java)?.dispose()
    }
}
