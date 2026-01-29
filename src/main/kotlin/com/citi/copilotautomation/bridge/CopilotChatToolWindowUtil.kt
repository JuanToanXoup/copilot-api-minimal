package com.citi.copilotautomation.bridge

import com.citi.copilotautomation.core.ComponentFinder
import com.citi.copilotautomation.core.ReflectionUtil
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.WindowManager
import java.awt.Component

/**
 * Utility for interacting with the Copilot Chat tool window UI.
 * Handles mode switching, model selection, and session management.
 */
object CopilotChatToolWindowUtil {
    private val LOG = Logger.getInstance(CopilotChatToolWindowUtil::class.java)

    // =========================================================================
    // Window/Panel Access
    // =========================================================================

    private fun getRootComponent(frame: Any): Component? {
        return ReflectionUtil.invokeMethod(frame, "getComponent") as? Component
            ?: frame as? Component
    }

    private fun getCopilotChatPanel(project: Project): Component? {
        val frame = WindowManager.getInstance().getIdeFrame(project)
        if (frame == null) {
            LOG.warn("getCopilotChatPanel: IDE frame not found for project")
            return null
        }

        val root = getRootComponent(frame)
        if (root == null) {
            LOG.warn("getCopilotChatPanel: Root component not found")
            return null
        }

        return ComponentFinder.findFirstByClassName(root, CopilotClassNames.CHAT_TOOL_WINDOW_CONTAINER)
    }

    private fun activateCopilotChatToolWindow(project: Project): Boolean {
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow(CopilotClassNames.TOOL_WINDOW_ID)
        if (toolWindow == null) {
            LOG.warn("activateCopilotChatToolWindow: '${CopilotClassNames.TOOL_WINDOW_ID}' tool window not found.")
            return false
        }
        if (!toolWindow.isActive) {
            toolWindow.activate(null)
            LOG.debug("activateCopilotChatToolWindow: Tool window activated.")
        }
        return true
    }

    /**
     * Get the tool window component for external use.
     */
    fun getToolWindowComponent(project: Project): Component? {
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow(CopilotClassNames.TOOL_WINDOW_ID)
        return toolWindow?.component
    }

    // =========================================================================
    // Generic Action Button Helper
    // =========================================================================

    /**
     * Find and click a button with a specific action class.
     */
    private fun clickActionButton(project: Project, actionClassName: String, actionDescription: String): Boolean {
        if (!activateCopilotChatToolWindow(project)) {
            LOG.error("clickActionButton($actionDescription): Failed to activate tool window")
            return false
        }

        val chatPanel = getCopilotChatPanel(project)
        if (chatPanel == null) {
            LOG.error("clickActionButton($actionDescription): Chat panel not found")
            return false
        }

        val button = ComponentFinder.findButtonWithAction(
            chatPanel,
            CopilotClassNames.KEYBOARD_ACCESSIBLE_ACTION_BUTTON,
            actionClassName
        )

        if (button != null) {
            if (ReflectionUtil.click(button)) {
                LOG.debug("clickActionButton($actionDescription): Successfully clicked button")
                return true
            }
            LOG.error("clickActionButton($actionDescription): Failed to invoke click()")
            return false
        }

        LOG.warn("clickActionButton($actionDescription): No visible button found with action $actionClassName")
        return false
    }

    // =========================================================================
    // Send Prompt
    // =========================================================================

    fun sendPromptToCopilot(project: Project): Boolean {
        return clickActionButton(project, CopilotClassNames.SEND_MESSAGE_ACTION, "SendMessage")
    }

    // =========================================================================
    // Session Management
    // =========================================================================

    fun startNewAgentSession(project: Project): Boolean {
        return clickActionButton(project, CopilotClassNames.NEW_AGENT_SESSION_ACTION, "NewAgentSession")
    }

    // =========================================================================
    // Chat Mode Selection (Ask/Agent)
    // =========================================================================

