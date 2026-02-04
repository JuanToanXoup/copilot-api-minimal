---
id: inspect-locators
name: Inspect Page Locators
description: Find and analyze locators used in the step definition
outputExtraction:
  mode: json
  outputName: locators
---

Find the locator definitions used by this step.

Step analysis: {{stepAnalysis}}
Page objects: {{stepAnalysis.pageObjects}}

Search page object files for locator definitions:
- @FindBy annotations
- By.cssSelector, By.xpath, By.id
- CSS selectors, XPath expressions
- data-testid attributes

Return JSON only:
```json
{
  "locators": [
    {
      "name": "element variable name",
      "strategy": "css|xpath|id|name|class|data-testid",
      "value": "the selector value",
      "filePath": "where defined",
      "lineNumber": 0
    }
  ],
  "suspectedLocator": "most likely failing locator",
  "reason": "why this locator is suspected"
}
```
