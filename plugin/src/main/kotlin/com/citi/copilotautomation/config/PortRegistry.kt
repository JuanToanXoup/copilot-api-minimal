package com.citi.copilotautomation.config

import com.citi.copilotautomation.core.JsonUtil
import com.fasterxml.jackson.module.kotlin.readValue
import com.intellij.openapi.diagnostic.Logger
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.time.Instant
import java.util.UUID
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

/**
 * Centralized port registry stored at ~/.citi-agent/registry.json.
 * Supports multiple instances of the same project, each with its own port.
 * Thread-safe using JVM-level locking.
 */
object PortRegistry {
    private val LOG = Logger.getInstance(PortRegistry::class.java)
    private const val REGISTRY_DIR = ".citi-agent"
    private const val REGISTRY_FILE = "registry.json"

    private val lock = ReentrantReadWriteLock()

    data class PortEntry(
        val projectPath: String,
        val port: Int,
        val lastStarted: String,
        val agentName: String? = null,
        val agentDescription: String? = null,
        val pid: Long? = null,  // Process ID for identifying the IDE instance
        val role: String? = null,  // Agent role: "coder", "tester", "reviewer", "docs", etc.
        val capabilities: List<String>? = null,  // Skills: ["kotlin", "python", "testing", "refactoring"]
        val systemPrompt: String? = null,  // Custom system prompt for this agent's behavior
        val busy: Boolean = false  // Whether this agent is currently processing a prompt
    )

    private fun getRegistryPath(): Path {
        val home = System.getProperty("user.home")
        return Paths.get(home, REGISTRY_DIR, REGISTRY_FILE)
    }

    private fun ensureRegistryDir() {
        val registryPath = getRegistryPath()
        val dir = registryPath.parent
        if (!Files.exists(dir)) {
            Files.createDirectories(dir)
            LOG.info("[PortRegistry] Created registry directory: $dir")
        }
    }

    // Old format entry (for migration)
    private data class OldPortEntry(
        val port: Int,
        val lastStarted: String,
        val agentName: String? = null,
        val agentDescription: String? = null
    )

    private fun readRegistry(): MutableMap<String, PortEntry> {
        val registryPath = getRegistryPath()
        val file = registryPath.toFile()

        if (!file.exists()) {
            return mutableMapOf()
        }

        val content = file.readText()
        if (content.isBlank() || content == "{}") {
            return mutableMapOf()
        }

        // Try new format first
        return try {
            JsonUtil.mapper.readValue(content)
        } catch (e: Exception) {
            // Try migrating from old format
            LOG.info("[PortRegistry] Migrating from old registry format...")
            try {
                val oldRegistry: Map<String, OldPortEntry> = JsonUtil.mapper.readValue(content)
                val newRegistry = mutableMapOf<String, PortEntry>()

                oldRegistry.forEach { (projectPath, oldEntry) ->
                    val instanceId = generateInstanceId()
                    newRegistry[instanceId] = PortEntry(
                        projectPath = projectPath,
                        port = oldEntry.port,
                        lastStarted = oldEntry.lastStarted,
                        agentName = oldEntry.agentName,
                        agentDescription = oldEntry.agentDescription,
                        pid = null
                    )
                }

                // Write migrated registry
                writeRegistry(newRegistry)
                LOG.info("[PortRegistry] Migration complete. Converted ${newRegistry.size} entries.")
                newRegistry
            } catch (e2: Exception) {
                LOG.error("[PortRegistry] Failed to migrate registry: ${e2.message}")
                // Start fresh if migration fails
                mutableMapOf()
            }
        }
    }

    private fun writeRegistry(registry: Map<String, PortEntry>) {
        ensureRegistryDir()
        val registryPath = getRegistryPath()
        val content = JsonUtil.prettyMapper.writeValueAsString(registry)
        registryPath.toFile().writeText(content)
    }

    /**
     * Generate a new unique instance ID.
     */
    fun generateInstanceId(): String = UUID.randomUUID().toString()

    /**
     * Get the current process ID.
     */
    private fun getCurrentPid(): Long = ProcessHandle.current().pid()

