---
id: parse-bdd-failure
name: Parse BDD Failure
description: Extract structured failure data from BDD test output
outputExtraction:
  mode: json
  outputName: parsedFailure
---

Extract failure information from this BDD/Cucumber test output.

{{input}}

Return JSON only:
```json
{
  "failedStep": "the exact Given/When/Then step text that failed",
  "errorMessage": "the error or exception message",
  "stackTrace": "relevant stack trace lines",
  "featurePath": "path to .feature file if visible",
  "lineNumber": null
}
```
