#!/usr/bin/env python3
"""Test: Set Copilot model to Gemini 2.5 Pro."""

from client import CopilotClient, get_port, print_result

def main():
    host, port, timeout = get_port()

    with CopilotClient(host, port, timeout) as client:
        response = client.send({"type": "setModelGeminiPro"})
        return print_result("Set Model Gemini 2.5 Pro", response)

if __name__ == "__main__":
    exit(0 if main() else 1)
