---
id: root-cause-analysis
name: Root Cause Analysis
description: Synthesize findings into root cause determination
outputExtraction:
  mode: json
  outputName: rootCause
---

Synthesize all findings to determine the root cause.

Error type: {{errorContext.errorType}}
Debug findings: {{debugFindings}}

Analyze all collected evidence and determine:
1. The definitive root cause
2. Contributing factors
3. Why existing code didn't handle this case
4. Similar patterns that might fail

Return JSON only:
```json
{
  "rootCause": {
    "summary": "one sentence root cause",
    "category": "locator|data|timing|assertion|environment|code_logic",
    "confidence": "high|medium|low",
    "evidence": ["supporting evidence points"]
  },
  "contributingFactors": ["other factors that contributed"],
  "impactedAreas": ["other tests/scenarios that might be affected"],
  "preventionStrategy": "how to prevent similar issues"
}
```
