---
id: analyze-assertions
name: Analyze Assertion Logic
description: Review assertions in the failed step
outputExtraction:
  mode: json
  outputName: assertionAnalysis
---

Analyze the assertions in this step definition.

Step code: {{stepDefinition.code}}
Error message: {{parsedFailure.errorMessage}}

Identify:
1. All assertions made (assertEquals, assertTrue, assertThat)
2. Expected vs actual values in the assertion
3. Custom matchers or conditions
4. Soft assertions vs hard assertions

Return JSON only:
```json
{
  "assertions": [
    {
      "type": "assertEquals|assertTrue|assertThat|custom",
      "expected": "expected value",
      "actual": "actual value expression",
      "message": "assertion message if any",
      "lineNumber": 0
    }
  ],
  "failedAssertion": {
    "type": "assertion type",
    "expected": "what was expected",
    "actual": "what was received",
    "lineNumber": 0
  },
  "cause": "why the assertion failed"
}
```
