---
id: analyze-runner-config
name: Analyze Runner Config
description: Review test runner and framework configuration
outputExtraction:
  mode: json
  outputName: runnerConfig
---

Analyze the test runner configuration.

Search for:
1. Cucumber runner class (@CucumberOptions)
2. TestNG/JUnit configuration
3. WebDriver setup and teardown
4. Browser configuration
5. Timeout settings
6. Parallel execution settings

Return JSON only:
```json
{
  "runner": {
    "framework": "cucumber-java|cucumber-js|behave|other",
    "configFile": "path to config",
    "options": {}
  },
  "browser": {
    "type": "chrome|firefox|safari|edge",
    "headless": true,
    "options": []
  },
  "timeouts": {
    "implicit": 0,
    "pageLoad": 0,
    "script": 0
  },
  "issues": ["configuration problems found"],
  "recommendations": ["suggested config changes"]
}
```
