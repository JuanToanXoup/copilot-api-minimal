package com.citi.copilotautomation.bridge

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

object CopilotChatUtil {
    private val LOG = Logger.getInstance(CopilotChatUtil::class.java)

    /**
     * Send text to the Copilot chat input and trigger send.
     *
     * NOTE: The onSendTriggered callback is invoked on the EDT (Event Dispatch Thread).
     * Callers should handle thread synchronization if needed.
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
                    LOG.warn("sendToCopilotChat: '${CopilotClassNames.TOOL_WINDOW_ID}' tool window not found.")
                    return@invokeLater
                }

                if (!toolWindow.isActive) {
                    toolWindow.activate(null)
                }

                val content = toolWindow.contentManager.getContent(0)
                if (content == null) {
                    LOG.warn("sendToCopilotChat: Tool window has no content at index 0")
                    return@invokeLater
                }

                val component = content.component

                // Use the new extended finder that supports Editor components
                val chatInputResult = UIFinderUtil.findChatInputEx(component)
                if (chatInputResult == null) {
                    LOG.warn("sendToCopilotChat: Chat input not found in component tree")
                    logAvailableComponents(component)
                    return@invokeLater
                }

                LOG.info("sendToCopilotChat: Found chat input type: ${chatInputResult.type}, class: ${chatInputResult.component.javaClass.name}")

                // Set the text based on the input type
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
                    LOG.warn("sendToCopilotChat: Failed to set text on chat input")
                    return@invokeLater
                }
                LOG.info("sendToCopilotChat: Text set successfully, attempting to send...")

                // Try to send the message
                val sent = when (chatInputResult.type) {
                    UIFinderUtil.ChatInputResult.InputType.EDITOR -> {
                        trySendFromEditor(project, chatInputResult.editor!!, chatInputResult.component)
                    }
                    else -> {
                        trySendViaEnterKey(chatInputResult.component) || trySendViaButton(chatInputResult.component)
                    }
                }

                if (sent) {
                    LOG.info("sendToCopilotChat: Message sent successfully")
                    onSendTriggered?.run()
                } else {
                    LOG.error("sendToCopilotChat: Could not find a way to send the prompt")
                }

            } catch (e: Exception) {
                LOG.error("sendToCopilotChat: Exception while interacting with Copilot UI.", e)
            }
        }
    }

    /**
     * Set text on an IntelliJ Editor component.
     */
    private fun setTextOnEditor(project: Project, editor: Editor, text: String): Boolean {
        return try {
            WriteCommandAction.runWriteCommandAction(project) {
                val document = editor.document
                document.setText(text)
                // Move caret to end
                editor.caretModel.moveToOffset(document.textLength)
            }
            LOG.debug("setTextOnEditor: Text set successfully")
            true
        } catch (e: Exception) {
            LOG.warn("setTextOnEditor: Failed to set text: ${e.message}")
            false
        }
    }

    /**
     * Set text on a JTextComponent.
     */
    private fun setTextOnTextComponent(component: JTextComponent, text: String): Boolean {
        return try {
            component.text = text
            // Move caret to end
            component.caretPosition = text.length
            true
        } catch (e: Exception) {
            LOG.warn("setTextOnTextComponent: Failed to set text: ${e.message}")
            false
        }
    }

