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
     * Inspect the ChatModeComboBox component to understand its API.
     */
    fun inspectChatModeComboBox(project: Project): String {
        val toolWindow = ToolWindowManager.getInstance(project)
            .getToolWindow(CopilotClassNames.TOOL_WINDOW_ID) ?: return "Tool window not found"

        val content = toolWindow.contentManager.getContent(0) ?: return "No content"

        val comboBox = ComponentFinder.findFirstByClassName(content.component, CopilotClassNames.CHAT_MODE_COMBO_BOX)
            ?: return "ChatModeComboBox not found"

        val sb = StringBuilder()
        sb.appendLine("=== ChatModeComboBox Inspection ===")
        sb.appendLine("Class: ${comboBox.javaClass.name}")
        sb.appendLine("Superclass: ${comboBox.javaClass.superclass?.name}")
        sb.appendLine("Super-superclass: ${comboBox.javaClass.superclass?.superclass?.name}")
        sb.appendLine("Interfaces: ${comboBox.javaClass.interfaces.map { it.name }}")
        sb.appendLine()

        // Try to get current state
        sb.appendLine("--- Current State ---")
        try {
            val selectedIndex = comboBox.javaClass.getMethod("getSelectedIndex").invoke(comboBox)
            sb.appendLine("  selectedIndex: $selectedIndex")
        } catch (e: Exception) {
            sb.appendLine("  selectedIndex: ERROR - ${e.message}")
        }

        try {
            val selectedItem = comboBox.javaClass.getMethod("getSelectedItem").invoke(comboBox)
            sb.appendLine("  selectedItem: $selectedItem (${selectedItem?.javaClass?.name})")
        } catch (e: Exception) {
            sb.appendLine("  selectedItem: ERROR - ${e.message}")
        }

        try {
            val itemCount = comboBox.javaClass.getMethod("getItemCount").invoke(comboBox)
            sb.appendLine("  itemCount: $itemCount")

            sb.appendLine("  items:")
            for (i in 0 until (itemCount as Int)) {
                val item = comboBox.javaClass.getMethod("getItemAt", Int::class.java).invoke(comboBox, i)
                val itemClass = item?.javaClass?.name ?: "null"

                // Try to get display name from the item via getMode().getName()
                var displayName = "?"
                if (item != null) {
                    // For ChatModeItem$Mode, get the ChatMode and its name
                    try {
                        val chatMode = item.javaClass.getMethod("getMode").invoke(item)
                        if (chatMode != null) {
                            // Try getName() or getId() on ChatMode
                            for (methodName in listOf("getName", "getId")) {
                                try {
                                    val result = chatMode.javaClass.getMethod(methodName).invoke(chatMode)
                                    if (result != null) {
                                        displayName = result.toString()
                                        break
                                    }
                                } catch (e: Exception) { }
                            }
                            // Try name/id fields
                            if (displayName == "?") {
                                for (fieldName in listOf("name", "id")) {
                                    try {
                                        val field = chatMode.javaClass.getDeclaredField(fieldName)
                                        field.isAccessible = true
                                        displayName = field.get(chatMode)?.toString() ?: "?"
                                        if (displayName != "?") break
                                    } catch (e: Exception) { }
                                }
                            }
                        }
                    } catch (e: Exception) { }

                    // Fallback to standard methods on item itself
                    if (displayName == "?") {
                        for (methodName in listOf("getName", "getDisplayName", "getText", "name", "getTitle", "getLabel")) {
                            try {
                                val result = item.javaClass.getMethod(methodName).invoke(item)
                                if (result != null) {
                                    displayName = result.toString()
                                    break
                                }
                            } catch (e: Exception) { }
                        }
                    }
                }

                sb.appendLine("    [$i] '$displayName' - $item ($itemClass)")
            }
        } catch (e: Exception) {
            sb.appendLine("  itemCount: ERROR - ${e.message}")
        }

        sb.appendLine()
        sb.appendLine("--- ChatModeItem${'$'}Mode Analysis (first item) ---")
        try {
            val firstItem = comboBox.javaClass.getMethod("getItemAt", Int::class.java).invoke(comboBox, 0)
            if (firstItem != null) {
                sb.appendLine("  Class: ${firstItem.javaClass.name}")
                sb.appendLine("  Superclass: ${firstItem.javaClass.superclass?.name}")
                sb.appendLine("  Interfaces: ${firstItem.javaClass.interfaces.map { it.simpleName }}")
                sb.appendLine("  isEnum: ${firstItem.javaClass.isEnum}")
                sb.appendLine("  isRecord: ${firstItem.javaClass.isRecord}")

                sb.appendLine()
                sb.appendLine("  ALL Methods:")
                firstItem.javaClass.methods
                    .sortedBy { it.name }
                    .forEach { method ->
                        val params = method.parameterTypes.map { it.simpleName }.joinToString(", ")
                        sb.appendLine("    ${method.name}($params): ${method.returnType.simpleName}")
                    }

                sb.appendLine()
                sb.appendLine("  Declared Fields:")
                firstItem.javaClass.declaredFields.forEach { field ->
                    field.isAccessible = true
                    val value = try { field.get(firstItem) } catch (e: Exception) { "ERROR: ${e.message}" }
                    sb.appendLine("    ${field.name}: ${field.type.simpleName} = $value")
                }

                sb.appendLine()
                sb.appendLine("  Kotlin properties (if data class):")
                // Try to get Kotlin component methods
                for (i in 1..5) {
                    try {
                        val componentMethod = firstItem.javaClass.getMethod("component$i")
                        val value = componentMethod.invoke(firstItem)
                        sb.appendLine("    component$i() = $value (${value?.javaClass?.simpleName})")
                    } catch (e: NoSuchMethodException) {
                        break
                    } catch (e: Exception) {
                        sb.appendLine("    component$i() ERROR: ${e.message}")
                    }
                }
            }
        } catch (e: Exception) {
            sb.appendLine("  ERROR: ${e.message}")
        }

        sb.appendLine()
        sb.appendLine("--- ComboBox Methods ---")
        comboBox.javaClass.methods
            .filter { it.declaringClass.name.contains("copilot", ignoreCase = true) ||
                      it.declaringClass.name.contains("ComboBox", ignoreCase = true) }
            .sortedBy { it.name }
            .distinctBy { it.name }
            .forEach { method ->
                val params = method.parameterTypes.map { it.simpleName }.joinToString(", ")
                sb.appendLine("  ${method.name}($params): ${method.returnType.simpleName}")
            }

        sb.appendLine()
        sb.appendLine("--- Fields ---")
        comboBox.javaClass.declaredFields.forEach { field ->
            sb.appendLine("  ${field.name}: ${field.type.simpleName}")
        }

        return sb.toString()
    }

    /**
     * Inspect the ModelPickPanel component to understand its API.
     */
    fun inspectModelPickPanel(project: Project): String {
        val toolWindow = ToolWindowManager.getInstance(project)
            .getToolWindow(CopilotClassNames.TOOL_WINDOW_ID) ?: return "Tool window not found"

        val content = toolWindow.contentManager.getContent(0) ?: return "No content"

        val modelPanel = ComponentFinder.findFirstByClassName(content.component, CopilotClassNames.MODEL_PICK_PANEL)
            ?: return "ModelPickPanel not found"

        val sb = StringBuilder()
        sb.appendLine("=== ModelPickPanel Inspection ===")
        sb.appendLine("Class: ${modelPanel.javaClass.name}")
        sb.appendLine("Superclass: ${modelPanel.javaClass.superclass?.name}")
        sb.appendLine("Super-superclass: ${modelPanel.javaClass.superclass?.superclass?.name}")

        // ModelPickPanel extends ModelPickComboBox, so it IS the combo box
        sb.appendLine()
        sb.appendLine("--- Current State (calling on ModelPickPanel directly) ---")

        try {
            val selectedModel = modelPanel.javaClass.getMethod("selectedModel").invoke(modelPanel)
            sb.appendLine("  selectedModel(): $selectedModel (${selectedModel?.javaClass?.name})")
        } catch (e: Exception) {
            sb.appendLine("  selectedModel(): ERROR - ${e.message}")
        }

        try {
            val selectedIndex = modelPanel.javaClass.getMethod("getSelectedIndex").invoke(modelPanel)
            sb.appendLine("  getSelectedIndex(): $selectedIndex")
        } catch (e: Exception) {
            sb.appendLine("  getSelectedIndex(): ERROR - ${e.message}")
        }

        try {
            val itemCount = modelPanel.javaClass.getMethod("getItemCount").invoke(modelPanel)
            sb.appendLine("  getItemCount(): $itemCount")

            sb.appendLine()
            sb.appendLine("--- Items ---")
            for (i in 0 until (itemCount as Int)) {
                val item = modelPanel.javaClass.getMethod("getItemAt", Int::class.java).invoke(modelPanel, i)
                val itemClass = item?.javaClass?.name ?: "null"

                // Try to get model name
                var displayName = "?"
                if (item != null) {
                    // Try various approaches to get the name
                    for (methodName in listOf("getName", "getDisplayName", "getId", "name", "id", "getModelId", "getModelName", "toString")) {
                        try {
                            val result = item.javaClass.getMethod(methodName).invoke(item)
                            if (result != null && result.toString().isNotBlank() && result.toString() != item.javaClass.name) {
                                displayName = result.toString()
                                break
                            }
                        } catch (e: Exception) { }
                    }

                    // Try fields
                    if (displayName == "?") {
                        for (fieldName in listOf("name", "id", "modelId", "modelName", "displayName")) {
                            try {
                                val field = item.javaClass.getDeclaredField(fieldName)
                                field.isAccessible = true
                                val value = field.get(item)
                                if (value != null && value.toString().isNotBlank()) {
                                    displayName = value.toString()
                                    break
                                }
                            } catch (e: Exception) { }
                        }
                    }
                }

                sb.appendLine("  [$i] '$displayName' ($itemClass)")
            }
        } catch (e: Exception) {
            sb.appendLine("  getItemCount(): ERROR - ${e.message}")
        }

        // Show first item analysis
        sb.appendLine()
        sb.appendLine("--- First Item Analysis ---")
        try {
            val firstItem = modelPanel.javaClass.getMethod("getItemAt", Int::class.java).invoke(modelPanel, 0)
            if (firstItem != null) {
                sb.appendLine("  Class: ${firstItem.javaClass.name}")
                sb.appendLine("  Superclass: ${firstItem.javaClass.superclass?.name}")
                sb.appendLine("  isEnum: ${firstItem.javaClass.isEnum}")

                sb.appendLine()
                sb.appendLine("  Methods:")
                firstItem.javaClass.methods
                    .sortedBy { it.name }
                    .distinctBy { it.name }
                    .forEach { method ->
                        val params = method.parameterTypes.map { it.simpleName }.joinToString(", ")
                        sb.appendLine("    ${method.name}($params): ${method.returnType.simpleName}")
                    }

                sb.appendLine()
                sb.appendLine("  Declared Fields:")
                firstItem.javaClass.declaredFields.forEach { field ->
                    field.isAccessible = true
                    val value = try {
                        val v = field.get(firstItem)
                        if (v == null) "null" else if (v.toString().length > 80) v.toString().take(80) + "..." else v.toString()
                    } catch (e: Exception) { "ERROR: ${e.message}" }
                    sb.appendLine("    ${field.name}: ${field.type.simpleName} = $value")
                }
            }
        } catch (e: Exception) {
            sb.appendLine("  ERROR: ${e.message}")
        }

        // Show ModelPickPanel methods
        sb.appendLine()
        sb.appendLine("--- ModelPickPanel/ComboBox Methods ---")
        modelPanel.javaClass.methods
            .filter { it.declaringClass.name.contains("copilot", ignoreCase = true) ||
                      it.name.contains("select", ignoreCase = true) ||
                      it.name.contains("model", ignoreCase = true) ||
                      it.name.contains("item", ignoreCase = true) }
            .sortedBy { it.name }
            .distinctBy { it.name }
            .forEach { method ->
                val params = method.parameterTypes.map { it.simpleName }.joinToString(", ")
                sb.appendLine("  ${method.name}($params): ${method.returnType.simpleName}")
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

        sb.appendLine()
        sb.appendLine("--- ChatModeComboBox Details ---")
        sb.appendLine(inspectChatModeComboBox(project))

        return sb.toString()
    }
}
