package com.citi.copilotautomation.ui

import com.citi.copilotautomation.config.PortRegistry
import com.citi.copilotautomation.core.ServerConfig
import com.citi.copilotautomation.websocket.CopilotWebSocketProjectService
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.content.ContentFactory
import com.intellij.ui.table.JBTable
import java.awt.BorderLayout
import java.awt.Color
import java.awt.Component
import java.awt.Cursor
import java.awt.FlowLayout
import java.awt.Font
import java.awt.event.MouseAdapter
import java.awt.event.MouseEvent
import java.io.File
import java.net.Socket
import javax.swing.JButton
import javax.swing.JLabel
import javax.swing.JPanel
import javax.swing.JTable
import javax.swing.SwingConstants
import javax.swing.Timer
import javax.swing.table.AbstractTableModel
import javax.swing.table.DefaultTableCellRenderer

class PortDisplayToolWindowFactory : ToolWindowFactory, DumbAware {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val panel = RegistryDisplayPanel(project)
        val content = ContentFactory.getInstance().createContent(panel, "", false)
        toolWindow.contentManager.addContent(content)
    }
}

data class InstanceStatus(
    val instanceId: String,
    val projectPath: String,
    val projectName: String,
    val port: Int,
    val agentName: String?,
    val role: String?,
    val capabilities: List<String>?,
    val isRunning: Boolean,
    val connections: Int,
    val isCurrentInstance: Boolean,
    val pid: Long?
)

class RegistryTableModel : AbstractTableModel() {
    private val columns = arrayOf("Actions", "Status", "Project", "Port", "Role", "Capabilities", "Connections")
    private var instances: List<InstanceStatus> = emptyList()

    fun updateInstances(newInstances: List<InstanceStatus>) {
        instances = newInstances
        fireTableDataChanged()
    }

    override fun getRowCount(): Int = instances.size
    override fun getColumnCount(): Int = columns.size
    override fun getColumnName(column: Int): String = columns[column]

    override fun getValueAt(rowIndex: Int, columnIndex: Int): Any {
        val instance = instances[rowIndex]
        return when (columnIndex) {
            0 -> instance // Actions column - return full instance for buttons
            1 -> instance.isRunning
            2 -> if (instance.isCurrentInstance) "${instance.projectName} ●" else instance.projectName
            3 -> if (instance.port > 0) instance.port.toString() else "---"
            4 -> instance.role ?: "---"
            5 -> instance.capabilities?.joinToString(", ") ?: "---"
            6 -> instance.connections.toString()
            else -> ""
        }
    }

    fun getInstanceAt(rowIndex: Int): InstanceStatus? = instances.getOrNull(rowIndex)
}

class ActionsCellRenderer : DefaultTableCellRenderer() {
    private val playButton = JLabel("▶")
    private val stopButton = JLabel("■")
    private val panel = JPanel(FlowLayout(FlowLayout.CENTER, 4, 0))

    init {
        playButton.font = Font("Dialog", Font.PLAIN, 12)
        playButton.foreground = Color(76, 175, 80) // Green
        playButton.cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
        playButton.toolTipText = "Open project in new IDE"

        stopButton.font = Font("Dialog", Font.PLAIN, 12)
        stopButton.foreground = Color(244, 67, 54) // Red
        stopButton.cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
        stopButton.toolTipText = "Close IDE instance"

        panel.isOpaque = true
        panel.add(playButton)
        panel.add(stopButton)
    }

    override fun getTableCellRendererComponent(
        table: JTable,
        value: Any?,
        isSelected: Boolean,
        hasFocus: Boolean,
        row: Int,
        column: Int
    ): Component {
        val instance = value as? InstanceStatus

        // Dim stop button if not running
        stopButton.foreground = if (instance?.isRunning == true) {
            Color(244, 67, 54) // Red
        } else {
            Color(150, 150, 150) // Gray
        }

        panel.background = if (isSelected) table.selectionBackground else table.background
        return panel
    }
}

class StatusCellRenderer : DefaultTableCellRenderer() {
    override fun getTableCellRendererComponent(
        table: JTable,
        value: Any?,
        isSelected: Boolean,
        hasFocus: Boolean,
        row: Int,
        column: Int
    ): Component {
        val component = super.getTableCellRendererComponent(table, "", isSelected, hasFocus, row, column)
        val label = component as JLabel
        label.horizontalAlignment = SwingConstants.CENTER

        val isRunning = value as? Boolean ?: false
        label.text = "●"
        label.font = Font("JetBrains Mono", Font.BOLD, 14)
        label.foreground = if (isRunning) Color(76, 175, 80) else Color(244, 67, 54)

        return label
    }
}

