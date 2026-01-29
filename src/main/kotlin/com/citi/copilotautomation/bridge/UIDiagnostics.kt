package com.citi.copilotautomation.bridge

import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.WindowManager
import java.awt.Component
import java.awt.Container

/**
 * Diagnostic utilities to discover UI component class names.
 * Use this when Copilot updates break the UI automation.
 */
object UIDiagnostics {
    private val LOG = Logger.getInstance(UIDiagnostics::class.java)

    /**
     * Dump all component class names in the Copilot chat tool window.
     * Returns a map of class name -> count for analysis.
     */
    fun dumpCopilotUIComponents(project: Project): Map<String, Int> {
        val classNameCounts = mutableMapOf<String, Int>()

        val toolWindow = ToolWindowManager.getInstance(project)
            .getToolWindow(CopilotClassNames.TOOL_WINDOW_ID)

        if (toolWindow == null) {
            LOG.warn("dumpCopilotUIComponents: Tool window '${CopilotClassNames.TOOL_WINDOW_ID}' not found")
            return emptyMap()
        }

        val content = toolWindow.contentManager.getContent(0)
        if (content == null) {
            LOG.warn("dumpCopilotUIComponents: No content in tool window")
            return emptyMap()
        }

        collectClassNames(content.component, classNameCounts)

        // Also try from IDE frame root
        val frame = WindowManager.getInstance().getIdeFrame(project)
        if (frame != null) {
            try {
                val rootComponent = frame.javaClass.getMethod("getComponent").invoke(frame) as? Component
                if (rootComponent != null) {
                    collectClassNames(rootComponent, classNameCounts, filterPrefix = "com.github.copilot")
                }
            } catch (e: Exception) {
                LOG.debug("Could not get root component from frame: ${e.message}")
            }
        }

        return classNameCounts.toSortedMap()
    }

    private fun collectClassNames(
        comp: Component?,
        counts: MutableMap<String, Int>,
        filterPrefix: String? = null
    ) {
        if (comp == null) return

        val className = comp.javaClass.name
        if (filterPrefix == null || className.startsWith(filterPrefix)) {
            counts[className] = (counts[className] ?: 0) + 1
        }

        if (comp is Container) {
            for (child in comp.components) {
                collectClassNames(child, counts, filterPrefix)
            }
        }
    }

    /**
     * Find components that look like combo boxes or dropdowns.
     */
    fun findComboBoxLikeComponents(project: Project): List<String> {
        val components = mutableListOf<String>()

        val toolWindow = ToolWindowManager.getInstance(project)
            .getToolWindow(CopilotClassNames.TOOL_WINDOW_ID) ?: return emptyList()

        val content = toolWindow.contentManager.getContent(0) ?: return emptyList()

        findComponentsMatching(content.component, components) { className ->
            className.contains("Combo", ignoreCase = true) ||
            className.contains("Dropdown", ignoreCase = true) ||
            className.contains("Select", ignoreCase = true) ||
            className.contains("Picker", ignoreCase = true) ||
            className.contains("Choice", ignoreCase = true)
        }

        return components.distinct()
    }

    /**
     * Find components that look like action buttons.
     */
    fun findActionButtonComponents(project: Project): List<String> {
        val components = mutableListOf<String>()

        val toolWindow = ToolWindowManager.getInstance(project)
            .getToolWindow(CopilotClassNames.TOOL_WINDOW_ID) ?: return emptyList()

        val content = toolWindow.contentManager.getContent(0) ?: return emptyList()

        findComponentsMatching(content.component, components) { className ->
            className.contains("Button", ignoreCase = true) ||
            className.contains("Action", ignoreCase = true)
        }

        return components.distinct()
    }

    /**
     * Find components that look like text input areas.
     */
    fun findTextInputComponents(project: Project): List<String> {
        val components = mutableListOf<String>()

        val toolWindow = ToolWindowManager.getInstance(project)
            .getToolWindow(CopilotClassNames.TOOL_WINDOW_ID) ?: return emptyList()

        val content = toolWindow.contentManager.getContent(0) ?: return emptyList()

        findComponentsMatching(content.component, components) { className ->
            className.contains("Text", ignoreCase = true) ||
            className.contains("Input", ignoreCase = true) ||
            className.contains("Editor", ignoreCase = true) ||
            className.contains("Field", ignoreCase = true)
        }

        return components.distinct()
    }

    private fun findComponentsMatching(
        comp: Component?,
        result: MutableList<String>,
        predicate: (String) -> Boolean
    ) {
        if (comp == null) return

        val className = comp.javaClass.name
        if (predicate(className)) {
            result.add(className)
        }

        if (comp is Container) {
            for (child in comp.components) {
                findComponentsMatching(child, result, predicate)
            }
        }
    }

    /**
     * Generate a diagnostic report as a formatted string.
     */
    fun generateDiagnosticReport(project: Project): String {
        val sb = StringBuilder()
        sb.appendLine("=== Copilot UI Diagnostics Report ===")
        sb.appendLine()

        sb.appendLine("--- Combo Box / Dropdown Components ---")
        findComboBoxLikeComponents(project).forEach { sb.appendLine("  $it") }
        sb.appendLine()

        sb.appendLine("--- Button / Action Components ---")
        findActionButtonComponents(project).forEach { sb.appendLine("  $it") }
        sb.appendLine()

        sb.appendLine("--- Text Input Components ---")
        findTextInputComponents(project).forEach { sb.appendLine("  $it") }
        sb.appendLine()

        sb.appendLine("--- All Copilot Components (com.github.copilot.*) ---")
        val copilotComponents = dumpCopilotUIComponents(project)
            .filter { it.key.startsWith("com.github.copilot") }
        copilotComponents.forEach { (name, count) ->
            sb.appendLine("  [$count] $name")
        }

        return sb.toString()
    }
}
