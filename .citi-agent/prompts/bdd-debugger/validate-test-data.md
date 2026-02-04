---
id: validate-test-data
name: Validate Test Data
description: Check test data values against expected formats
outputExtraction:
  mode: json
  outputName: dataValidation
---

Validate the test data used in the failed scenario.

Data bindings: {{dataBindings}}
Error message: {{parsedFailure.errorMessage}}

Check:
1. Expected vs actual values
2. Data type mismatches
3. Null or empty values
4. Format issues (dates, numbers, strings)
5. Encoding problems

Return JSON only:
```json
{
  "validations": [
    {
      "field": "field name",
      "expected": "expected value/format",
      "actual": "actual value",
      "valid": true,
      "issue": "description if invalid"
    }
  ],
  "dataIssues": ["list of data problems found"],
  "rootCause": "most likely data-related cause"
}
```