class ProjectCellRenderer : DefaultTableCellRenderer() {
    override fun getTableCellRendererComponent(
        table: JTable,
        value: Any?,
        isSelected: Boolean,
        hasFocus: Boolean,
        row: Int,
        column: Int
    ): Component {
        val component = super.getTableCellRendererComponent(table, value, isSelected, hasFocus, row, column)
        val label = component as JLabel

        val text = value as? String ?: ""
        if (text.endsWith(" ●")) {
            label.text = "${text.dropLast(2)} [THIS]"
            label.font = Font(label.font.name, Font.BOLD, label.font.size)
            label.foreground = Color(59, 130, 246) // Blue color
            label.toolTipText = "This is your current IDE instance"
        } else {
            label.font = Font(label.font.name, Font.PLAIN, label.font.size)
            label.foreground = if (isSelected) table.selectionForeground else table.foreground
            label.toolTipText = null
        }

        return label
    }
}

class RegistryDisplayPanel(private val project: Project) : JPanel(BorderLayout()) {

    private val tableModel = RegistryTableModel()
    private val table = JBTable(tableModel)
    private val restartButton = JButton("Restart Current")
    private val refreshButton = JButton("Refresh")
    private val cleanupButton = JButton("Cleanup Stale")
    private val statusLabel = JLabel("Loading...")

    private var isRestarting = false

    init {
        // Configure table
        table.apply {
            setShowGrid(false)
            rowHeight = 28
            tableHeader.reorderingAllowed = false

            // Set column widths
            columnModel.getColumn(0).preferredWidth = 60   // Actions
            columnModel.getColumn(0).maxWidth = 70
            columnModel.getColumn(1).preferredWidth = 50   // Status
            columnModel.getColumn(1).maxWidth = 60
            columnModel.getColumn(2).preferredWidth = 150  // Project
            columnModel.getColumn(3).preferredWidth = 60   // Port
            columnModel.getColumn(3).maxWidth = 70
            columnModel.getColumn(4).preferredWidth = 80   // Role
            columnModel.getColumn(4).maxWidth = 100
            columnModel.getColumn(5).preferredWidth = 120  // Capabilities
            columnModel.getColumn(6).preferredWidth = 70   // Connections
            columnModel.getColumn(6).maxWidth = 80

            // Custom renderers
            columnModel.getColumn(0).cellRenderer = ActionsCellRenderer()
            columnModel.getColumn(1).cellRenderer = StatusCellRenderer()
            columnModel.getColumn(2).cellRenderer = ProjectCellRenderer()

            // Handle clicks on action buttons
            addMouseListener(object : MouseAdapter() {
                override fun mouseClicked(e: MouseEvent) {
                    val row = rowAtPoint(e.point)
                    val col = columnAtPoint(e.point)

                    if (row >= 0 && col == 0) {
                        val cellRect = getCellRect(row, col, false)
                        val relativeX = e.x - cellRect.x

                        val instance = tableModel.getInstanceAt(row) ?: return

                        // Approximate button positions (play ~15-25, stop ~35-45)
                        when {
                            relativeX in 10..30 -> openProject(instance)
                            relativeX in 35..55 -> stopInstance(instance)
                        }
                    }
                }
            })
        }

        // Button panel
        val buttonPanel = JPanel(FlowLayout(FlowLayout.LEFT, 10, 5))
        restartButton.apply {
            toolTipText = "Restart the WebSocket server for the current instance"
            cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
            addActionListener { restartCurrentServer() }
        }
        refreshButton.apply {
            toolTipText = "Refresh registry status"
            cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
            addActionListener { updateStatus() }
        }
        cleanupButton.apply {
            toolTipText = "Remove stale entries from dead processes"
            cursor = Cursor.getPredefinedCursor(Cursor.HAND_CURSOR)
            addActionListener { cleanupStale() }
        }

        buttonPanel.add(restartButton)
        buttonPanel.add(refreshButton)
        buttonPanel.add(cleanupButton)
        buttonPanel.add(statusLabel)

        // Layout
        add(JBScrollPane(table), BorderLayout.CENTER)
        add(buttonPanel, BorderLayout.SOUTH)

        // Initial update
        updateStatus()

        // Continuous polling
        val timer = Timer(ServerConfig.UI_POLL_INTERVAL_MS) {
            updateStatus()
        }
        timer.start()
    }

