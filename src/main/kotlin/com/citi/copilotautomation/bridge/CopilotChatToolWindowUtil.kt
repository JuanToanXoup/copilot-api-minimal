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
     * Select a chat mode by name from the ChatModeComboBox.
     */
    private fun selectChatModeByName(project: Project, modeName: String, fallbackIndex: Int): Boolean {
        if (!activateCopilotChatToolWindow(project)) {
            LOG.warn("selectChatModeByName: Failed to activate tool window")
            return false
        }

        val chatPanel = getCopilotChatPanel(project)
        if (chatPanel == null) {
            LOG.warn("selectChatModeByName: Chat panel not found")
            return false
        }

        val comboBox = ComponentFinder.findFirstByClassName(chatPanel, CopilotClassNames.CHAT_MODE_COMBO_BOX)
        if (comboBox == null) {
            LOG.warn("selectChatModeByName: ChatModeComboBox not found")
            return false
        }

        // Try to select by name first
        if (selectComboBoxItemByName(comboBox, modeName)) {
            LOG.debug("selectChatModeByName: Selected mode '$modeName' by name")
            return true
        }

        // Fallback to index
        return selectComboBoxByIndex(comboBox, fallbackIndex, "ChatModeComboBox")
    }

    fun setAskChatMode(project: Project): Boolean {
        return selectChatModeByName(project, CopilotClassNames.ChatModes.ASK, CopilotClassNames.ChatModes.ASK_INDEX)
    }

    fun setAgentChatMode(project: Project): Boolean {
        return selectChatModeByName(project, CopilotClassNames.ChatModes.AGENT, CopilotClassNames.ChatModes.AGENT_INDEX)
    }

    // =========================================================================
    // Model Selection
    // =========================================================================

    /**
     * Select a model by name from the ModelPickPanel.
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

        val modelPanel = ComponentFinder.findFirstByClassName(chatPanel, CopilotClassNames.MODEL_PICK_PANEL)
        if (modelPanel == null) {
            LOG.warn("selectModelByName: ModelPickPanel not found")
            return false
        }

        // Try each name variant
        for (modelName in modelNames) {
            if (selectComboBoxItemByName(modelPanel, modelName)) {
                LOG.debug("selectModelByName: Selected model '$modelName' by name")
                return true
            }
        }

        // Fallback to index
        LOG.debug("selectModelByName: Name matching failed, falling back to index $fallbackIndex")
        return selectComboBoxByIndex(modelPanel, fallbackIndex, "ModelPickPanel")
    }

    fun setModelClaudeSonnet4(project: Project): Boolean {
        return selectModelByName(
            project,
            CopilotClassNames.ModelNames.CLAUDE_VARIANTS,
            CopilotClassNames.ModelIndices.CLAUDE_SONNET_4
        )
    }

    fun setModelGeminiPro(project: Project): Boolean {
        return selectModelByName(
            project,
            CopilotClassNames.ModelNames.GEMINI_VARIANTS,
            CopilotClassNames.ModelIndices.GEMINI_PRO
        )
    }

    fun setModelGPT(project: Project): Boolean {
        return selectModelByName(
            project,
            CopilotClassNames.ModelNames.GPT_VARIANTS,
            CopilotClassNames.ModelIndices.GPT
        )
    }

    // =========================================================================
    // ComboBox Helpers
    // =========================================================================

    /**
     * Try to select a combo box item by matching the item's display name.
     */
    private fun selectComboBoxItemByName(comboBox: Component, itemName: String): Boolean {
        val itemCount = ReflectionUtil.getItemCount(comboBox)
        if (itemCount < 0) return false

        for (i in 0 until itemCount) {
            val item = ReflectionUtil.getItemAt(comboBox, i) ?: continue
            val itemString = item.toString()

            if (itemString.contains(itemName, ignoreCase = true)) {
                return ReflectionUtil.setSelectedIndex(comboBox, i)
            }
        }
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