    /**
     * Select a chat mode by matching its display name.
     * The ChatModeComboBox uses ChatModeItem$Mode objects.
     */
    private fun selectChatModeByName(project: Project, modeName: String): Boolean {
        if (!activateCopilotChatToolWindow(project)) {
            LOG.warn("selectChatModeByName: Failed to activate tool window")
            return false
        }

        // Try tool window component first (more reliable)
        val toolWindowComponent = getToolWindowComponent(project)
        var comboBox = if (toolWindowComponent != null) {
            ComponentFinder.findFirstByClassName(toolWindowComponent, CopilotClassNames.CHAT_MODE_COMBO_BOX)
        } else null

        // Fallback to chat panel
        if (comboBox == null) {
            val chatPanel = getCopilotChatPanel(project)
            if (chatPanel != null) {
                comboBox = ComponentFinder.findFirstByClassName(chatPanel, CopilotClassNames.CHAT_MODE_COMBO_BOX)
            }
        }

        if (comboBox == null) {
            LOG.warn("selectChatModeByName: ChatModeComboBox not found")
            return false
        }

        LOG.info("selectChatModeByName: Looking for mode '$modeName'")

        // Find the item that matches the name
        val itemCount = ReflectionUtil.getItemCount(comboBox)
        if (itemCount <= 0) {
            LOG.warn("selectChatModeByName: No items in combo box")
            return false
        }

        for (i in 0 until itemCount) {
            val item = ReflectionUtil.getItemAt(comboBox, i) ?: continue
            val itemName = getItemDisplayName(item)

            LOG.debug("selectChatModeByName: Item $i = '$itemName'")

            if (itemName.equals(modeName, ignoreCase = true) || itemName.contains(modeName, ignoreCase = true)) {
                LOG.info("selectChatModeByName: Found '$modeName' at index $i (name: '$itemName')")
                return selectChatModeItem(comboBox, item, i)
            }
        }

        LOG.warn("selectChatModeByName: Mode '$modeName' not found in combo box")
        return false
    }

    /**
     * Get the display name and ChatMode from a combo box item.
     * ChatModeItem$Mode has getMode() which returns a ChatMode with id/name properties.
     */
    private fun getItemDisplayName(item: Any): String {
        // For ChatModeItem$Mode, get the ChatMode and extract its name
        try {
            val chatMode = item.javaClass.getMethod("getMode").invoke(item)
            if (chatMode != null) {
                // Try to get name or id from ChatMode
                for (methodName in listOf("getName", "getId", "name", "id")) {
                    try {
                        val result = chatMode.javaClass.getMethod(methodName).invoke(chatMode)
                        if (result != null && result.toString().isNotBlank()) {
                            return result.toString()
                        }
                    } catch (e: Exception) {
                        // Try next
                    }
                }
                // Try fields
                for (fieldName in listOf("name", "id")) {
                    try {
                        val field = chatMode.javaClass.getDeclaredField(fieldName)
                        field.isAccessible = true
                        val value = field.get(chatMode)
                        if (value != null && value.toString().isNotBlank()) {
                            return value.toString()
                        }
                    } catch (e: Exception) {
                        // Try next
                    }
                }
            }
        } catch (e: Exception) {
            LOG.debug("getItemDisplayName: getMode() failed: ${e.message}")
        }

        // Fallback to standard methods
        for (methodName in listOf("getName", "getDisplayName", "getText", "name", "getTitle", "getLabel")) {
            try {
                val result = item.javaClass.getMethod(methodName).invoke(item)
                if (result != null && result.toString().isNotBlank()) {
                    return result.toString()
                }
            } catch (e: Exception) {
                // Try next method
            }
        }

        return item.toString()
    }

    /**
     * Get the ChatMode object from a ChatModeItem$Mode.
     */
    private fun getChatModeFromItem(item: Any): Any? {
        return try {
            item.javaClass.getMethod("getMode").invoke(item)
        } catch (e: Exception) {
            LOG.debug("getChatModeFromItem: getMode() failed: ${e.message}")
            null
        }
    }

    /**
     * Select a specific item in the chat mode combo box.
     */
    private fun selectChatModeItem(comboBox: Component, item: Any, index: Int): Boolean {
        // Get the ChatMode from the item
        val chatMode = getChatModeFromItem(item)

        if (chatMode != null) {
            LOG.info("selectChatModeItem: Got ChatMode: $chatMode")

            // Use setSelectedMode(ChatMode) - this is the proper Copilot API
            try {
                val setSelectedModeMethod = comboBox.javaClass.methods.find {
                    it.name == "setSelectedMode" && it.parameterCount == 1
                }
                if (setSelectedModeMethod != null) {
                    setSelectedModeMethod.invoke(comboBox, chatMode)
                    LOG.info("selectChatModeItem: setSelectedMode(ChatMode) succeeded")
                    return true
                }
            } catch (e: Exception) {
                LOG.warn("selectChatModeItem: setSelectedMode failed: ${e.message}", e)
            }
        } else {
            LOG.warn("selectChatModeItem: Could not get ChatMode from item")
        }

        // Fallback: Try setSelectedItem with the full item
        try {
            comboBox.javaClass.getMethod("setSelectedItem", Any::class.java).invoke(comboBox, item)
            LOG.info("selectChatModeItem: setSelectedItem succeeded")
            return true
        } catch (e: Exception) {
            LOG.debug("selectChatModeItem: setSelectedItem failed: ${e.message}")
        }

        // Fallback: Try setSelectedIndex
        try {
            comboBox.javaClass.getMethod("setSelectedIndex", Int::class.java).invoke(comboBox, index)
            LOG.info("selectChatModeItem: setSelectedIndex succeeded")
            return true
        } catch (e: Exception) {
            LOG.debug("selectChatModeItem: setSelectedIndex failed: ${e.message}")
        }

        LOG.warn("selectChatModeItem: All approaches failed")
        return false
    }

