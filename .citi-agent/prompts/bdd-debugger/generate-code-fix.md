---
id: generate-code-fix
name: Generate Code Fix
description: Generate actual code changes to fix the issue
outputExtraction:
  mode: json
  outputName: codeFix
---

Generate the code fix for the recommended strategy.

Fix strategy: {{fixStrategies.recommended}}
Strategy details: {{fixStrategies.strategies}}
Step definition: {{stepDefinition}}
Root cause: {{rootCause}}

Generate:
1. The exact code changes needed
2. Before and after for each file
3. Any new files to create
4. Import statements needed

Return JSON only:
```json
{
  "changes": [
    {
      "file": "path/to/file",
      "action": "modify|create|delete",
      "before": "original code block",
      "after": "fixed code block",
      "lineStart": 0,
      "lineEnd": 0,
      "explanation": "why this change"
    }
  ],
  "newFiles": [
    {
      "path": "path/to/new/file",
      "content": "full file content"
    }
  ],
  "testCommand": "command to run to verify fix"
}
```
