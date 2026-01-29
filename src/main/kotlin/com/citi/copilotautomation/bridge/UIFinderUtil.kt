package com.citi.copilotautomation.bridge

import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.impl.EditorComponentImpl
import com.intellij.ui.components.JBScrollPane
import java.awt.Component
import java.awt.Container
import javax.swing.JTextArea
import javax.swing.text.JTextComponent

object UIFinderUtil {
    private val LOG = Logger.getInstance(UIFinderUtil::class.java)

    /**
     * Count visible Stop action buttons to detect if Copilot is generating.
     * Returns 0 if components not found (logs warning for debugging).
     */
    fun countVisibleStopActionButtons(rootComponent: Component?): Int {
        if (rootComponent == null) {
            LOG.debug("countVisibleStopActionButtons: rootComponent is null")
            return 0
        }

        val allActionButtons = mutableListOf<Component>()
        CopilotChatToolWindowUtil.findComponentsByClassName(
            rootComponent,
            CopilotClassNames.KEYBOARD_ACCESSIBLE_ACTION_BUTTON,
            allActionButtons
        )

        if (allActionButtons.isEmpty()) {
            LOG.debug("countVisibleStopActionButtons: No action buttons found")
            return 0
        }

        var visibleStopActionCount = 0
        allActionButtons.forEach { button ->
            val action = CopilotChatToolWindowUtil.safeInvokeMethod(button, "getAction")
            if (action != null && action.javaClass.name == CopilotClassNames.STOP_ACTION) {
                if (button.isShowing) {
                    visibleStopActionCount++
                }
            }
        }
        return visibleStopActionCount
    }

    /**
     * Result of finding chat input - contains both the component and the editor if applicable.
     */
    data class ChatInputResult(
        val component: Component,
        val editor: Editor? = null,
        val type: InputType
    ) {
        enum class InputType { TEXT_AREA, TEXT_COMPONENT, EDITOR }
    }

    /**
     * Find the chat input component. Supports:
     * - CopilotAgentInputTextArea (the actual Copilot chat input)
     * - EditorComponentImpl (IntelliJ Editor)
     * - JTextArea (legacy)
     */
    fun findChatInputEx(comp: Component?): ChatInputResult? {
        if (comp == null) return null

        // FIRST: Look specifically for the Copilot input text area
        val copilotInput = CopilotChatToolWindowUtil.findFirstComponentByClassName(
            comp,
            CopilotClassNames.AGENT_INPUT_TEXT_AREA
        )
        if (copilotInput != null) {
            LOG.info("findChatInputEx: Found CopilotAgentInputTextArea")
            // It's likely a JTextComponent subclass
            if (copilotInput is JTextComponent) {
                return ChatInputResult(copilotInput, null, ChatInputResult.InputType.TEXT_COMPONENT)
            }
            // Try to find editor inside it
            if (copilotInput is Container) {
                val editorResult = findEditorInContainer(copilotInput)
                if (editorResult != null) return editorResult
            }
            // Return as generic text component
            return ChatInputResult(copilotInput, null, ChatInputResult.InputType.TEXT_COMPONENT)
        }

        // SECOND: Look for IntelliJ Editor component
        if (comp is EditorComponentImpl) {
            LOG.debug("findChatInputEx: Found EditorComponentImpl")
            return ChatInputResult(comp, comp.editor, ChatInputResult.InputType.EDITOR)
        }

        // THIRD: Check for JTextArea (but NOT HtmlContentComponent which is for display)
        if (comp is JTextArea && !comp.javaClass.name.contains("HtmlContent")) {
            LOG.debug("findChatInputEx: Found JTextArea: ${comp.javaClass.name}")
            return ChatInputResult(comp, null, ChatInputResult.InputType.TEXT_AREA)
        }

        // Recurse into containers
        if (comp is Container) {
            for (child in comp.components) {
                val result = findChatInputEx(child)
                if (result != null) return result
            }
        }
        return null
    }

    /**
     * Find an Editor inside a container.
     */
    private fun findEditorInContainer(container: Container): ChatInputResult? {
        for (child in container.components) {
            if (child is EditorComponentImpl) {
                return ChatInputResult(child, child.editor, ChatInputResult.InputType.EDITOR)
            }
            if (child is Container) {
                val result = findEditorInContainer(child)
                if (result != null) return result
            }
        }
        return null
    }

    /**
     * Find the first JTextArea (chat input) in the component tree.
     * @deprecated Use findChatInputEx instead for better component support.
     */
    fun findChatInput(comp: Component?, stopOnFirst: Boolean = true): Component? {
        val result = findChatInputEx(comp)
        return result?.component
    }

