package com.citi.copilotautomation.bridge

/**
 * Centralized constants for Copilot plugin class names.
 *
 * IMPORTANT: These class names are internal to the GitHub Copilot plugin and may
 * change between versions. If UI automation stops working after a Copilot update,
 * check these class names first.
 *
 * Last verified with: GitHub Copilot plugin (2024.x)
 */
object CopilotClassNames {
    // UI Components
    const val KEYBOARD_ACCESSIBLE_ACTION_BUTTON = "com.github.copilot.ui.component.KeyboardAccessibleActionButton"
    const val CHAT_TOOL_WINDOW_CONTAINER = "com.github.copilot.chat.window.CopilotChatToolWindow\$contentContainer\$1"
    // Updated: moved from chat.input to agent.chatMode.component in newer versions
    const val CHAT_MODE_COMBO_BOX = "com.github.copilot.agent.chatMode.component.ChatModeComboBox"
    const val MODEL_PICK_PANEL = "com.github.copilot.chat.input.ModelPickPanel"
    const val ON_OFF_BUTTON = "com.intellij.ui.components.OnOffButton"
    // Response/message components (updated for newer Copilot versions)
    const val MARKDOWN_PANE = "com.github.copilot.agent.message.markdown.MarkdownPane"  // Legacy
    const val AGENT_MESSAGE_COMPONENT = "com.github.copilot.agent.message.CopilotAgentMessageComponent"
    const val MESSAGE_CONTENT_PANEL = "com.github.copilot.agent.message.MessageContentPanel"
    const val HTML_CONTENT_COMPONENT = "com.github.copilot.chat.message.HtmlContentComponent"

    // Chat input component - this is where users type their prompts
    const val AGENT_INPUT_TEXT_AREA = "com.github.copilot.agent.input.CopilotAgentInputTextArea"
    const val AGENT_INPUT_PANEL = "com.github.copilot.agent.input.CopilotAgentInputPanel"

    // Send/Stop button panel
    const val SEND_STOP_BUTTON_PANEL = "com.github.copilot.chat.input.SendStopActionButtonPanel"

    // Actions
    const val STOP_ACTION = "com.github.copilot.chat.input.StopAction"
    const val SEND_MESSAGE_ACTION = "com.github.copilot.chat.input.SendMessageAction"
    const val NEW_AGENT_SESSION_ACTION = "com.github.copilot.agent.window.actions.NewAgentSessionAction"

    // Tool Window
    const val TOOL_WINDOW_ID = "GitHub Copilot Chat"

    // Known model names (for matching by name instead of index)
    object ModelNames {
        const val GPT_4O = "GPT-4o"
        const val GPT_4_1 = "GPT-4.1"
        const val CLAUDE_SONNET = "Claude 3.5 Sonnet"
        const val CLAUDE_SONNET_4 = "Claude Sonnet 4"
        const val GEMINI_PRO = "Gemini 2.0 Flash"
        const val GEMINI_PRO_ALT = "Gemini Pro"
    }

    // Chat mode names
    object ChatModes {
        const val ASK = "Ask"
        const val AGENT = "Agent"
    }
}
