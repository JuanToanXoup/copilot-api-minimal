---
id: extract-error-context
name: Extract Error Context
description: Classify error type and extract context from parsed failure
outputExtraction:
  mode: json
  outputName: errorContext
---

Analyze this parsed BDD failure and classify the error type.

{{parsedFailure}}

Error type classifications:
- element_not_found: NoSuchElement, locator failures, element not visible/clickable
- data_mismatch: assertion failures on data values, unexpected content
- timeout: TimeoutException, wait failures, page load issues
- assertion: assertEquals, assertTrue, expectation failures on logic

Return JSON only:
```json
{
  "errorType": "element_not_found|data_mismatch|timeout|assertion",
  "scenarioName": "name of the scenario if identifiable",
  "failedStep": "{{parsedFailure.failedStep}}",
  "featurePath": "path to feature file",
  "confidence": "high|medium|low"
}
```
