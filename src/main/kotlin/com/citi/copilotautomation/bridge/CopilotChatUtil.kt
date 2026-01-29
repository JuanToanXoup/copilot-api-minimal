package com.citi.copilotautomation.bridge

import com.citi.copilotautomation.core.ComponentFinder
import com.intellij.openapi.command.WriteCommandAction
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindowManager
import java.awt.event.ActionEvent
import java.awt.event.KeyEvent
import javax.swing.AbstractButton
import javax.swing.JComponent
import javax.swing.KeyStroke
import javax.swing.SwingUtilities
import javax.swing.text.JTextComponent

/**
 * Utility for sending messages to the Copilot chat input.
 */
object CopilotChatUtil {
    private val LOG = Logger.getInstance(CopilotChatUtil::class.java)

    /**
     * Send text to the Copilot chat input and trigger send.
     *
     * NOTE: The onSendTriggered callback is invoked on the EDT (Event Dispatch Thread).
     *
     * @param project The current project
     * @param text The text to send to Copilot
     * @param onSendTriggered Callback invoked after send is triggered (on EDT), or null
     */
    fun sendToCopilotChat(project: Project, text: String, onSendTriggered: Runnable?) {
        SwingUtilities.invokeLater {
            try {
                val toolWindow = ToolWindowManager.getInstance(project)
                    .getToolWindow(CopilotClassNames.TOOL_WINDOW_ID)

                if (toolWindow == null) {
                    LOG.warn("sendToCopilotChat: Tool window not found")
                    return@invokeLater
                }

                if (!toolWindow.isActive) {
                    toolWindow.activate(null)
                }

                val content = toolWindow.contentManager.getContent(0)
                if (content == null) {
                    LOG.warn("sendToCopilotChat: No content in tool window")
                    return@invokeLater
                }

                val chatInputResult = UIFinderUtil.findChatInputEx(content.component)
                if (chatInputResult == null) {
                    LOG.warn("sendToCopilotChat: Chat input not found")
                    logAvailableInputComponents(content.component)
                    return@invokeLater
                }

                LOG.info("sendToCopilotChat: Found ${chatInputResult.type}, class: ${chatInputResult.component.javaClass.name}")

                // Set text based on input type
                val textSet = when (chatInputResult.type) {
                    UIFinderUtil.ChatInputResult.InputType.EDITOR -> {
                        setTextOnEditor(project, chatInputResult.editor!!, text)
                    }
                    UIFinderUtil.ChatInputResult.InputType.TEXT_AREA,
                    UIFinderUtil.ChatInputResult.InputType.TEXT_COMPONENT -> {
                        setTextOnTextComponent(chatInputResult.component as JTextComponent, text)
                    }
                }

                if (!textSet) {
                    LOG.warn("sendToCopilotChat: Failed to set text")
                    return@invokeLater
                }

                LOG.info("sendToCopilotChat: Text set, attempting to send...")

                // Try to send
                val sent = when (chatInputResult.type) {
                    UIFinderUtil.ChatInputResult.InputType.EDITOR -> {
                        trySendFromEditor(project, chatInputResult.component)
                    }
                    else -> {
                        trySendViaEnterKey(chatInputResult.component) ||
                            trySendViaButton(toolWindow.component)
                    }
                }

                if (sent) {
                    LOG.info("sendToCopilotChat: Message sent successfully")
                    onSendTriggered?.run()
                } else {
                    LOG.error("sendToCopilotChat: Could not send message")
                }

            } catch (e: Exception) {
                LOG.error("sendToCopilotChat: Exception", e)
            }
        }
    }

    // =========================================================================
    // Text Setting
    // =========================================================================

    private fun setTextOnEditor(project: Project, editor: Editor, text: String): Boolean {
        return try {
            WriteCommandAction.runWriteCommandAction(project) {
                val document = editor.document
                document.setText(text)
                editor.caretModel.moveToOffset(document.textLength)
            }
            true
        } catch (e: Exception) {
            LOG.warn("setTextOnEditor: Failed: ${e.message}")
            false
        }
    }

