---
id: analyze-step-impl
name: Analyze Step Implementation
description: Analyze the step definition code to understand what it does
outputExtraction:
  mode: json
  outputName: stepAnalysis
---

Analyze this step definition implementation.

{{stepDefinition.code}}

Error context: {{errorContext.errorType}}
Error message: {{parsedFailure.errorMessage}}

Identify:
1. What actions the step performs
2. Page objects or locators used
3. Assertions made
4. External dependencies (API calls, DB queries)

Return JSON only:
```json
{
  "actions": ["list of actions performed"],
  "pageObjects": ["page object classes used"],
  "locators": ["element locators referenced"],
  "assertions": ["assertions made"],
  "dependencies": ["external dependencies"],
  "suspectedLine": "line most likely causing the error",
  "suspectedCause": "initial hypothesis for failure"
}
```
