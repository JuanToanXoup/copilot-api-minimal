package com.citi.copilotautomation.config

import com.fasterxml.jackson.annotation.JsonIgnore
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
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
            logger.info("[ProjectAgentConfig] Service constructor. projectRoot=$projectRoot")

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
                            logger.info("[ProjectAgentConfig] Dynamically assigned port: $port")
                        }
                        save(projectRoot)
                        logger.info("[ProjectAgentConfig] Created config at: $configFile")
                    } catch (e: Exception) {
                        logger.warn("[ProjectAgentConfig] Error creating config: $e", e)
                    }
                } else {
                    logger.info("[ProjectAgentConfig] Config already exists at: $configFile")
                }
            } else {
                logger.warn("[ProjectAgentConfig] Could not determine project root. Config file will not be created.")
            }
        }
    }

    fun save(projectRoot: String) {
        val configFile = Paths.get(projectRoot, CONFIG_PATH)
        Files.createDirectories(configFile.parent)
        val mapper = ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT)
        mapper.writeValue(configFile.toFile(), this)
    }

    companion object {
        private val logger = Logger.getInstance(ProjectAgentConfig::class.java)
        const val CONFIG_PATH = ".citi-agent/project-agent-config.json"

        init {
            logger.info("[ProjectAgentConfig] Class loaded!")
        }

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

            val mapper = ObjectMapper()
            mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
            val config = mapper.readValue(configFile.toFile(), ProjectAgentConfig::class.java)
            config.project = project
            return config
        }
    }
}
