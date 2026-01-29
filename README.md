# Copilot API Minimal

An IntelliJ IDEA plugin that provides a WebSocket API for automating GitHub Copilot Chat interactions.

## Overview

This plugin exposes a WebSocket server that allows external applications to:
- Send prompts to GitHub Copilot Chat
- Control chat modes (Ask/Agent)
- Switch between AI models (GPT-4o, Claude Sonnet 4, Gemini Pro)
- Execute CLI commands
- Manage chat sessions

## Requirements

- IntelliJ IDEA 2024.3+ (Community or Ultimate)
- GitHub Copilot plugin installed and configured
- Java 21+

## Installation

### From Source

```bash
# Clone the repository
git clone <repository-url>
cd copilot-api-minimal

# Build the plugin
./gradlew buildPlugin

# The plugin ZIP will be at build/distributions/
```

### Install in IDE

1. Open IntelliJ IDEA
2. Go to **Settings** → **Plugins** → **⚙️** → **Install Plugin from Disk...**
3. Select the built ZIP file from `build/distributions/`
4. Restart the IDE

## Usage

### Tool Window

Once installed, a **"Copilot API"** tool window appears at the bottom of the IDE showing:
- WebSocket port number
- Server status (Running/Stopped)
- Active connections count
- Restart button for server recovery

### Configuration

The plugin creates a configuration file at `.citi-agent/project-agent-config.json` in your project root:

```json
{
  "agentName": "Default Agent",
  "agentDescription": "Default description",
  "port": 8765
}
```

If `port` is set to `0`, a random available port will be assigned.

### Connecting

Connect to the WebSocket server at `ws://localhost:<port>`. On connection, the server sends the agent configuration.

## WebSocket API

All messages are JSON objects with a `type` field.

### Copilot Prompts

**Send a prompt to Copilot:**
```json
{"type": "copilotPrompt", "prompt": "Write a hello world function"}
```

**Response (immediate):**
```json
{"type": "copilotPrompt", "status": "executing", "message": "Prompt is being executed"}
```

**Response (final):**
```json
{"type": "copilotPromptResult", "status": "success", "prompt": "...", "content": "..."}
```

### Chat Mode Control

**Set Ask mode:**
```json
{"type": "setAskChatMode"}
```

**Set Agent mode:**
```json
{"type": "setAgentChatMode"}
```

### Model Selection

**Switch to GPT-4o:**
```json
{"type": "setModelGPT"}
```

**Switch to Claude Sonnet 4:**
```json
{"type": "setModelClaudeSonnet4"}
```

**Switch to Gemini Pro:**
```json
{"type": "setModelGeminiPro"}
```

### Session Management

**Start new agent session:**
```json
{"type": "newAgentSession"}
```

### Queue Status

**Get current prompt:**
```json
{"type": "getCurrentPrompt"}
```

**Get pending prompts:**
```json
{"type": "getPendingPrompts"}
```

### CLI Commands

**Run a shell command:**
```json
{"type": "runCliCommand", "command": "ls -la"}
```

Allowed commands: `ls`, `pwd`, `whoami`, `date`, `echo`, `cat`, `uptime`, `find`, `grep`, `curl`, `python3`, `sh`, `git`, `jq`, `node`, `java`, `gradlew`

### Diagnostics

**Diagnose UI components:**
```json
{"type": "diagnoseUI"}
```

**Inspect input component:**
```json
{"type": "inspectInput"}
```

### Server Control

**Shutdown server:**
```json
{"type": "shutdown"}
```

**Ping/Pong:**
```
ping → pong
```

## Testing

A Python test script is included:

```bash
# Install dependency
pip install websocket-client

# Run all tests
python test_copilot_api.py

# Skip slow Copilot prompt tests
python test_copilot_api.py --skip-copilot

# Use custom port
python test_copilot_api.py --port 9000

# Keep server running after tests
python test_copilot_api.py --skip-shutdown
```

## Development

### Build Commands

```bash
./gradlew build              # Compile and test
./gradlew buildPlugin        # Create installable plugin ZIP
./gradlew runIde             # Run IDE with plugin installed
./gradlew verifyPlugin       # Verify plugin compatibility
./gradlew incrementVersion   # Bump patch version
./gradlew info               # Show build information
```

### Project Structure

```
src/main/kotlin/com/citi/
├── agent/
│   └── AgentProjectManagerListener.kt    # Project lifecycle
├── copilotautomation/
│   ├── bridge/
│   │   ├── CopilotChatToolWindowUtil.kt  # UI automation helpers
│   │   ├── CopilotChatUtil.kt            # Chat input/send
│   │   ├── CopilotClassNames.kt          # Copilot UI class names
│   │   ├── UIDiagnostics.kt              # Debug utilities
│   │   └── UIFinderUtil.kt               # Component finding
│   ├── config/
│   │   └── ProjectAgentConfig.kt         # Per-project config
│   ├── core/
│   │   ├── ComponentFinder.kt            # UI tree traversal
│   │   ├── JsonUtil.kt                   # JSON utilities
│   │   ├── ReflectionUtil.kt             # Reflection helpers
│   │   ├── ResponseBuilder.kt            # API response building
│   │   └── ServerConfig.kt               # Server constants
│   ├── ui/
│   │   └── PortDisplayToolWindowFactory.kt  # Status tool window
│   └── websocket/
│       ├── CopilotWebSocketProjectService.kt  # Service lifecycle
│       └── CopilotWebSocketServer.kt          # WebSocket server
```

## Troubleshooting

### Server won't start
- Check if the port is already in use
- Use the **Restart** button in the tool window
- Check IDE logs for errors

### Prompts not working
- Ensure GitHub Copilot Chat window is open
- Verify Copilot is authenticated and working
- Try running `diagnoseUI` command to check UI state

### Tool window shows "indexes being built"
- This is fixed in recent versions with `DumbAware` support
- If persists, wait for indexing to complete

## License

Proprietary - Citigroup

## Contributing

Internal contributions welcome. Please follow existing code style and add tests for new features.
