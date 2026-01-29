package com.citi.copilotautomation.bridge

import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.WindowManager
import java.awt.Component
import java.awt.Container

object CopilotChatToolWindowUtil {
    private val LOG = Logger.getInstance(CopilotChatToolWindowUtil::class.java)

    // =========================================================================
    // Component Search Utilities
    // =========================================================================

    /**
     * Find all components matching a class name in the component tree.
     *
     * @param comp Root component to search from
     * @param className Fully qualified class name to match
     * @param result List to collect matching components
     * @param stopOnFirst If true, stops after finding the first match (optimization)
     */
    fun findComponentsByClassName(
        comp: Component?,
        className: String,
        result: MutableList<Component>,
        stopOnFirst: Boolean = false
    ) {
        if (comp == null) return
        if (stopOnFirst && result.isNotEmpty()) return

        if (comp.javaClass.name == className) {
            result.add(comp)
            if (stopOnFirst) return
        }

        if (comp is Container) {
            for (child in comp.components) {
                findComponentsByClassName(child, className, result, stopOnFirst)
                if (stopOnFirst && result.isNotEmpty()) return
            }
        }
    }

    /**
     * Find the first component matching a class name.
     * More efficient than findComponentsByClassName when only one match is needed.
     */
    fun findFirstComponentByClassName(comp: Component?, className: String): Component? {
        if (comp == null) return null
        if (comp.javaClass.name == className) return comp

        if (comp is Container) {
            for (child in comp.components) {
                val result = findFirstComponentByClassName(child, className)
                if (result != null) return result
            }
        }
        return null
    }

    /**
     * Safely invoke a no-arg method on an object using reflection.
     * @return The method result, or null if invocation failed
     */
    fun safeInvokeMethod(target: Any, methodName: String): Any? {
        return try {
            val method = target.javaClass.getMethod(methodName)
            method.invoke(target)
        } catch (e: Exception) {
            LOG.debug("safeInvokeMethod: Failed to invoke $methodName: ${e.message}")
            null
        }
    }

    // =========================================================================
    // Window/Panel Access
    // =========================================================================

