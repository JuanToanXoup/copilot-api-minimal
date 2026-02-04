# BDD Framework Documentation

This document explains how the Behavior-Driven Development (BDD) test automation framework works and describes each component and its purpose.

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Core Components](#core-components)
5. [File Types and Their Purpose](#file-types-and-their-purpose)
6. [How Tests Execute](#how-tests-execute)
7. [Configuration](#configuration)
8. [Running Tests](#running-tests)
   - [Via Terminal (Command Line)](#via-terminal-command-line)
   - [Via IDE](#via-ide)
   - [Test Reports](#test-reports)
9. [Adding New Tests](#adding-new-tests)
10. [Best Practices](#best-practices)

---

## Overview

This framework follows the **Behavior-Driven Development (BDD)** approach using **Cucumber** with **Gherkin** syntax. It implements the **Page Object Model (POM)** design pattern for maintainable and reusable test automation.

The framework supports:
- **CBOL** (Citibank Online) - Web browser testing
- **MBOL iOS** - Mobile iOS app testing via Appium
- **MBOL Android** - Mobile Android app testing via Appium
- **API Testing** - REST API automation

---

## Technology Stack

| Technology | Purpose |
|------------|---------|
| **Java 8** | Programming language |
| **Maven** | Build and dependency management |
| **Cucumber** | BDD framework for Gherkin scenarios |
| **Selenium WebDriver** | Browser automation |
| **Appium** | Mobile app automation (iOS/Android) |
| **TestNG** | Test execution framework |
| **Extent Reports** | HTML test reporting |
| **Zephyr** | Test management integration |

---

## Project Structure

```
bdd/
├── pom.xml                          # Maven configuration
├── testng.xml                       # TestNG suite configuration
├── settings.xml                     # Maven settings
├── configs/
│   └── Configuration.properties     # Environment configuration
├── RequestBody/                     # JSON payloads for API tests
│   └── Regression/
├── src/
│   └── test/
│       ├── java/
│       │   ├── runners/             # Test runners (entry point)
│       │   ├── stepDef/             # Step definitions
│       │   │   ├── cbol/            # CBOL step definitions
│       │   │   ├── mbol/
│       │   │   │   ├── iOS/         # iOS step definitions
│       │   │   │   └── Android/     # Android step definitions
│       │   │   └── api/             # API step definitions
│       │   ├── pageActions/         # Page action classes
│       │   │   ├── cbol/
│       │   │   ├── mbol/
│       │   │   │   ├── iOS/
│       │   │   │   └── Android/
│       │   │   └── utils/
│       │   └── pageLocators/        # Page locator classes
│       │       ├── cbol/
│       │       └── mbol/
│       │           ├── iOS/
│       │           └── Android/
│       └── resources/
│           ├── FeatureFiles/        # Gherkin feature files
│           │   └── ReleaseRegression/
│           └── RequestBody/         # API request payloads
```

---

## Core Components

### 1. Feature Files (`.feature`)

**Location:** `src/test/resources/FeatureFiles/`

Feature files contain test scenarios written in **Gherkin** syntax - a human-readable language that describes application behavior.

**Purpose:**
- Define test scenarios in plain English
- Bridge communication between business and technical teams
- Serve as living documentation

**Structure:**
```gherkin
Feature: Feature Name

  @Tag1 @Tag2
  Scenario Outline: Description of the test case
    Given precondition step "<Parameter>"
    When action step with "<Data>"
    Then expected outcome step

    Examples:
      | Parameter | Data |
      | value1    | data1 |
```

**Key Elements:**
- `Feature:` - High-level description of the functionality
- `Scenario Outline:` - Test case template with parameterized data
- `Given/When/Then` - BDD keywords (Given=precondition, When=action, Then=assertion)
- `@Tags` - Labels for filtering and categorizing tests
- `Examples:` - Data table for data-driven testing

---

### 2. Step Definitions

**Location:** `src/test/java/stepDef/`

Step definitions are Java classes that map Gherkin steps to executable code.

**Purpose:**
- Connect feature file steps to Java methods
- Orchestrate test actions using Page Actions
- Handle test data and parameters

**Structure:**
```java
package stepDef.cbol;

import cucumber.api.java.en.Given;
import cucumber.api.java.en.When;
import cucumber.api.java.en.Then;
import pageActions.cbol.SomePageActions;

public class SomeFeature_StepDef {

    SomePageActions pageActions = new SomePageActions();

    @Given("precondition step {string}")
    public void precondition_step(String parameter) {
        pageActions.doSomething(parameter);
    }

    @When("action step with {string}")
    public void action_step(String data) {
        pageActions.performAction(data);
    }

    @Then("expected outcome step")
    public void expected_outcome_step() {
        pageActions.verifyResult();
    }
}
```

**Key Points:**
- Use `@Given`, `@When`, `@Then` annotations from Cucumber
- Parameter placeholders: `{string}`, `{int}`, etc.
- Instantiate Page Actions to perform operations

---

### 3. Page Locators

**Location:** `src/test/java/pageLocators/`

Page Locator classes define web element locators using Selenium's `@FindBy` annotation.

**Purpose:**
- Centralize all element locators for a page
- Enable easy maintenance when UI changes
- Separate element identification from test logic

**Structure:**
```java
package pageLocators.cbol;

import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;

public class SomePage_Locators {

    @FindBy(id = "elementId")
    public WebElement elementById;

    @FindBy(xpath = "//button[@class='submit']")
    public WebElement submitButton;

    @FindBy(css = ".input-field")
    public WebElement inputField;
}
```

**Locator Strategies:**
| Strategy | Example | Use Case |
|----------|---------|----------|
| `id` | `@FindBy(id = "username")` | Unique element IDs (preferred) |
| `xpath` | `@FindBy(xpath = "//div[@class='x']")` | Complex element paths |
| `css` | `@FindBy(css = ".class-name")` | CSS selectors |
| `name` | `@FindBy(name = "fieldName")` | Form field names |

---

### 4. Page Actions

**Location:** `src/test/java/pageActions/`

Page Action classes contain reusable methods that interact with page elements.

**Purpose:**
- Implement the Page Object Model pattern
- Encapsulate page-specific behaviors
- Provide reusable actions across step definitions

**Structure:**
```java
package pageActions.cbol;

import org.openqa.selenium.support.PageFactory;
import pageLocators.cbol.SomePage_Locators;
import utils.SeleniumDriver;

public class SomePage_PageActions {

    SomePage_Locators locators;
    WealthUtils util = new WealthUtils();

    public SomePage_PageActions() {
        this.locators = new SomePage_Locators();
        PageFactory.initElements(SeleniumDriver.getDriver(), locators);
    }

    public void enterUsername(String username) {
        util.explicitWaitForElement(locators.usernameField, 30);
        locators.usernameField.sendKeys(username);
    }

    public void clickSubmit() {
        locators.submitButton.click();
    }

    public void verifyPageDisplayed() {
        util.explicitWaitForElement(locators.pageHeader, 30);
    }
}
```

**Key Points:**
- Constructor initializes locators using `PageFactory.initElements()`
- Methods represent user actions (click, type, verify)
- Use utility methods for waits and common operations

---

### 5. Test Runners

**Location:** `src/test/java/runners/`

Runner classes configure and execute Cucumber tests.

**Purpose:**
- Define feature file location
- Specify step definition packages (glue)
- Configure reporting plugins
- Filter tests using tags

**Structure:**
```java
package runners;

import baseRunner.BaseRunnerBrowser;
import cucumber.api.CucumberOptions;

@CucumberOptions(
    plugin = {
        "json:target/cucumber1.json",
        "pretty",
        "html:target/cucumber.html",
        "com.aventstack.extentreports.cucumber.adapter.ExtentCucumberAdapter:",
        "io.cucumber.zephyr.ZephyrXMLFormatter:target/zephyr.xml"
    },
    features = "src/test/resources/FeatureFiles",
    glue = "stepDef",
    tags = {"@RegressionAuto"}
)
public class CBOLBuildRunner extends BaseRunnerBrowser {

    public static String featurePath = "src/test/resources/FeatureFiles";

    public CBOLBuildRunner() {
        super(featurePath);
    }
}
```

**Available Runners:**
| Runner | Platform |
|--------|----------|
| `CBOLBuildRunner` | Web browser (CBOL) |
| `MBOLiOSBuildRunner` | iOS mobile app |
| `MBOLAndroidBuildRunner` | Android mobile app |
| `APIBuildRunner` | API testing |
| `CBOLSanityBuildRunner` | Quick sanity tests |

---

## File Types and Their Purpose

| File/Directory | Purpose |
|----------------|---------|
| `pom.xml` | Maven project configuration, dependencies, build plugins |
| `testng.xml` | TestNG suite configuration |
| `configs/Configuration.properties` | Environment-specific settings (URLs, browser config, timeouts) |
| `*.feature` | Gherkin test scenarios in plain English |
| `*_StepDef.java` | Maps Gherkin steps to Java methods |
| `*_Locators.java` | Web element locator definitions |
| `*_PageActions.java` | Reusable page interaction methods |
| `*BuildRunner.java` | Test execution entry points |
| `RequestBody/*.json` | JSON payloads for API testing |
| `WealthUtils.java` | Common utility methods (waits, assertions, helpers) |

---

## How Tests Execute

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TEST EXECUTION FLOW                         │
└─────────────────────────────────────────────────────────────────────┘

1. Maven/TestNG triggers Runner
         │
         ▼
┌─────────────────────┐
│   Test Runner       │  ← Reads @CucumberOptions
│   (CBOLBuildRunner) │    - features path
└─────────────────────┘    - glue (step definitions)
         │                 - tags to execute
         ▼
┌─────────────────────┐
│   Feature Files     │  ← Gherkin scenarios
│   (*.feature)       │    - Given/When/Then steps
└─────────────────────┘    - Test data (Examples)
         │
         ▼
┌─────────────────────┐
│   Step Definitions  │  ← Maps steps to Java
│   (*_StepDef.java)  │    - @Given/@When/@Then
└─────────────────────┘    - Calls Page Actions
         │
         ▼
┌─────────────────────┐
│   Page Actions      │  ← Business logic
│   (*_PageActions)   │    - Interacts with elements
└─────────────────────┘    - Uses Page Locators
         │
         ▼
┌─────────────────────┐
│   Page Locators     │  ← Element definitions
│   (*_Locators.java) │    - @FindBy annotations
└─────────────────────┘    - XPath/CSS/ID locators
         │
         ▼
┌─────────────────────┐
│   Selenium/Appium   │  ← Browser/App automation
│   WebDriver         │    - Click, type, navigate
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│   Application       │  ← System Under Test
│   Under Test        │    - Web app or Mobile app
└─────────────────────┘
```

---

## Configuration

### Configuration.properties

Located at `configs/Configuration.properties`, this file contains:

```properties
# Test Data
testDataXLPath=//src//test//java//dataProvider//
testDataXLName=TestData.xlsx

# Browser Configuration
browserName=chrome
headless=False
implicitlyWait=20

# Selenium Grid
seleniumServerHostName=selenium-grid-hostname
seleniumServerPort=80

# Mobile Configuration (iOS)
mobilePlatformName=iOS
mobileAutomationName=XCUITest
mobileBundleId=com.app.bundle.id

# Mobile Configuration (Android)
mobileAutomationName=UIAutomator2
mobileAppPackage=com.app.package
mobileAppActivity=com.app.MainActivity
```

### Common Tags

Tags are used to filter and organize tests:

| Tag | Description |
|-----|-------------|
| `@Z_Auto` | Automated test linked to Zephyr |
| `@Z_Manual` | Manual test case |
| `@Regression` | Regression test suite |
| `@RegressionAuto` | Automated regression |
| `@FinalSanity` | Sanity/smoke tests |
| `@Browser` | Browser-based tests |
| `@LOB_DIGITAL` | Digital line of business |
| `@Wealth` | Wealth management features |

---

## Running Tests

### Via Terminal (Command Line)

#### Basic Test Execution

```bash
# Run tests with default settings (CBOLBuildRunner)
mvn clean test

# Run and generate reports
mvn clean test verify
```

#### Run With Specific Tags

```bash
# Run specific Cucumber tags
mvn clean test -DcucumberTags="@RegressionAuto"

# Run multiple tags (AND)
mvn clean test -DcucumberTags="@Regression and @Browser"

# Run multiple tags (OR)
mvn clean test -DcucumberTags="@FinalSanity or @RegressionAuto"

# Exclude tags
mvn clean test -DcucumberTags="@Regression and not @Z_Manual"
```

#### Run With Environment Settings

```bash
# Specify environment
mvn clean test -Denvironment=UAT1

# Run headless browser (no UI)
mvn clean test -Dheadless=true

# Specify browser
mvn clean test -DbrowserName=chrome

# Specify browser as Firefox
mvn clean test -DbrowserName=firefox
```

#### Run With Parallel Threads

```bash
# Run with 4 parallel threads
mvn clean test -DthreadCount=4

# Run with 2 threads
mvn clean test -DthreadCount=2
```

#### Run Specific Runner (Platform)

```bash
# CBOL - Web Browser Tests
mvn clean test -Dincludes="**/CBOLBuildRunner.java"

# CBOL - Sanity Tests Only
mvn clean test -Dincludes="**/CBOLSanityBuildRunner.java"

# iOS Mobile Tests
mvn clean test -Dincludes="**/MBOLiOSBuildRunner.java"

# Android Mobile Tests
mvn clean test -Dincludes="**/MBOLAndroidBuildRunner.java"

# API Tests
mvn clean test -Dincludes="**/APIBuildRunner.java"
```

#### Combined Examples

```bash
# Full regression on UAT1 with Chrome headless
mvn clean test verify \
  -Denvironment=UAT1 \
  -DcucumberTags="@RegressionAuto" \
  -DbrowserName=chrome \
  -Dheadless=true \
  -DthreadCount=2

# Sanity tests only
mvn clean test \
  -Denvironment=UAT1 \
  -DcucumberTags="@FinalSanity"

# Run specific feature tag on UAT2
mvn clean test \
  -Denvironment=UAT2 \
  -DcucumberTags="@CSIIDi-171670"
```

#### Skip Tests

```bash
# Compile only, skip tests
mvn clean install -DskipTests

# Skip test compilation and execution
mvn clean install -Dmaven.test.skip=true
```

### Via IDE

1. Right-click on a Runner class (e.g., `CBOLBuildRunner.java`)
2. Select "Run" or "Debug"
3. Or right-click on a `.feature` file to run individual scenarios

### Test Reports

After execution, reports are generated in the `target/` directory:

| Report | Location | Description |
|--------|----------|-------------|
| HTML Report | `target/cucumber.html` | Basic Cucumber HTML report |
| JSON Report | `target/cucumber1.json` | JSON format for integrations |
| Cucumber Reports | `target/cucumber-html-reports/` | Detailed HTML reports with charts |
| Extent Report | `target/Extent_Reports/` | Rich HTML report with screenshots |
| Zephyr XML | `target/zephyr.xml` | For Zephyr test management sync |

To view HTML reports, open the file in a browser:
```bash
# macOS
open target/cucumber-html-reports/overview-features.html

# Windows
start target/cucumber-html-reports/overview-features.html

# Linux
xdg-open target/cucumber-html-reports/overview-features.html
```

---

## Adding New Tests

### Step 1: Create Feature File

Create a new `.feature` file in `src/test/resources/FeatureFiles/`:

```gherkin
Feature: New Feature Name

  @YourTag
  Scenario Outline: Test scenario description
    Given user is on the page "<Environment>"
    When user performs action with "<Data>"
    Then expected result is displayed

    Examples:
      | Environment | Data   |
      | UAT1        | value1 |
```

### Step 2: Create Step Definitions

Create a new StepDef class in appropriate package:

```java
package stepDef.cbol;

public class NewFeature_StepDef {
    // Implement @Given, @When, @Then methods
}
```

### Step 3: Create Page Locators (if needed)

```java
package pageLocators.cbol;

public class NewPage_Locators {
    // Define @FindBy elements
}
```

### Step 4: Create Page Actions (if needed)

```java
package pageActions.cbol;

public class NewPage_PageActions {
    // Implement interaction methods
}
```

### Step 5: Update Runner Tags (if needed)

Add your tag to the runner's `tags` parameter to include in test execution.

---

## Best Practices

1. **Keep feature files readable** - Write steps in business language
2. **Reuse step definitions** - Avoid duplicating steps across files
3. **Use Page Object Model** - Separate locators from actions
4. **Add meaningful waits** - Use explicit waits, avoid `Thread.sleep()`
5. **Tag appropriately** - Use consistent tagging for test organization
6. **Parameterize data** - Use Scenario Outlines with Examples tables
7. **Handle exceptions** - Add proper error handling in Page Actions
8. **Keep locators updated** - Maintain locators when UI changes