    fun setAskChatMode(project: Project): Boolean {
        return selectChatModeByName(project, "Ask")
    }

    fun setAgentChatMode(project: Project): Boolean {
        return selectChatModeByName(project, "Agent")
    }

    // =========================================================================
    // Model Selection
    // =========================================================================

    /**
     * Select a model by matching its display name.
     * ModelPickPanel uses CopilotModelItem objects with toString() returning the name.
     */
    private fun selectModelByName(project: Project, modelName: String): Boolean {
        if (!activateCopilotChatToolWindow(project)) {
            LOG.warn("selectModelByName: Failed to activate tool window")
            return false
        }

        // Try tool window component first (more reliable)
        val toolWindowComponent = getToolWindowComponent(project)
        var modelPanel = if (toolWindowComponent != null) {
            ComponentFinder.findFirstByClassName(toolWindowComponent, CopilotClassNames.MODEL_PICK_PANEL)
        } else null

        // Fallback to chat panel
        if (modelPanel == null) {
            val chatPanel = getCopilotChatPanel(project)
            if (chatPanel != null) {
                modelPanel = ComponentFinder.findFirstByClassName(chatPanel, CopilotClassNames.MODEL_PICK_PANEL)
            }
        }

        if (modelPanel == null) {
            LOG.warn("selectModelByName: ModelPickPanel not found")
            return false
        }

        LOG.info("selectModelByName: Looking for model '$modelName'")

        // Get item count
        val itemCount = ReflectionUtil.getItemCount(modelPanel)
        if (itemCount <= 0) {
            LOG.warn("selectModelByName: No items in model panel")
            return false
        }

        // Build list of non-separator items with their names
        val items = mutableListOf<Triple<Int, Any, String>>()
        for (i in 0 until itemCount) {
            val item = ReflectionUtil.getItemAt(modelPanel, i) ?: continue

            // Skip separators
            try {
                val isSeparator = item.javaClass.getMethod("isSeparator").invoke(item) as? Boolean ?: false
                if (isSeparator) continue
            } catch (e: Exception) {
                // No isSeparator method, continue
            }

            val itemName = item.toString()
            items.add(Triple(i, item, itemName))
            LOG.debug("selectModelByName: Item $i = '$itemName'")
        }

        // First try exact match (case-insensitive)
        for ((index, item, itemName) in items) {
            if (itemName.equals(modelName, ignoreCase = true)) {
                LOG.info("selectModelByName: Exact match '$modelName' at index $index")
                return selectModelItem(modelPanel, item, index)
            }
        }

        // Then try partial match (contains)
        for ((index, item, itemName) in items) {
            if (itemName.contains(modelName, ignoreCase = true)) {
                LOG.info("selectModelByName: Partial match '$modelName' at index $index (name: '$itemName')")
                return selectModelItem(modelPanel, item, index)
            }
        }

        LOG.warn("selectModelByName: Model '$modelName' not found")
        return false
    }

    /**
     * Select a model item in the model picker.
     */
    private fun selectModelItem(modelPanel: Component, item: Any, index: Int): Boolean {
        // Try setSelectedItem first
        try {
            modelPanel.javaClass.getMethod("setSelectedItem", Any::class.java).invoke(modelPanel, item)
            LOG.info("selectModelItem: setSelectedItem succeeded")
            return true
        } catch (e: Exception) {
            LOG.debug("selectModelItem: setSelectedItem failed: ${e.message}")
        }

        // Try setSelectedIndex
        try {
            modelPanel.javaClass.getMethod("setSelectedIndex", Int::class.java).invoke(modelPanel, index)
            LOG.info("selectModelItem: setSelectedIndex succeeded")
            return true
        } catch (e: Exception) {
            LOG.debug("selectModelItem: setSelectedIndex failed: ${e.message}")
        }

        LOG.warn("selectModelItem: All approaches failed")
        return false
    }

    fun setModelClaudeSonnet4(project: Project): Boolean {
        return selectModelByName(project, "Claude Sonnet 4")
    }

