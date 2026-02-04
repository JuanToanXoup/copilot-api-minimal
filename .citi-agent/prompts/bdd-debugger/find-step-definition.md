---
id: find-step-definition
name: Find Step Definition
description: Locate the step definition code for the failed step
outputExtraction:
  mode: json
  outputName: stepDefinition
---

Find the step definition that matches this failed Gherkin step.

Failed step: {{scenarioAnalysis.failedStep.text}}
Keyword: {{scenarioAnalysis.failedStep.keyword}}

Search in step definition files (*.java, *.ts, *.js, *.py) for:
- @Given, @When, @Then annotations
- Regex patterns matching the step text
- Cucumber expressions matching the step

Return JSON only:
```json
{
  "filePath": "path to step definition file",
  "methodName": "name of the step method",
  "lineNumber": 0,
  "annotation": "the @Given/@When/@Then annotation",
  "pattern": "the regex or cucumber expression",
  "code": "full method body code",
  "parameters": ["extracted parameter names"]
}
```
