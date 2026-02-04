---
id: validate-selectors
name: Validate Selector Strategy
description: Evaluate selector quality and suggest improvements
outputExtraction:
  mode: json
  outputName: selectorValidation
---

Evaluate these locators for reliability and best practices.

{{locators}}

Check for:
1. Fragile selectors (absolute XPath, index-based)
2. Dynamic IDs or classes
3. Missing data-testid attributes
4. Overly complex selectors
5. Selectors that may break with UI changes

Return JSON only:
```json
{
  "evaluations": [
    {
      "locator": "the selector",
      "reliability": "high|medium|low",
      "issues": ["list of issues"],
      "suggestion": "improved selector if applicable"
    }
  ],
  "overallRisk": "high|medium|low",
  "recommendations": ["prioritized recommendations"]
}
```