    fun setModelGeminiPro(project: Project): Boolean {
        return selectModelByName(project, "Gemini 2.5 Pro")
    }

    fun setModelGPT4o(project: Project): Boolean {
        return selectModelByName(project, "GPT-4o")
    }

    fun setModelGPT41(project: Project): Boolean {
        return selectModelByName(project, "GPT-4.1")
    }

    // Legacy method - defaults to GPT-4o
    fun setModelGPT(project: Project): Boolean {
        return setModelGPT4o(project)
    }

    // =========================================================================
    // ComboBox Helpers
    // =========================================================================

    /**
     * Try to select a combo box item by matching the item's display name.
     */
    private fun selectComboBoxItemByName(comboBox: Component, itemName: String): Boolean {
        val itemCount = ReflectionUtil.getItemCount(comboBox)
        if (itemCount < 0) {
            LOG.debug("selectComboBoxItemByName: Could not get item count")
            return false
        }

        LOG.debug("selectComboBoxItemByName: Searching for '$itemName' in $itemCount items")

        for (i in 0 until itemCount) {
            val item = ReflectionUtil.getItemAt(comboBox, i) ?: continue
            val itemString = item.toString()

            LOG.debug("selectComboBoxItemByName: Item $i = '$itemString'")

            if (itemString.contains(itemName, ignoreCase = true)) {
                LOG.info("selectComboBoxItemByName: Found match at index $i")

                // Try setSelectedItem first (more reliable for some combo boxes)
                if (ReflectionUtil.setSelectedItem(comboBox, item)) {
                    LOG.info("selectComboBoxItemByName: setSelectedItem succeeded")
                    return true
                }

                // Fallback to setSelectedIndex
                if (ReflectionUtil.setSelectedIndex(comboBox, i)) {
                    LOG.info("selectComboBoxItemByName: setSelectedIndex succeeded")
                    return true
                }

                LOG.warn("selectComboBoxItemByName: Both selection methods failed")
                return false
            }
        }

        LOG.debug("selectComboBoxItemByName: No match found for '$itemName'")
        return false
    }

    /**
     * Select a combo box item by index.
     */
    private fun selectComboBoxByIndex(comboBox: Component, index: Int, componentName: String): Boolean {
        if (ReflectionUtil.setSelectedIndex(comboBox, index)) {
            LOG.debug("selectComboBoxByIndex: Set $componentName to index $index")
            return true
        }
        LOG.warn("selectComboBoxByIndex: Failed to set index $index on $componentName")
        return false
    }

    // =========================================================================
    // Context Toggle
    // =========================================================================

    /**
     * Toggle off the current file context.
     */
    fun toggleOffCurrentFileContext(project: Project): Boolean {
        if (!activateCopilotChatToolWindow(project)) {
            LOG.warn("toggleOffCurrentFileContext: Failed to activate tool window")
            return false
        }

        val chatPanel = getCopilotChatPanel(project)
        if (chatPanel == null) {
            LOG.warn("toggleOffCurrentFileContext: Chat panel not found")
            return false
        }

        val toggle = ComponentFinder.findFirstByClassName(chatPanel, CopilotClassNames.ON_OFF_BUTTON)
        if (toggle == null) {
            LOG.warn("toggleOffCurrentFileContext: OnOffButton not found")
            return false
        }

        return try {
            toggle.javaClass.getMethod("setSelected", Boolean::class.java).invoke(toggle, false)
            LOG.debug("toggleOffCurrentFileContext: Toggled off current file context")
            true
        } catch (e: Exception) {
            LOG.warn("toggleOffCurrentFileContext: Failed to toggle: ${e.message}")
            false
        }
    }

    // =========================================================================
    // Legacy Compatibility (for external callers)
    // =========================================================================

    /**
     * @deprecated Use ComponentFinder.findByClassName instead
     */
    fun findComponentsByClassName(
        comp: Component?,
        className: String,
        result: MutableList<Component>,
        stopOnFirst: Boolean = false
    ) {
        if (comp == null) return
        result.addAll(ComponentFinder.findByClassName(comp, className, stopOnFirst))
    }

    /**
     * @deprecated Use ComponentFinder.findFirstByClassName instead
     */
    fun findFirstComponentByClassName(comp: Component?, className: String): Component? {
        return ComponentFinder.findFirstByClassName(comp, className)
    }

    /**
     * @deprecated Use ReflectionUtil.invokeMethod instead
     */
    fun safeInvokeMethod(target: Any, methodName: String): Any? {
        return ReflectionUtil.invokeMethod(target, methodName)
    }
}
