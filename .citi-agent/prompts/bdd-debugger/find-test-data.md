---
id: find-test-data
name: Find Test Data Files
description: Locate test data files based on scenario tags or naming
outputExtraction:
  mode: json
  outputName: dataFiles
---

Find test data files related to this scenario.

Scenario analysis: {{scenarioAnalysis}}
Feature path: {{featureFile.filePath}}

Search for:
1. JSON/CSV/Excel files with matching names
2. Data files referenced by tags
3. Environment-specific data files
4. Fixture files in test resources

Return JSON only:
```json
{
  "dataFiles": [
    {
      "filePath": "path to data file",
      "type": "json|csv|excel|yaml",
      "relevance": "high|medium|low",
      "content": "file content or summary"
    }
  ],
  "dataBindingPattern": "how data is loaded (DataProvider, Examples, fixture)"
}
```
