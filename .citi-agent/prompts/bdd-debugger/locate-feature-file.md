---
id: locate-feature-file
name: Locate Feature File
description: Find and read the relevant .feature file
outputExtraction:
  mode: json
  outputName: featureFile
---

Based on this error context, locate the .feature file.

{{errorContext}}

Search for feature files matching the scenario name or path hints.
Read the feature file content.

Return JSON only:
```json
{
  "filePath": "full path to the .feature file",
  "content": "full content of the feature file",
  "scenarioLine": "line number where the scenario starts",
  "failedStepLine": "line number of the failed step"
}
```