    private fun openProject(instanceStatus: InstanceStatus) {
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                val projectPath = instanceStatus.projectPath

                // Try different ways to open IntelliJ
                val commands = listOf(
                    listOf("idea", projectPath),
                    listOf("open", "-a", "IntelliJ IDEA", projectPath),
                    listOf("open", "-a", "IntelliJ IDEA Ultimate", projectPath),
                    listOf("open", "-a", "IntelliJ IDEA CE", projectPath)
                )

                var success = false
                for (cmd in commands) {
                    try {
                        val process = ProcessBuilder(cmd)
                            .redirectErrorStream(true)
                            .start()

                        // Don't wait for IDE to fully start, just check if command was accepted
                        Thread.sleep(500)
                        if (process.isAlive || process.exitValue() == 0) {
                            success = true
                            break
                        }
                    } catch (e: Exception) {
                        // Try next command
                    }
                }

                if (!success) {
                    ApplicationManager.getApplication().invokeLater {
                        statusLabel.text = "Failed to open project"
                    }
                }
            } catch (e: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    statusLabel.text = "Error: ${e.message}"
                }
            }
        }
    }

    private fun stopInstance(instanceStatus: InstanceStatus) {
        if (!instanceStatus.isRunning) {
            statusLabel.text = "Instance not running"
            return
        }

        if (instanceStatus.isCurrentInstance) {
            // For current instance, just stop the server
            ApplicationManager.getApplication().executeOnPooledThread {
                try {
                    val service = project.getService(CopilotWebSocketProjectService::class.java)
                    service?.stopServer()
                    ApplicationManager.getApplication().invokeLater {
                        statusLabel.text = "Server stopped for current instance"
                        Timer(1000) { updateStatus() }.apply { isRepeats = false; start() }
                    }
                } catch (e: Exception) {
                    ApplicationManager.getApplication().invokeLater {
                        statusLabel.text = "Error: ${e.message}"
                    }
                }
            }
            return
        }

        // For other instances, we can only remove from registry
        // Killing the process would close ALL windows in that process
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                // Remove from registry - the instance will appear as "not running"
                PortRegistry.removeInstance(instanceStatus.instanceId)
                ApplicationManager.getApplication().invokeLater {
                    statusLabel.text = "Removed ${instanceStatus.projectName} from registry"
                    Timer(1000) { updateStatus() }.apply { isRepeats = false; start() }
                }
            } catch (e: Exception) {
                ApplicationManager.getApplication().invokeLater {
                    statusLabel.text = "Error: ${e.message}"
                }
            }
        }
    }

    private fun findIdeaParentPid(pid: Int): Int? {
        try {
            var currentPid = pid
            var iterations = 0

            while (iterations < 10) {
                val psProcess = ProcessBuilder("ps", "-o", "ppid=,comm=", "-p", currentPid.toString())
                    .redirectErrorStream(true)
                    .start()

                val output = psProcess.inputStream.bufferedReader().readText().trim()
                if (output.isBlank()) break

                val parts = output.split(Regex("\\s+"), 2)
                if (parts.size < 2) break

                val ppid = parts[0].trim().toIntOrNull() ?: break
                val comm = parts[1].trim().lowercase()

                if (comm.contains("idea") || comm.contains("intellij")) {
                    return currentPid
                }

                if (ppid <= 1) {
                    return currentPid
                }

                currentPid = ppid
                iterations++
            }

            return pid
        } catch (e: Exception) {
            return null
        }
    }

    private fun cleanupStale() {
        ApplicationManager.getApplication().executeOnPooledThread {
            PortRegistry.cleanupStaleEntries()
            ApplicationManager.getApplication().invokeLater {
                statusLabel.text = "Cleaned up stale entries"
                updateStatus()
            }
        }
    }

    private fun restartCurrentServer() {
        if (isRestarting) return

        isRestarting = true
        restartButton.isEnabled = false
        restartButton.text = "Restarting..."
        statusLabel.text = "Restarting server..."

        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                val service = project.getService(CopilotWebSocketProjectService::class.java)
                service?.stopServer()
                Thread.sleep(500)
                service?.startServer()
            } finally {
                ApplicationManager.getApplication().invokeLater {
                    isRestarting = false
                    restartButton.text = "Restart Current"
                    restartButton.isEnabled = true
                    updateStatus()
                }
            }
        }
    }

    private fun updateStatus() {
        ApplicationManager.getApplication().executeOnPooledThread {
            val currentService = project.getService(CopilotWebSocketProjectService::class.java)
            val currentInstanceId = currentService?.instanceId

            val registry = PortRegistry.getAllInstances()
            val statuses = registry.map { (instanceId, entry) ->
                val isCurrentInstance = instanceId == currentInstanceId
                val projectName = File(entry.projectPath).name

                val (isRunning, connections) = if (isCurrentInstance && currentService != null) {
                    Pair(currentService.isServerRunning(), currentService.getConnectionCount())
                } else {
                    Pair(isPortResponding(entry.port), 0)
                }

                InstanceStatus(
                    instanceId = instanceId,
                    projectPath = entry.projectPath,
                    projectName = projectName,
                    port = entry.port,
                    agentName = entry.agentName,
                    role = entry.role,
                    capabilities = entry.capabilities,
                    isRunning = isRunning,
                    connections = connections,
                    isCurrentInstance = isCurrentInstance,
                    pid = entry.pid
                )
            }.sortedWith(compareBy({ !it.isCurrentInstance }, { it.projectName }))

            ApplicationManager.getApplication().invokeLater {
                tableModel.updateInstances(statuses)

                val runningCount = statuses.count { it.isRunning }
                statusLabel.text = "${statuses.size} instances, $runningCount running"
            }
        }
    }

    private fun isPortResponding(port: Int): Boolean {
        if (port <= 0) return false
        return try {
            Socket("localhost", port).use { true }
        } catch (e: Exception) {
            false
        }
    }
}
