# YAML Workflow Schema

A structured YAML format for defining AI workflows that converts to React Flow workflow JSON.

## Basic Structure

```yaml
workflow:
  name: "Workflow Name"
  description: "Optional description"

  # Optional: Define agent roles for the workflow
  agents:
    - name: Analyzer
      color: "#LightBlue"
    - name: Writer
      color: "#LightGreen"

  # Optional: Define input variables
  inputs:
    - name: code
      type: string
      required: true
    - name: language
      type: string
      default: "typescript"

  # The workflow steps (sequential by default)
  steps:
    - prompt: "Analyze Code"
      template: code-analysis
      input: "{{input}}"
      agent: Analyzer

    - prompt: "Generate Report"
      template: report-generator
      input: "{{analysis}}"
      agent: Writer
```

## Node Types

### 1. Prompt Block (AI Task)

```yaml
- prompt: "Task Label"
  template: template-id          # Reference to prompt template
  input: "{{variableName}}"      # Input from upstream or workflow input
  agent: AgentName               # Optional: Assign to agent/swimlane
  output: resultName             # Optional: Name for output variable
```

### 2. HTTP Request

```yaml
- http: "Fetch User Data"
  method: GET                    # GET, POST, PUT, PATCH, DELETE
  url: "https://api.example.com/users/{{userId}}"
  headers:
    Authorization: "Bearer {{token}}"
  body: |                        # For POST/PUT/PATCH
    {"query": "{{query}}"}
  output: userData
```

### 3. Condition (If/Else)

```yaml
- if: "{{errorType}} == 'timeout'"
  then:
    - prompt: "Handle Timeout"
      template: timeout-handler
  else:
    - prompt: "Handle Other Error"
      template: error-handler
```

#### Multi-branch Condition (Else If)

```yaml
- if: "{{errorType}} == 'element_not_found'"
  then:
    - prompt: "Fix Locator"
      template: locator-fix

  elif: "{{errorType}} == 'timeout'"
  then:
    - prompt: "Fix Timeout"
      template: timeout-fix

  elif: "{{errorType}} == 'data_mismatch'"
  then:
    - prompt: "Fix Data"
      template: data-fix

  else:
    - prompt: "Generic Fix"
      template: generic-fix
```

### 4. Parallel Execution (Fork)

```yaml
- parallel:
    - branch:
        - prompt: "Analyze Code"
          template: code-analysis
        - prompt: "Generate Tests"
          template: test-generator

    - branch:
        - prompt: "Check Style"
          template: style-checker

    - branch:
        - prompt: "Security Scan"
          template: security-scan

- aggregate: "Combine Results"   # Merges all parallel branches
  strategy: merge                # merge, first, all
```

### 5. Loop (Repeat Until)

```yaml
- loop:
    max: 3                       # Maximum iterations
    until: "{{quality}} >= 0.9"  # Exit condition
    steps:
      - prompt: "Improve Code"
        template: code-improver
        input: "{{code}}"

      - prompt: "Evaluate Quality"
        template: quality-checker
        output: quality
```

### 6. Router (Dynamic Branching)

```yaml
- router: "Route by Language"
  variable: "{{language}}"
  routes:
    typescript:
      - prompt: "TS Analysis"
        template: ts-analyzer
    python:
      - prompt: "Python Analysis"
        template: py-analyzer
    default:
      - prompt: "Generic Analysis"
        template: generic-analyzer
```

### 7. Aggregator (Merge Results)

```yaml
- aggregate: "Combine Analysis"
  strategy: merge                # merge | first | all
  input:
    - "{{codeAnalysis}}"
    - "{{styleCheck}}"
    - "{{securityScan}}"
```

### 8. Sub-workflow

```yaml
- workflow: "Code Review"
  ref: code-review-workflow      # Reference to another workflow
  input:
    code: "{{sourceCode}}"
    rules: "{{lintRules}}"
```

## Complete Example: BDD Debugger

