package com.citi.copilotautomation.bridge

/**
 * Centralized constants for Copilot plugin class names.
 *
 * IMPORTANT: These class names are internal to the GitHub Copilot plugin and may
 * change between versions. If UI automation stops working after a Copilot update,
 * check these class names first using the diagnoseUI command.
 *
 * Last verified with: GitHub Copilot plugin (2024.x)
 */
object CopilotClassNames {
    // Tool Window
    const val TOOL_WINDOW_ID = "GitHub Copilot Chat"

    // UI Components - Buttons
    const val KEYBOARD_ACCESSIBLE_ACTION_BUTTON = "com.github.copilot.ui.component.KeyboardAccessibleActionButton"
    const val SEND_STOP_BUTTON_PANEL = "com.github.copilot.chat.input.SendStopActionButtonPanel"

    // UI Components - Containers
    const val CHAT_TOOL_WINDOW_CONTAINER = "com.github.copilot.chat.window.CopilotChatToolWindow\$contentContainer\$1"

    // UI Components - Input
    // Note: ChatModeComboBox location varies between Copilot versions
    const val CHAT_MODE_COMBO_BOX = "com.github.copilot.agent.chatMode.component.ChatModeComboBox"
    val CHAT_MODE_COMBO_BOX_VARIANTS = listOf(
        "com.github.copilot.agent.chatMode.component.ChatModeComboBox",
        "com.github.copilot.chat.input.ChatModeComboBox",
        "com.github.copilot.chat.ui.ChatModeComboBox"
    )
    const val MODEL_PICK_PANEL = "com.github.copilot.chat.input.ModelPickPanel"
    const val AGENT_INPUT_TEXT_AREA = "com.github.copilot.agent.input.CopilotAgentInputTextArea"
    const val AGENT_INPUT_PANEL = "com.github.copilot.agent.input.CopilotAgentInputPanel"
    const val ON_OFF_BUTTON = "com.intellij.ui.components.OnOffButton"

    // UI Components - Messages/Response
    const val MARKDOWN_PANE = "com.github.copilot.agent.message.markdown.MarkdownPane"
    const val AGENT_MESSAGE_COMPONENT = "com.github.copilot.agent.message.CopilotAgentMessageComponent"
    const val MESSAGE_CONTENT_PANEL = "com.github.copilot.agent.message.MessageContentPanel"
    const val HTML_CONTENT_COMPONENT = "com.github.copilot.chat.message.HtmlContentComponent"

    // Actions
    const val STOP_ACTION = "com.github.copilot.chat.input.StopAction"
    const val SEND_MESSAGE_ACTION = "com.github.copilot.chat.input.SendMessageAction"
    const val NEW_AGENT_SESSION_ACTION = "com.github.copilot.agent.window.actions.NewAgentSessionAction"

    // All message component class names for extraction
    // Note: HTML_CONTENT_COMPONENT excluded as it contains the welcome message, not actual responses
    val MESSAGE_COMPONENTS = listOf(
        MARKDOWN_PANE,
        AGENT_MESSAGE_COMPONENT,
        MESSAGE_CONTENT_PANEL
    )

    /**
     * Known model names for matching by name instead of index.
     */
    object ModelNames {
        const val GPT_4O = "GPT-4o"
        const val GPT_4_1 = "GPT-4.1"
        const val CLAUDE_SONNET = "Claude 3.5 Sonnet"
        const val CLAUDE_SONNET_4 = "Claude Sonnet 4"
        const val GEMINI_PRO = "Gemini 2.0 Flash"
        const val GEMINI_PRO_ALT = "Gemini Pro"

        val GPT_VARIANTS = listOf(GPT_4O, GPT_4_1)
        val CLAUDE_VARIANTS = listOf(CLAUDE_SONNET_4, CLAUDE_SONNET)
        val GEMINI_VARIANTS = listOf(GEMINI_PRO, GEMINI_PRO_ALT)
    }

    /**
     * Chat mode names.
     */
    object ChatModes {
        const val ASK = "Ask"
        const val AGENT = "Agent"

        const val ASK_INDEX = 0
        const val AGENT_INDEX = 1
    }

    /**
     * Fallback indices for model selection.
     */
    object ModelIndices {
        const val CLAUDE_SONNET_4 = 1
        const val GEMINI_PRO = 2
        const val GPT = 4
    }
}
