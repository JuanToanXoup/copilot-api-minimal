# Copilot API Tests

Individual test scripts for each WebSocket API action.

## Setup

```bash
pip install websocket-client
```

## Running Tests

### Run all tests
```bash
python run_all.py
python run_all.py --port 9000          # Custom port
python run_all.py --skip-slow          # Skip Copilot prompt tests
python run_all.py --skip-shutdown      # Keep server running
python run_all.py --only test_ping.py  # Run single test
```

### Run individual tests
```bash
python test_ping.py
python test_ping.py --port 9000

python test_copilot_prompt.py --port 8765
python test_cli_command.py --command "ls -la"
```

## Available Tests

| File | Action |
|------|--------|
| `test_ping.py` | Ping/pong connectivity check |
| `test_copilot_prompt.py` | Send prompt to Copilot (slow) |
| `test_set_ask_mode.py` | Set Ask chat mode |
| `test_set_agent_mode.py` | Set Agent chat mode |
| `test_set_model_gpt.py` | Switch to GPT-4o |
| `test_set_model_claude.py` | Switch to Claude Sonnet 4 |
| `test_set_model_gemini.py` | Switch to Gemini Pro |
| `test_new_session.py` | Start new agent session |
| `test_cli_command.py` | Run CLI command |
| `test_get_current_prompt.py` | Get currently executing prompt |
| `test_get_pending_prompts.py` | Get queued prompts |
| `test_diagnose_ui.py` | Run UI diagnostics |
| `test_inspect_input.py` | Inspect chat input component |
| `test_shutdown.py` | Shutdown server (destructive) |

## Shared Client

All tests use `client.py` which provides:
- `CopilotClient` - WebSocket client class
- `get_port()` - Parse command line args
- `print_result()` - Format test output

## Exit Codes

- `0` - Test passed
- `1` - Test failed