```yaml
workflow:
  name: "BDD Gherkin Failure Debugger"
  description: "Debug BDD test failures with AI agents"

  agents:
    - name: ErrorAnalyzer
      color: "#LightCoral"
    - name: FeatureInspector
      color: "#LightBlue"
    - name: StepDefAnalyzer
      color: "#LightGreen"
    - name: DataAnalyzer
      color: "#Gold"
    - name: LocatorInspector
      color: "#Plum"
    - name: EnvChecker
      color: "#LightCyan"
    - name: FixGenerator
      color: "#Orange"

  inputs:
    - name: failureOutput
      type: string
      required: true
      description: "Raw BDD test failure output"

  steps:
    # Initial Analysis
    - prompt: "Parse Failure Output"
      template: parse-bdd-failure
      input: "{{input}}"
      agent: ErrorAnalyzer
      output: parsedFailure

    - prompt: "Extract Error Context"
      template: extract-error-context
      input: "{{parsedFailure}}"
      agent: ErrorAnalyzer
      output: errorContext

    - prompt: "Locate Feature File"
      template: locate-feature-file
      input: "{{errorContext}}"
      agent: FeatureInspector
      output: featureFile

    - prompt: "Analyze Failed Scenario"
      template: analyze-gherkin-scenario
      input: "{{featureFile}}"
      agent: FeatureInspector
      output: scenarioAnalysis

    - prompt: "Find Step Definition"
      template: find-step-definition
      input: "{{scenarioAnalysis.failedStep}}"
      agent: StepDefAnalyzer
      output: stepDefinition

    - prompt: "Analyze Step Implementation"
      template: analyze-step-impl
      input: "{{stepDefinition}}"
      agent: StepDefAnalyzer
      output: stepAnalysis

    # Branch by Error Type
    - if: "{{errorContext.errorType}} == 'element_not_found'"
      then:
        - parallel:
            - branch:
                - prompt: "Inspect Page Locators"
                  template: inspect-locators
                  input: "{{stepAnalysis}}"
                  agent: LocatorInspector
                  output: locators

                - prompt: "Validate Selector Strategy"
                  template: validate-selectors
                  input: "{{locators}}"
                  agent: LocatorInspector

            - branch:
                - prompt: "Check Page Object"
                  template: analyze-page-object
                  input: "{{stepAnalysis.pageObjects}}"
                  agent: EnvChecker

        - aggregate: "Combine Locator Analysis"
          strategy: merge

      elif: "{{errorContext.errorType}} == 'data_mismatch'"
      then:
        - prompt: "Locate Test Data Files"
          template: find-test-data
          input: "{{scenarioAnalysis}}"
          agent: DataAnalyzer
          output: dataFiles

        - prompt: "Analyze Data Bindings"
          template: analyze-data-bindings
          input: "{{dataFiles}}"
          agent: DataAnalyzer
          output: dataBindings

        - prompt: "Validate Test Data"
          template: validate-test-data
          input: "{{dataBindings}}"
          agent: DataAnalyzer

      elif: "{{errorContext.errorType}} == 'timeout'"
      then:
        - parallel:
            - branch:
                - prompt: "Check Wait Strategies"
                  template: analyze-waits
                  input: "{{stepDefinition}}"
                  agent: EnvChecker

            - branch:
                - prompt: "Check Runner Config"
                  template: analyze-runner-config
                  agent: EnvChecker

        - aggregate: "Combine Env Analysis"
          strategy: merge

      else:
        - prompt: "Analyze Assertion Logic"
          template: analyze-assertions
          input: "{{stepDefinition}}"
          agent: StepDefAnalyzer
          output: assertionAnalysis

        - prompt: "Check Expected vs Actual"
          template: compare-expected-actual
          input: "{{assertionAnalysis}}"
          agent: StepDefAnalyzer

    # Resolution Phase
    - aggregate: "Compile Debug Findings"
      strategy: merge

    - prompt: "Generate Root Cause Analysis"
      template: root-cause-analysis
      input: "{{debugFindings}}"
      agent: FixGenerator
      output: rootCause

    - prompt: "Propose Fix Strategies"
      template: propose-fixes
      input: "{{rootCause}}"
      agent: FixGenerator
      output: fixStrategies

    - if: "{{fixStrategies.canAutoFix}} == true"
      then:
        - prompt: "Generate Code Fix"
          template: generate-code-fix
          input: "{{fixStrategies}}"
          agent: FixGenerator
      else:
        - prompt: "Generate Manual Fix Guide"
          template: generate-fix-guide
          input: "{{fixStrategies}}"
          agent: FixGenerator

    - prompt: "Create Debug Report"
      template: create-debug-report
      input: "{{fixOutput}}"
      agent: FixGenerator
```

## Variable References

Variables use `{{variableName}}` syntax:

- `{{input}}` - Workflow input
- `{{stepOutput}}` - Output from a previous step
- `{{stepOutput.field}}` - Nested field access
- `{{upstream}}` - Automatic reference to previous step's output

## Conversion Rules

| YAML | React Flow Node Type |
|------|---------------------|
| `prompt:` | `promptBlock` |
| `http:` | `httpRequest` |
| `if:` | `condition` |
| `parallel:` | Creates fork pattern |
| `aggregate:` | `aggregator` |
| `loop:` | `evaluator` |
| `router:` | `router` |
| First step | `workflowStart` (auto-added) |
| Last step | `output` (auto-added) |

## Design Principles

1. **Sequential by default** - Steps execute in order unless control flow changes
2. **Implicit edges** - No need to define edges; they're derived from structure
3. **Clear nesting** - Control flow is visually obvious from indentation
4. **AI-friendly** - Easy for LLMs to generate valid YAML
5. **Human-readable** - Can be written and understood without tooling
6. **Extensible** - New node types can be added without breaking existing schemas
