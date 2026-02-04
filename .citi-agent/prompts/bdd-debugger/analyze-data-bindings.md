---
id: analyze-data-bindings
name: Analyze Data Bindings
description: Understand how test data flows into the scenario
outputExtraction:
  mode: json
  outputName: dataBindings
---

Analyze how test data binds to the scenario steps.

Data files: {{dataFiles}}
Scenario analysis: {{scenarioAnalysis}}
Failed step parameters: {{scenarioAnalysis.failedStep.parameters}}

Trace:
1. How parameters in feature file map to data
2. Data transformation or formatting
3. Environment variable substitution
4. Default values and fallbacks

Return JSON only:
```json
{
  "bindings": [
    {
      "parameter": "parameter name from step",
      "source": "where value comes from",
      "value": "actual value used",
      "transformation": "any transformation applied"
    }
  ],
  "mismatches": ["any binding issues found"],
  "suspectedBinding": "most likely problematic binding"
}
```
