---
id: analyze-waits
name: Analyze Wait Strategies
description: Review wait and synchronization strategies
outputExtraction:
  mode: json
  outputName: waitAnalysis
---

Analyze wait strategies in the step definition and page objects.

Step definition: {{stepDefinition.code}}
Page objects: {{stepAnalysis.pageObjects}}

Check for:
1. Explicit waits (WebDriverWait, ExpectedConditions)
2. Implicit wait settings
3. Hard-coded sleeps (Thread.sleep, time.sleep)
4. Fluent wait configurations
5. Custom wait utilities

Return JSON only:
```json
{
  "waits": [
    {
      "type": "explicit|implicit|sleep|fluent|custom",
      "timeout": "timeout value in seconds",
      "condition": "wait condition if applicable",
      "location": "file:line",
      "issue": "potential problem if any"
    }
  ],
  "implicitWait": "global implicit wait setting",
  "hasSleeps": true,
  "recommendations": ["wait strategy improvements"]
}
```
