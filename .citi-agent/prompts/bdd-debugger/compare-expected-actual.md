---
id: compare-expected-actual
name: Compare Expected vs Actual
description: Deep comparison of expected and actual values
outputExtraction:
  mode: json
  outputName: comparison
---

Compare the expected vs actual values from the failed assertion.

Assertion analysis: {{assertionAnalysis.failedAssertion}}
Data bindings: {{dataBindings}}

Perform:
1. Character-by-character diff if strings
2. Field-by-field diff if objects
3. Check for whitespace/encoding differences
4. Check for type coercion issues
5. Check for floating point precision

Return JSON only:
```json
{
  "expected": "expected value",
  "actual": "actual value",
  "match": false,
  "differences": [
    {
      "type": "value|type|whitespace|encoding|precision|missing|extra",
      "path": "field path for nested objects",
      "expected": "expected at this path",
      "actual": "actual at this path"
    }
  ],
  "likelyCause": "most probable reason for mismatch",
  "suggestion": "how to fix"
}
```
