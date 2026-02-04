---
id: analyze-gherkin-scenario
name: Analyze Gherkin Scenario
description: Understand the scenario intent and identify the failed step context
outputExtraction:
  mode: json
  outputName: scenarioAnalysis
---

Analyze this Gherkin feature file to understand the failed scenario.

Feature file:
{{featureFile.content}}

Failed step: {{errorContext.failedStep}}

Identify:
1. What the scenario is testing
2. The data/parameters used in the failed step
3. Any Example tables or Scenario Outline parameters
4. Steps that executed before the failure

Return JSON only:
```json
{
  "scenarioIntent": "what this scenario is testing",
  "failedStep": {
    "keyword": "Given|When|Then",
    "text": "step text",
    "parameters": ["any <parameters> or data"],
    "lineNumber": 0
  },
  "precedingSteps": ["steps that ran before failure"],
  "dataTable": null,
  "exampleData": null
}
```