    /**
     * Get the port for an instance.
     */
    fun getPort(instanceId: String): Int? {
        return try {
            lock.read {
                readRegistry()[instanceId]?.port
            }
        } catch (e: Exception) {
            LOG.warn("[PortRegistry] Error reading port for instance $instanceId: ${e.message}")
            null
        }
    }

    /**
     * Register a new instance with its port.
     */
    fun registerInstance(
        instanceId: String,
        projectPath: String,
        port: Int,
        agentName: String? = null,
        agentDescription: String? = null,
        role: String? = null,
        capabilities: List<String>? = null,
        systemPrompt: String? = null
    ) {
        try {
            lock.write {
                val registry = readRegistry()
                registry[instanceId] = PortEntry(
                    projectPath = projectPath,
                    port = port,
                    lastStarted = Instant.now().toString(),
                    agentName = agentName ?: "Default Agent",
                    agentDescription = agentDescription ?: "Default description",
                    pid = getCurrentPid(),
                    role = role,
                    capabilities = capabilities,
                    systemPrompt = systemPrompt
                )
                writeRegistry(registry)
                LOG.info("[PortRegistry] Registered instance $instanceId with port $port, role=$role for project: $projectPath")
            }
        } catch (e: Exception) {
            LOG.error("[PortRegistry] Error registering instance $instanceId: ${e.message}", e)
        }
    }

    /**
     * Update port for an existing instance.
     */
    fun setPort(instanceId: String, port: Int) {
        try {
            lock.write {
                val registry = readRegistry()
                val existing = registry[instanceId]
                if (existing != null) {
                    registry[instanceId] = existing.copy(
                        port = port,
                        lastStarted = Instant.now().toString(),
                        pid = getCurrentPid()
                    )
                    writeRegistry(registry)
                    LOG.info("[PortRegistry] Updated port to $port for instance: $instanceId")
                }
            }
        } catch (e: Exception) {
            LOG.error("[PortRegistry] Error setting port for instance $instanceId: ${e.message}", e)
        }
    }

    /**
     * Update busy state for an instance.
     */
    fun setBusy(instanceId: String, busy: Boolean) {
        try {
            lock.write {
                val registry = readRegistry()
                val existing = registry[instanceId]
                if (existing != null) {
                    registry[instanceId] = existing.copy(busy = busy)
                    writeRegistry(registry)
                }
            }
        } catch (e: Exception) {
            LOG.warn("[PortRegistry] Error setting busy for instance $instanceId: ${e.message}")
        }
    }

    /**
     * Get the full entry for an instance.
     */
    fun getEntry(instanceId: String): PortEntry? {
        return try {
            lock.read {
                readRegistry()[instanceId]
            }
        } catch (e: Exception) {
            LOG.warn("[PortRegistry] Error reading entry for instance $instanceId: ${e.message}")
            null
        }
    }

    /**
     * Update agent configuration for an instance.
     */
    fun setAgentConfig(
        instanceId: String,
        agentName: String? = null,
        agentDescription: String? = null,
        role: String? = null,
        capabilities: List<String>? = null,
        systemPrompt: String? = null
    ) {
        try {
            lock.write {
                val registry = readRegistry()
                val existing = registry[instanceId]
                if (existing != null) {
                    // If role is being set and agentName is still "Default Agent", use role as agentName
                    val effectiveAgentName = when {
                        agentName != null -> agentName
                        role != null && (existing.agentName == null || existing.agentName == "Default Agent") -> role
                        else -> existing.agentName
                    }
                    registry[instanceId] = existing.copy(
                        agentName = effectiveAgentName,
                        agentDescription = agentDescription ?: existing.agentDescription,
                        role = role ?: existing.role,
                        capabilities = capabilities ?: existing.capabilities,
                        systemPrompt = systemPrompt ?: existing.systemPrompt
                    )
                    writeRegistry(registry)
                    LOG.info("[PortRegistry] Set agent config for instance: $instanceId (agentName=$effectiveAgentName, role=$role)")
                }
            }
        } catch (e: Exception) {
            LOG.error("[PortRegistry] Error setting agent config for instance $instanceId: ${e.message}", e)
        }
    }

