package com.citi.copilotautomation.config

import com.citi.copilotautomation.core.JsonUtil
import com.fasterxml.jackson.annotation.JsonIgnore
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import java.net.ServerSocket
import java.nio.file.Files
import java.nio.file.Paths

@Service(Service.Level.PROJECT)
class ProjectAgentConfig(
    @JsonIgnore
    var project: Project? = null
) {
    var agentName: String? = null
    var agentDescription: String? = null
    var port: Int? = null

    init {
        project?.let { proj ->
            val projectRoot = getProjectRoot(proj)
            LOG.info("[ProjectAgentConfig] Service constructor. projectRoot=$projectRoot")

            if (projectRoot != null) {
                val configFile = Paths.get(projectRoot, CONFIG_PATH)
                if (!Files.exists(configFile)) {
                    try {
                        agentName = "Default Agent"
                        agentDescription = "Default description"
                        port = 0

                        if (port == 0) {
                            ServerSocket(0).use { socket ->
                                port = socket.localPort
                            }
                            LOG.info("[ProjectAgentConfig] Dynamically assigned port: $port")
                        }
                        save(projectRoot)
                        LOG.info("[ProjectAgentConfig] Created config at: $configFile")
                    } catch (e: Exception) {
                        LOG.warn("[ProjectAgentConfig] Error creating config: $e", e)
                    }
                } else {
                    LOG.info("[ProjectAgentConfig] Config already exists at: $configFile")
                }
            } else {
                LOG.warn("[ProjectAgentConfig] Could not determine project root. Config file will not be created.")
            }
        }
    }

    fun save(projectRoot: String) {
        val configFile = Paths.get(projectRoot, CONFIG_PATH)
        Files.createDirectories(configFile.parent)
        JsonUtil.prettyMapper.writeValue(configFile.toFile(), this)
    }

    companion object {
        private val LOG = Logger.getInstance(ProjectAgentConfig::class.java)
        const val CONFIG_PATH = ".citi-agent/project-agent-config.json"

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

        fun load(projectRoot: String, project: Project? = null): ProjectAgentConfig {
            val configFile = Paths.get(projectRoot, CONFIG_PATH)
            if (!Files.exists(configFile)) {
                return ProjectAgentConfig(project)
            }

            val config = JsonUtil.mapper.readValue(configFile.toFile(), ProjectAgentConfig::class.java)
            config.project = project
            return config
        }
    }
}
