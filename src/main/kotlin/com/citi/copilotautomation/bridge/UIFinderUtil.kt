package com.citi.copilotautomation.bridge

import com.citi.copilotautomation.core.ComponentFinder
import com.citi.copilotautomation.core.ReflectionUtil
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.impl.EditorComponentImpl
import com.intellij.ui.components.JBScrollPane
import java.awt.Component
import java.awt.Container
import javax.swing.JTextArea
import javax.swing.text.JTextComponent

/**
 * Utility for finding specific UI components in the Copilot chat interface.
 */
object UIFinderUtil {
    private val LOG = Logger.getInstance(UIFinderUtil::class.java)

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

    // =========================================================================
    // Stop Button Detection (for generation monitoring)
    // =========================================================================

    /**
     * Count visible Stop action buttons to detect if Copilot is generating.
     */
    fun countVisibleStopActionButtons(rootComponent: Component?): Int {
        if (rootComponent == null) {
            LOG.debug("countVisibleStopActionButtons: rootComponent is null")
            return 0
        }

        return ComponentFinder.countVisibleWithAction(
            rootComponent,
            CopilotClassNames.KEYBOARD_ACCESSIBLE_ACTION_BUTTON,
            CopilotClassNames.STOP_ACTION
        )
    }

    // =========================================================================
    // Chat Input Finding
    // =========================================================================

    /**
     * Find the chat input component. Supports:
     * - CopilotAgentInputTextArea (the actual Copilot chat input)
     * - EditorComponentImpl (IntelliJ Editor)
     * - JTextArea (legacy)
     */
    fun findChatInputEx(comp: Component?): ChatInputResult? {
        if (comp == null) return null

        // FIRST: Look specifically for the Copilot input text area
        val copilotInput = ComponentFinder.findFirstByClassName(comp, CopilotClassNames.AGENT_INPUT_TEXT_AREA)
        if (copilotInput != null) {
            LOG.info("findChatInputEx: Found CopilotAgentInputTextArea, class: ${copilotInput.javaClass.name}")

            // The CopilotAgentInputTextArea usually contains an EditorComponentImpl
            // Search within it first
            if (copilotInput is Container) {
                val editorInside = ComponentFinder.findFirstByType<EditorComponentImpl>(copilotInput)
                if (editorInside != null) {
                    LOG.info("findChatInputEx: Found EditorComponentImpl inside CopilotAgentInputTextArea")
                    return ChatInputResult(editorInside, editorInside.editor, ChatInputResult.InputType.EDITOR)
                }
            }

            // Check if it's a JTextComponent directly
            if (copilotInput is JTextComponent) {
                LOG.info("findChatInputEx: CopilotAgentInputTextArea is JTextComponent")
                return ChatInputResult(copilotInput, null, ChatInputResult.InputType.TEXT_COMPONENT)
            }

            // Log what's inside for debugging
            if (copilotInput is Container) {
                LOG.info("findChatInputEx: CopilotAgentInputTextArea children: ${copilotInput.components.map { it.javaClass.name }}")
            }

            // Return as generic - will likely fail but lets us see the logs
            return ChatInputResult(copilotInput, null, ChatInputResult.InputType.TEXT_COMPONENT)
        }

        // SECOND: Look for IntelliJ Editor component anywhere in the tree
        val editorComponent = ComponentFinder.findFirstByType<EditorComponentImpl>(comp)
        if (editorComponent != null) {
            LOG.info("findChatInputEx: Found EditorComponentImpl directly")
            return ChatInputResult(editorComponent, editorComponent.editor, ChatInputResult.InputType.EDITOR)
        }

        // THIRD: Check for JTextArea (but NOT HtmlContentComponent which is for display)
        val textArea = ComponentFinder.findFirstByPredicate(comp) { c ->
            c is JTextArea && !c.javaClass.name.contains("HtmlContent")
        }
        if (textArea != null) {
            LOG.info("findChatInputEx: Found JTextArea: ${textArea.javaClass.name}")
            return ChatInputResult(textArea, null, ChatInputResult.InputType.TEXT_AREA)
        }

        LOG.warn("findChatInputEx: No chat input found")
        return null
    }

    /**
     * Find an Editor inside a container.
     */
    private fun findEditorInContainer(container: Container): ChatInputResult? {
        val editor = ComponentFinder.findFirstByType<EditorComponentImpl>(container)
        if (editor != null) {
            return ChatInputResult(editor, editor.editor, ChatInputResult.InputType.EDITOR)
        }
        return null
    }

    // =========================================================================
    // Scroll Pane Finding
    // =========================================================================

    /**
     * Find the first JBScrollPane in the component tree.
     */
    fun findChatScrollPane(comp: Component?): Component? {
        return ComponentFinder.findFirstByType<JBScrollPane>(comp)
    }

    // =========================================================================
    // Message/Response Extraction
    // =========================================================================

    /**
     * Find all message/response components (Copilot responses).
     * Supports both old MarkdownPane and new message components.
     */
    fun findMarkdownPanes(comp: Component?, result: MutableList<Component>) {
        if (comp == null) return

        for (className in CopilotClassNames.MESSAGE_COMPONENTS) {
            result.addAll(ComponentFinder.findByClassName(comp, className))
        }
    }

    /**
     * Find all message components and extract their text content.
     */
    fun findAllMessageTexts(comp: Component?): List<String> {
        if (comp == null) return emptyList()

        val messages = mutableListOf<String>()

        for (className in CopilotClassNames.MESSAGE_COMPONENTS) {
            val components = ComponentFinder.findByClassName(comp, className)
            for (component in components) {
                val text = ReflectionUtil.extractText(component)
                if (text != null && text.isNotBlank()) {
                    messages.add(text)
                }
            }
        }

        return messages
    }

    // =========================================================================
    // Send Button Finding
    // =========================================================================

    /**
     * Find the Send button in the Copilot chat UI.
     */
    fun findSendButton(comp: Component?): Component? {
        if (comp == null) {
            LOG.debug("findSendButton: component is null")
            return null
        }

        val button = ComponentFinder.findButtonWithAction(
            comp,
            CopilotClassNames.KEYBOARD_ACCESSIBLE_ACTION_BUTTON,
            CopilotClassNames.SEND_MESSAGE_ACTION,
            mustBeVisible = false
        )

        if (button == null) {
            LOG.debug("findSendButton: No send button found")
        }

        return button
    }

    // =========================================================================
    // Editor Finding
    // =========================================================================

    /**
     * Find all Editor components in the tree.
     */
    fun findAllEditors(comp: Component?): List<Editor> {
        return ComponentFinder.findByType<EditorComponentImpl>(comp).map { it.editor }
    }
}