    private fun setTextOnTextComponent(component: JTextComponent, text: String): Boolean {
        return try {
            component.text = text
            component.caretPosition = text.length
            true
        } catch (e: Exception) {
            LOG.warn("setTextOnTextComponent: Failed: ${e.message}")
            false
        }
    }

    // =========================================================================
    // Send Triggers
    // =========================================================================

    private fun trySendFromEditor(project: Project, editorComponent: java.awt.Component): Boolean {
        // Dispatch key events
        try {
            dispatchEnterKeyEvents(editorComponent)
            LOG.info("trySendFromEditor: Dispatched ENTER key events")
        } catch (e: Exception) {
            LOG.debug("trySendFromEditor: Key dispatch failed: ${e.message}")
        }

        // Also try button click as backup
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow(CopilotClassNames.TOOL_WINDOW_ID)
        val rootComponent = toolWindow?.component
        if (rootComponent != null) {
            val sendButton = UIFinderUtil.findSendButton(rootComponent)
            if (sendButton is AbstractButton) {
                sendButton.doClick()
                LOG.info("trySendFromEditor: Clicked send button")
                return true
            }
        }

        return true // Key events were dispatched
    }

    private fun dispatchEnterKeyEvents(component: java.awt.Component) {
        val keyPress = KeyEvent(
            component, KeyEvent.KEY_PRESSED,
            System.currentTimeMillis(), 0,
            KeyEvent.VK_ENTER, '\n'
        )
        val keyTyped = KeyEvent(
            component, KeyEvent.KEY_TYPED,
            System.currentTimeMillis(), 0,
            KeyEvent.VK_UNDEFINED, '\n'
        )
        val keyRelease = KeyEvent(
            component, KeyEvent.KEY_RELEASED,
            System.currentTimeMillis(), 0,
            KeyEvent.VK_ENTER, '\n'
        )

        component.dispatchEvent(keyPress)
        component.dispatchEvent(keyTyped)
        component.dispatchEvent(keyRelease)
    }

    private fun trySendViaEnterKey(chatInput: java.awt.Component): Boolean {
        val jComponent = chatInput as? JComponent ?: return false

        val inputMap = jComponent.getInputMap(JComponent.WHEN_FOCUSED)
        val actionMap = jComponent.actionMap

        val enterActionKey = inputMap.get(KeyStroke.getKeyStroke("ENTER")) ?: return false
        val enterAction = actionMap.get(enterActionKey) ?: return false

        return try {
            val event = ActionEvent(chatInput, ActionEvent.ACTION_PERFORMED, enterActionKey.toString())
            enterAction.actionPerformed(event)
            LOG.info("trySendViaEnterKey: Enter action performed")
            true
        } catch (e: Exception) {
            LOG.warn("trySendViaEnterKey: Failed: ${e.message}")
            false
        }
    }

    private fun trySendViaButton(rootComponent: java.awt.Component): Boolean {
        val sendButton = UIFinderUtil.findSendButton(rootComponent)
        if (sendButton is AbstractButton) {
            return try {
                sendButton.doClick()
                LOG.info("trySendViaButton: Button clicked")
                true
            } catch (e: Exception) {
                LOG.warn("trySendViaButton: Failed: ${e.message}")
                false
            }
        }
        LOG.warn("trySendViaButton: Send button not found")
        return false
    }

    // =========================================================================
    // Diagnostics
    // =========================================================================

    private fun logAvailableInputComponents(root: java.awt.Component) {
        val classNames = ComponentFinder.collectClassNames(root)
        val inputRelated = classNames.keys.filter { name ->
            name.contains("text", ignoreCase = true) ||
                name.contains("input", ignoreCase = true) ||
                name.contains("editor", ignoreCase = true) ||
                name.contains("copilot", ignoreCase = true)
        }

        LOG.warn("Available input-related components:")
        inputRelated.forEach { LOG.warn("  - $it") }
    }
}
