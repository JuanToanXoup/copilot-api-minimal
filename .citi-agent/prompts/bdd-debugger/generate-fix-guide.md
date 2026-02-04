---
id: generate-fix-guide
name: Generate Fix Guide
description: Generate manual fix instructions when auto-fix not possible
outputExtraction:
  mode: json
  outputName: fixGuide
---

Generate a manual fix guide for this issue.

Fix strategies: {{fixStrategies}}
Root cause: {{rootCause}}

Create step-by-step instructions for a developer to fix this manually.
Include:
1. Files to examine
2. What to look for
3. Changes to make
4. How to verify the fix

Return JSON only:
```json
{
  "title": "Fix: brief description",
  "steps": [
    {
      "step": 1,
      "action": "what to do",
      "file": "file involved if any",
      "details": "detailed instructions",
      "verification": "how to verify this step"
    }
  ],
  "prerequisites": ["tools or access needed"],
  "estimatedEffort": "time estimate",
  "risks": ["things to watch out for"],
  "rollback": "how to undo if needed"
}
```