    /**
     * Find all agents with a specific role.
     */
    fun findAgentsByRole(role: String): Map<String, PortEntry> {
        return try {
            lock.read {
                readRegistry().filter { it.value.role?.equals(role, ignoreCase = true) == true }
            }
        } catch (e: Exception) {
            LOG.warn("[PortRegistry] Error finding agents by role $role: ${e.message}")
            emptyMap()
        }
    }

    /**
     * Find all agents that have a specific capability.
     */
    fun findAgentsByCapability(capability: String): Map<String, PortEntry> {
        return try {
            lock.read {
                readRegistry().filter { entry ->
                    entry.value.capabilities?.any { it.equals(capability, ignoreCase = true) } == true
                }
            }
        } catch (e: Exception) {
            LOG.warn("[PortRegistry] Error finding agents by capability $capability: ${e.message}")
            emptyMap()
        }
    }

    /**
     * Find all agents that have any of the specified capabilities.
     */
    fun findAgentsByCapabilities(capabilities: List<String>): Map<String, PortEntry> {
        return try {
            lock.read {
                val lowerCaps = capabilities.map { it.lowercase() }
                readRegistry().filter { entry ->
                    entry.value.capabilities?.any { cap -> lowerCaps.contains(cap.lowercase()) } == true
                }
            }
        } catch (e: Exception) {
            LOG.warn("[PortRegistry] Error finding agents by capabilities: ${e.message}")
            emptyMap()
        }
    }

    /**
     * Get all available roles across all agents.
     */
    fun getAllRoles(): Set<String> {
        return try {
            lock.read {
                readRegistry().values.mapNotNull { it.role }.toSet()
            }
        } catch (e: Exception) {
            LOG.warn("[PortRegistry] Error getting all roles: ${e.message}")
            emptySet()
        }
    }

    /**
     * Get all available capabilities across all agents.
     */
    fun getAllCapabilities(): Set<String> {
        return try {
            lock.read {
                readRegistry().values.flatMap { it.capabilities ?: emptyList() }.toSet()
            }
        } catch (e: Exception) {
            LOG.warn("[PortRegistry] Error getting all capabilities: ${e.message}")
            emptySet()
        }
    }

    /**
     * Remove an instance from the registry.
     */
    fun removeInstance(instanceId: String) {
        try {
            lock.write {
                val registry = readRegistry()
                if (registry.remove(instanceId) != null) {
                    writeRegistry(registry)
                    LOG.info("[PortRegistry] Removed instance from registry: $instanceId")
                }
            }
        } catch (e: Exception) {
            LOG.warn("[PortRegistry] Error removing instance $instanceId: ${e.message}")
        }
    }

    /**
     * Get all registered instances.
     */
    fun getAllInstances(): Map<String, PortEntry> {
        return try {
            lock.read {
                readRegistry().toMap()
            }
        } catch (e: Exception) {
            LOG.warn("[PortRegistry] Error reading all instances: ${e.message}")
            emptyMap()
        }
    }

    /**
     * Get all instances for a specific project path.
     */
    fun getInstancesForProject(projectPath: String): Map<String, PortEntry> {
        return try {
            lock.read {
                readRegistry().filter { it.value.projectPath == projectPath }
            }
        } catch (e: Exception) {
            LOG.warn("[PortRegistry] Error reading instances for project $projectPath: ${e.message}")
            emptyMap()
        }
    }

    /**
     * Clean up stale entries (where the process is no longer running).
     */
    fun cleanupStaleEntries() {
        try {
            lock.write {
                val registry = readRegistry()
                val staleIds = registry.filter { (_, entry) ->
                    entry.pid != null && !isProcessRunning(entry.pid)
                }.keys

                if (staleIds.isNotEmpty()) {
                    staleIds.forEach { registry.remove(it) }
                    writeRegistry(registry)
                    LOG.info("[PortRegistry] Cleaned up ${staleIds.size} stale entries")
                }
            }
        } catch (e: Exception) {
            LOG.warn("[PortRegistry] Error cleaning up stale entries: ${e.message}")
        }
    }

    private fun isProcessRunning(pid: Long): Boolean {
        return try {
            ProcessHandle.of(pid).map { it.isAlive }.orElse(false)
        } catch (e: Exception) {
            false
        }
    }
}