    /**
     * Find all Editor components in the tree (for debugging).
     */
    fun findAllEditors(comp: Component?, result: MutableList<Editor>) {
        if (comp == null) return
        if (comp is EditorComponentImpl) {
            result.add(comp.editor)
        }
        if (comp is Container) {
            for (child in comp.components) {
                findAllEditors(child, result)
            }
        }
    }

    /**
     * Find the first JBScrollPane in the component tree.
     */
    fun findChatScrollPane(comp: Component?): Component? {
        if (comp == null) return null
        if (comp is JBScrollPane) return comp
        if (comp is Container) {
            for (child in comp.components) {
                val result = findChatScrollPane(child)
                if (result != null) return result
            }
        }
        return null
    }

    /**
     * Find all message/response components (Copilot responses).
     * Supports both old MarkdownPane and new message components.
     */
    fun findMarkdownPanes(comp: Component?, result: MutableList<Component>) {
        if (comp == null) return

        val className = comp.javaClass.name

        // Check for any of the known message component types
        if (className == CopilotClassNames.MARKDOWN_PANE ||
            className == CopilotClassNames.AGENT_MESSAGE_COMPONENT ||
            className == CopilotClassNames.MESSAGE_CONTENT_PANEL ||
            className == CopilotClassNames.HTML_CONTENT_COMPONENT) {
            result.add(comp)
        }

        if (comp is Container) {
            for (child in comp.components) {
                findMarkdownPanes(child, result)
            }
        }
    }

    /**
     * Find all message components and extract their text content.
     */
    fun findAllMessageTexts(comp: Component?): List<String> {
        if (comp == null) return emptyList()

        val messages = mutableListOf<String>()
        findMessageTextsRecursive(comp, messages)
        return messages
    }

    private fun findMessageTextsRecursive(comp: Component?, messages: MutableList<String>) {
        if (comp == null) return

        val className = comp.javaClass.name

        // Try to extract text from known message components
        when (className) {
            CopilotClassNames.HTML_CONTENT_COMPONENT -> {
                // HtmlContentComponent likely has getText() method
                val text = extractTextFromComponent(comp)
                if (text != null && text.isNotBlank()) {
                    messages.add(text)
                }
            }
            CopilotClassNames.AGENT_MESSAGE_COMPONENT,
            CopilotClassNames.MESSAGE_CONTENT_PANEL -> {
                // These might contain the text or have child components with text
                val text = extractTextFromComponent(comp)
                if (text != null && text.isNotBlank()) {
                    messages.add(text)
                }
            }
            CopilotClassNames.MARKDOWN_PANE -> {
                // Legacy: try to get 'markdown' field
                val text = extractFieldValue(comp, "markdown")
                if (text != null && text.isNotBlank()) {
                    messages.add(text)
                }
            }
        }

        if (comp is Container) {
            for (child in comp.components) {
                findMessageTextsRecursive(child, messages)
            }
        }
    }

    /**
     * Try to extract text from a component using various methods.
     */
    private fun extractTextFromComponent(comp: Component): String? {
        // Try getText() method
        try {
            val getText = comp.javaClass.getMethod("getText")
            val result = getText.invoke(comp)
            if (result is String && result.isNotBlank()) {
                return result
            }
        } catch (e: Exception) {
            // Method doesn't exist or failed
        }

        // Try text property
        val textField = extractFieldValue(comp, "text")
        if (textField != null && textField.isNotBlank()) {
            return textField
        }

        // Try markdown property
        val markdownField = extractFieldValue(comp, "markdown")
        if (markdownField != null && markdownField.isNotBlank()) {
            return markdownField
        }

        // Try content property
        val contentField = extractFieldValue(comp, "content")
        if (contentField != null && contentField.isNotBlank()) {
            return contentField
        }

        return null
    }

    /**
     * Extract a string field value from a component using reflection.
     */
    private fun extractFieldValue(comp: Component, fieldName: String): String? {
        return try {
            val field = comp.javaClass.getDeclaredField(fieldName)
            field.isAccessible = true
            field.get(comp) as? String
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Find the Send button in the Copilot chat UI.
     */
    fun findSendButton(comp: Component?): Component? {
        if (comp == null) {
            LOG.debug("findSendButton: component is null")
            return null
        }
        val buttons = mutableListOf<Component>()
        CopilotChatToolWindowUtil.findComponentsByClassName(
            comp,
            CopilotClassNames.KEYBOARD_ACCESSIBLE_ACTION_BUTTON,
            buttons
        )
        for (button in buttons) {
            val action = CopilotChatToolWindowUtil.safeInvokeMethod(button, "getAction")
            if (action?.javaClass?.name == CopilotClassNames.SEND_MESSAGE_ACTION) {
                return button
            }
        }
        LOG.debug("findSendButton: No send button found among ${buttons.size} buttons")
        return null
    }
}