    /**
     * Try to send from an Editor by simulating Enter key or clicking send button.
     */
    private fun trySendFromEditor(project: Project, editor: Editor, editorComponent: java.awt.Component): Boolean {
        // First try: Dispatch key event directly to the editor component
        try {
            val keyPressEvent = KeyEvent(
                editorComponent,
                KeyEvent.KEY_PRESSED,
                System.currentTimeMillis(),
                0,
                KeyEvent.VK_ENTER,
                '\n'
            )
            val keyTypedEvent = KeyEvent(
                editorComponent,
                KeyEvent.KEY_TYPED,
                System.currentTimeMillis(),
                0,
                KeyEvent.VK_UNDEFINED,
                '\n'
            )
            val keyReleasedEvent = KeyEvent(
                editorComponent,
                KeyEvent.KEY_RELEASED,
                System.currentTimeMillis(),
                0,
                KeyEvent.VK_ENTER,
                '\n'
            )

            editorComponent.dispatchEvent(keyPressEvent)
            editorComponent.dispatchEvent(keyTypedEvent)
            editorComponent.dispatchEvent(keyReleasedEvent)

            LOG.info("trySendFromEditor: Dispatched ENTER key events")
            // Don't return true here - let's also try the button as a backup
        } catch (e: Exception) {
            LOG.debug("trySendFromEditor: Key dispatch failed: ${e.message}")
        }

        // Second try: Find and click the send button
        val toolWindow = ToolWindowManager.getInstance(project).getToolWindow(CopilotClassNames.TOOL_WINDOW_ID)
        val rootComponent = toolWindow?.component
        if (rootComponent != null) {
            val sendButton = UIFinderUtil.findSendButton(rootComponent)
            if (sendButton is AbstractButton) {
                sendButton.doClick()
                LOG.info("trySendFromEditor: Clicked send button")
                return true
            } else {
                LOG.warn("trySendFromEditor: Send button not found or not an AbstractButton")
            }
        }

        // If we dispatched key events, consider it a success
        return true
    }

    /**
     * Log available component types for debugging.
     */
    private fun logAvailableComponents(root: java.awt.Component) {
        val types = mutableSetOf<String>()
        collectComponentTypes(root, types)
        LOG.warn("sendToCopilotChat: Available component types in tree:")
        types.filter {
            it.contains("text", ignoreCase = true) ||
            it.contains("input", ignoreCase = true) ||
            it.contains("editor", ignoreCase = true) ||
            it.contains("copilot", ignoreCase = true)
        }.forEach { LOG.warn("  - $it") }
    }

    private fun collectComponentTypes(comp: java.awt.Component?, types: MutableSet<String>) {
        if (comp == null) return
        types.add(comp.javaClass.name)
        if (comp is java.awt.Container) {
            for (child in comp.components) {
                collectComponentTypes(child, types)
            }
        }
    }

    /**
     * Try to send the message by triggering the Enter key action.
     * @return true if the Enter action was found and triggered
     */
    private fun trySendViaEnterKey(chatInput: java.awt.Component): Boolean {
        val jComponent = chatInput as? JComponent
        if (jComponent == null) {
            LOG.warn("trySendViaEnterKey: chatInput is not a JComponent")
            return false
        }

        val inputMap = jComponent.getInputMap(JComponent.WHEN_FOCUSED)
        val actionMap = jComponent.actionMap

        val enterActionKey = inputMap.get(KeyStroke.getKeyStroke("ENTER"))
        if (enterActionKey == null) {
            LOG.warn("trySendViaEnterKey: No ENTER key binding found in input map")
            return false
        }

        val enterAction = actionMap.get(enterActionKey)
        if (enterAction == null) {
            LOG.warn("trySendViaEnterKey: No action found for ENTER key binding '$enterActionKey'")
            return false
        }

        LOG.debug("trySendViaEnterKey: Found enter action: ${enterAction.javaClass.name}")

        return try {
            val event = ActionEvent(chatInput, ActionEvent.ACTION_PERFORMED, enterActionKey.toString())
            enterAction.actionPerformed(event)
            LOG.info("trySendViaEnterKey: Enter action performed successfully")
            true
        } catch (e: Exception) {
            LOG.warn("trySendViaEnterKey: Failed to perform Enter action: ${e.message}")
            false
        }
    }

    /**
     * Try to send the message by clicking the send button.
     * @return true if the button was found and clicked
     */
    private fun trySendViaButton(chatInput: java.awt.Component): Boolean {
        val sendButton = UIFinderUtil.findSendButton(chatInput.parent)

        if (sendButton is AbstractButton) {
            return try {
                sendButton.doClick()
                LOG.info("trySendViaButton: Send button clicked")
                true
            } catch (e: Exception) {
                LOG.warn("trySendViaButton: Failed to click send button: ${e.message}")
                false
            }
        }

        LOG.warn("trySendViaButton: Send button not found")
        return false
    }
}
