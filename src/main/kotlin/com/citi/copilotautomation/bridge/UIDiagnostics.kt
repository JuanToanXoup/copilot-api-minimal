package com.citi.copilotautomation.bridge

import com.citi.copilotautomation.core.ComponentFinder
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager

/**
 * Diagnostic utilities to discover UI component class names.
 * Use this when Copilot updates break the UI automation.
 */
object UIDiagnostics {
    private val LOG = Logger.getInstance(UIDiagnostics::class.java)

    /**
     * Dump all component class names in the Copilot chat tool window.
     */
    fun dumpCopilotUIComponents(project: Project): Map<String, Int> {
        val toolWindow = ToolWindowManager.getInstance(project)
            .getToolWindow(CopilotClassNames.TOOL_WINDOW_ID)

        if (toolWindow == null) {
            LOG.warn("dumpCopilotUIComponents: Tool window not found")
            return emptyMap()
        }

        val content = toolWindow.contentManager.getContent(0)
        if (content == null) {
            LOG.warn("dumpCopilotUIComponents: No content in tool window")
            return emptyMap()
        }

        return ComponentFinder.collectClassNames(content.component, filterPrefix = "com.github.copilot")
    }

    /**
     * Find components that look like combo boxes or dropdowns.
     */
    fun findComboBoxLikeComponents(project: Project): List<String> {
        val toolWindow = ToolWindowManager.getInstance(project)
            .getToolWindow(CopilotClassNames.TOOL_WINDOW_ID) ?: return emptyList()

        val content = toolWindow.contentManager.getContent(0) ?: return emptyList()

        return ComponentFinder.findByPredicate(content.component) { comp ->
            val name = comp.javaClass.name
            name.contains("Combo", ignoreCase = true) ||
                name.contains("Dropdown", ignoreCase = true) ||
                name.contains("Select", ignoreCase = true) ||
                name.contains("Picker", ignoreCase = true) ||
                name.contains("Choice", ignoreCase = true)
        }.map { it.javaClass.name }.distinct()
    }

    /**
     * Find components that look like action buttons.
     */
    fun findActionButtonComponents(project: Project): List<String> {
        val toolWindow = ToolWindowManager.getInstance(project)
            .getToolWindow(CopilotClassNames.TOOL_WINDOW_ID) ?: return emptyList()

        val content = toolWindow.contentManager.getContent(0) ?: return emptyList()

        return ComponentFinder.findByPredicate(content.component) { comp ->
            val name = comp.javaClass.name
            name.contains("Button", ignoreCase = true) ||
                name.contains("Action", ignoreCase = true)
        }.map { it.javaClass.name }.distinct()
    }

    /**
     * Find components that look like text input areas.
     */
    fun findTextInputComponents(project: Project): List<String> {
        val toolWindow = ToolWindowManager.getInstance(project)
            .getToolWindow(CopilotClassNames.TOOL_WINDOW_ID) ?: return emptyList()

        val content = toolWindow.contentManager.getContent(0) ?: return emptyList()

        return ComponentFinder.findByPredicate(content.component) { comp ->
            val name = comp.javaClass.name
            name.contains("Text", ignoreCase = true) ||
                name.contains("Input", ignoreCase = true) ||
                name.contains("Editor", ignoreCase = true) ||
                name.contains("Field", ignoreCase = true)
        }.map { it.javaClass.name }.distinct()
    }

    /**
     * Inspect the CopilotAgentInputTextArea to find text-setting methods.
     */
    fun inspectInputComponent(project: Project): String {
        val toolWindow = ToolWindowManager.getInstance(project)
            .getToolWindow(CopilotClassNames.TOOL_WINDOW_ID) ?: return "Tool window not found"

        val content = toolWindow.contentManager.getContent(0) ?: return "No content"

        val inputComp = ComponentFinder.findFirstByClassName(content.component, CopilotClassNames.AGENT_INPUT_TEXT_AREA)
            ?: return "CopilotAgentInputTextArea not found"

        val sb = StringBuilder()
        sb.appendLine("=== CopilotAgentInputTextArea Inspection ===")
        sb.appendLine("Class: ${inputComp.javaClass.name}")
        sb.appendLine("Superclass: ${inputComp.javaClass.superclass?.name}")
        sb.appendLine("Interfaces: ${inputComp.javaClass.interfaces.map { it.name }}")
        sb.appendLine()

        sb.appendLine("--- Methods containing 'text' or 'set' ---")
        inputComp.javaClass.methods
            .filter { it.name.contains("text", ignoreCase = true) || it.name.contains("set", ignoreCase = true) }
            .sortedBy { it.name }
            .forEach { sb.appendLine("  ${it.name}(${it.parameterTypes.map { p -> p.simpleName }.joinToString(", ")})") }

        sb.appendLine()
        sb.appendLine("--- Fields ---")
        inputComp.javaClass.declaredFields.forEach { sb.appendLine("  ${it.name}: ${it.type.simpleName}") }

        sb.appendLine()
        sb.appendLine("--- Children (if Container) ---")
        if (inputComp is java.awt.Container) {
            inputComp.components.forEach { child ->
                sb.appendLine("  ${child.javaClass.name}")
            }
        }

        return sb.toString()
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
        copilotComponents.forEach { (name, count) ->
            sb.appendLine("  [$count] $name")
        }

        return sb.toString()
    }
}