    private fun getRootComponent(frame: Any): Component? {
        return try {
            val method = frame.javaClass.getMethod("getComponent")
            method.invoke(frame) as? Component
        } catch (e: Exception) {
            LOG.debug("getRootComponent: Falling back to direct cast")
            frame as? Component
        }
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

        val panel = findFirstComponentByClassName(root, CopilotClassNames.CHAT_TOOL_WINDOW_CONTAINER)
        if (panel == null) {
            LOG.debug("getCopilotChatPanel: Chat panel not found (class: ${CopilotClassNames.CHAT_TOOL_WINDOW_CONTAINER})")
        }
        return panel
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

    // =========================================================================
    // Generic Action Button Helper
    // =========================================================================

    /**
     * Find and click a button with a specific action class.
     *
     * @param project The current project
     * @param actionClassName The fully qualified action class name to match
     * @param actionDescription Description for logging purposes
     * @return true if button was found and clicked, false otherwise
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

        val buttons = mutableListOf<Component>()
        findComponentsByClassName(chatPanel, CopilotClassNames.KEYBOARD_ACCESSIBLE_ACTION_BUTTON, buttons)

        for (button in buttons) {
            val action = safeInvokeMethod(button, "getAction") ?: continue
            if (action.javaClass.name == actionClassName && button.isShowing) {
                return try {
                    button.javaClass.getMethod("click").invoke(button)
                    LOG.debug("clickActionButton($actionDescription): Successfully clicked button")
                    true
                } catch (e: Exception) {
                    LOG.error("clickActionButton($actionDescription): Failed to invoke click(): ${e.message}")
                    false
                }
            }
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
     * Select a chat mode by name from the ChatModeComboBox.
     *
     * @param project The current project
     * @param modeName The mode name to select (e.g., "Ask", "Agent")
     * @return true if mode was found and selected, false otherwise
     */
    private fun selectChatModeByName(project: Project, modeName: String): Boolean {
        if (!activateCopilotChatToolWindow(project)) {
            LOG.warn("selectChatModeByName: Failed to activate tool window")
            return false
        }

        val chatPanel = getCopilotChatPanel(project)
        if (chatPanel == null) {
            LOG.warn("selectChatModeByName: Chat panel not found")
            return false
        }

        val comboBox = findFirstComponentByClassName(chatPanel, CopilotClassNames.CHAT_MODE_COMBO_BOX)
        if (comboBox == null) {
            LOG.warn("selectChatModeByName: ChatModeComboBox not found")
            return false
        }

        // Try to select by name first
        val selectedByName = selectComboBoxItemByName(comboBox, modeName)
        if (selectedByName) {
            LOG.debug("selectChatModeByName: Selected mode '$modeName' by name")
            return true
        }

        // Fallback to index-based selection
        val index = when (modeName) {
            CopilotClassNames.ChatModes.ASK -> 0
            CopilotClassNames.ChatModes.AGENT -> 1
            else -> {
                LOG.warn("selectChatModeByName: Unknown mode '$modeName'")
                return false
            }
        }

        return selectComboBoxByIndex(comboBox, index, "ChatModeComboBox")
    }

    fun setAskChatMode(project: Project): Boolean {
        return selectChatModeByName(project, CopilotClassNames.ChatModes.ASK)
    }

    fun setAgentChatMode(project: Project): Boolean {
        return selectChatModeByName(project, CopilotClassNames.ChatModes.AGENT)
    }

    // =========================================================================
    // Model Selection
    // =========================================================================

    /**
     * Select a model by name from the ModelPickPanel.
     *
     * @param project The current project
     * @param modelNames List of model names to try (in order of preference)
     * @param fallbackIndex Index to use if name matching fails
     * @return true if model was selected, false otherwise
     */
    private fun selectModelByName(project: Project, modelNames: List<String>, fallbackIndex: Int): Boolean {
        if (!activateCopilotChatToolWindow(project)) {
            LOG.warn("selectModelByName: Failed to activate tool window")
            return false
        }

        val chatPanel = getCopilotChatPanel(project)
        if (chatPanel == null) {
            LOG.warn("selectModelByName: Chat panel not found")
            return false
        }

        val modelPanel = findFirstComponentByClassName(chatPanel, CopilotClassNames.MODEL_PICK_PANEL)
        if (modelPanel == null) {
            LOG.warn("selectModelByName: ModelPickPanel not found")
            return false
        }

        // Try to select by name first (try each name variant)
        for (modelName in modelNames) {
            if (selectComboBoxItemByName(modelPanel, modelName)) {
                LOG.debug("selectModelByName: Selected model '$modelName' by name")
                return true
            }
        }

        // Fallback to index-based selection
        LOG.debug("selectModelByName: Name matching failed for ${modelNames}, falling back to index $fallbackIndex")
        return selectComboBoxByIndex(modelPanel, fallbackIndex, "ModelPickPanel")
    }

    fun setModelClaudeSonnet4(project: Project): Boolean {
        return selectModelByName(
            project,
            listOf(CopilotClassNames.ModelNames.CLAUDE_SONNET_4, CopilotClassNames.ModelNames.CLAUDE_SONNET),
            fallbackIndex = 1
        )
    }

    fun setModelGeminiPro(project: Project): Boolean {
        return selectModelByName(
            project,
            listOf(CopilotClassNames.ModelNames.GEMINI_PRO, CopilotClassNames.ModelNames.GEMINI_PRO_ALT),
            fallbackIndex = 2
        )
    }

    fun setModelGPT(project: Project): Boolean {
        return selectModelByName(
            project,
            listOf(CopilotClassNames.ModelNames.GPT_4O, CopilotClassNames.ModelNames.GPT_4_1),
            fallbackIndex = 4
        )
    }

    // =========================================================================
    // ComboBox Helpers
    // =========================================================================

    /**
     * Try to select a combo box item by matching the item's display name.
     *
     * @param comboBox The combo box component
     * @param itemName The name to search for (case-insensitive contains match)
     * @return true if item was found and selected, false otherwise
     */
    private fun selectComboBoxItemByName(comboBox: Component, itemName: String): Boolean {
        return try {
            // Get item count
            val getItemCount = comboBox.javaClass.getMethod("getItemCount")
            val itemCount = getItemCount.invoke(comboBox) as? Int ?: return false

            // Get item at index method
            val getItemAt = comboBox.javaClass.getMethod("getItemAt", Int::class.java)

            for (i in 0 until itemCount) {
                val item = getItemAt.invoke(comboBox, i) ?: continue
                val itemString = item.toString()

                if (itemString.contains(itemName, ignoreCase = true)) {
                    val setSelectedIndex = comboBox.javaClass.getMethod("setSelectedIndex", Int::class.java)
                    setSelectedIndex.invoke(comboBox, i)
                    return true
                }
            }
            false
        } catch (e: Exception) {
            LOG.debug("selectComboBoxItemByName: Failed to select by name '$itemName': ${e.message}")
            false
        }
    }

    /**
     * Select a combo box item by index.
     *
     * @param comboBox The combo box component
     * @param index The index to select
     * @param componentName Name for logging purposes
     * @return true if selection was successful, false otherwise
     */
    private fun selectComboBoxByIndex(comboBox: Component, index: Int, componentName: String): Boolean {
        return try {
            comboBox.javaClass.getMethod("setSelectedIndex", Int::class.java).invoke(comboBox, index)
            LOG.debug("selectComboBoxByIndex: Set $componentName to index $index")
            true
        } catch (e: Exception) {
            LOG.warn("selectComboBoxByIndex: Failed to set index $index on $componentName: ${e.message}")
            false
        }
    }

    // =========================================================================
    // Context Toggle
    // =========================================================================

    /**
     * Toggle off the current file context.
     * @return true if toggle was found and set, false otherwise
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

        val toggle = findFirstComponentByClassName(chatPanel, CopilotClassNames.ON_OFF_BUTTON)
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
}
