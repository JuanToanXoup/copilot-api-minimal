---
id: analyze-page-object
name: Analyze Page Object
description: Review page object class for issues
outputExtraction:
  mode: json
  outputName: pageObjectAnalysis
---

Analyze this page object class for potential issues.

Page objects to analyze: {{stepAnalysis.pageObjects}}

Read the page object files and check:
1. Element initialization (lazy vs eager)
2. Wait strategies used
3. Stale element handling
4. Frame/iframe handling
5. Dynamic content handling

Return JSON only:
```json
{
  "pageObject": "class name",
  "filePath": "file path",
  "issues": [
    {
      "type": "initialization|wait|stale|frame|dynamic",
      "description": "issue description",
      "lineNumber": 0,
      "severity": "high|medium|low"
    }
  ],
  "waitStrategy": "implicit|explicit|fluent|none",
  "recommendations": ["suggestions for improvement"]
}
```
