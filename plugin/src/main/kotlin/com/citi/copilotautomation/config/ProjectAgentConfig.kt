package com.citi.copilotautomation.config

import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import java.nio.file.Paths

/**
 * Project-level agent configuration helper.
 * Data is stored in the centralized registry at ~/.citi-agent/registry.json
 * Registration is handled by CopilotWebSocketProjectService.
 */
@Service(Service.Level.PROJECT)
class ProjectAgentConfig(
    private val project: Project? = null
) {
    companion object {
        private val LOG = Logger.getInstance(ProjectAgentConfig::class.java)

        fun getInstance(project: Project): ProjectAgentConfig {
            return project.getService(ProjectAgentConfig::class.java)
        }

        fun getProjectRoot(project: Project?): String? {
            if (project == null) return null

            var projectRoot = project.basePath
            if (projectRoot == null) {
                val projectFilePath = project.projectFilePath
                if (projectFilePath != null) {
                    val projectFile = Paths.get(projectFilePath)
                    val parent = projectFile.parent
                    if (parent != null) {
                        projectRoot = parent.toString()
                    }
                }
            }
            return projectRoot
        }
    }
}
