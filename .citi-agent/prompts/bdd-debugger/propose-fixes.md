---
id: propose-fixes
name: Propose Fix Strategies
description: Generate fix strategies based on root cause
outputExtraction:
  mode: json
  outputName: fixStrategies
---

Propose fix strategies for this root cause.

Root cause: {{rootCause}}

Generate multiple fix approaches:
1. Quick fix - minimal change to unblock
2. Proper fix - address root cause correctly
3. Robust fix - prevent future occurrences

Consider:
- Code changes needed
- Data changes needed
- Configuration changes needed
- Test design improvements

Return JSON only:
```json
{
  "strategies": [
    {
      "name": "quick_fix|proper_fix|robust_fix",
      "description": "what this fix does",
      "changes": [
        {
          "file": "file to modify",
          "type": "modify|add|delete|config",
          "description": "what to change"
        }
      ],
      "effort": "low|medium|high",
      "risk": "low|medium|high"
    }
  ],
  "recommended": "which strategy to use",
  "canAutoFix": true,
  "requiresManualReview": ["aspects needing human review"]
}
```
