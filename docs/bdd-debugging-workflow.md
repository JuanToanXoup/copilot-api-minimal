# BDD Framework Debugging - Scriptable Workflow

## Phase 1: Scenario Discovery (Block Text Search)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SCENARIO DISCOVERY - BLOCK SEARCH                         │
└─────────────────────────────────────────────────────────────────────────────┘

INPUT: Gherkin steps block from Zephyr
┌─────────────────────────────────────┐
│ Given user logs in                  │
│ When user clicks transfer           │
│ Then balance is updated             │
└───────────────┬─────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1.1: WRITE STEPS BLOCK TO TEMP FILE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  cat << 'EOF' > zephyr_steps.txt                                            │
│  Given user logs in                                                         │
│  When user clicks transfer                                                  │
│  Then balance is updated                                                    │
│  EOF                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1.2: NORMALIZE STEPS (STRIP KEYWORDS AND PARAMETERS)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  sed -E 's/^(Given|When|Then|And|But) //; s/"[^"]*"//g; s/<[^>]*>//g' \     │
│    zephyr_steps.txt > normalized_steps.txt                                  │
│                                                                             │
│  OUTPUT (normalized_steps.txt):                                             │
│    user logs in                                                             │
│    user clicks transfer                                                     │
│    balance is updated                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1.3: BUILD MULTI-LINE SEARCH PATTERN                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PATTERN=$(cat normalized_steps.txt | tr '\n' '|' | sed 's/|$//')           │
│                                                                             │
│  OUTPUT: PATTERN="user logs in|user clicks transfer|balance is updated"    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1.4: SEARCH FEATURE FILES FOR ALL STEPS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP_COUNT=$(wc -l < normalized_steps.txt)                                 │
│                                                                             │
│  grep -rlE "$PATTERN" --include="*.feature" src/test/resources/ | \         │
│    while read FILE; do                                                      │
│      MATCHES=$(grep -cE "$PATTERN" "$FILE")                                 │
│      [ "$MATCHES" -ge "$STEP_COUNT" ] && echo "$FILE"                       │
│    done > matched_files.txt                                                 │
│                                                                             │
│  OUTPUT (matched_files.txt):                                                │
│    src/test/resources/FeatureFiles/Transfer.feature                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1.5: EXTRACT FEATURE FILE PATH                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FEATURE_FILE=$(head -1 matched_files.txt)                                  │
│                                                                             │
│  OUTPUT: FEATURE_FILE=src/test/resources/FeatureFiles/Transfer.feature      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1.6: GET LINE NUMBER OF FIRST MATCHING STEP                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FIRST_STEP=$(head -1 normalized_steps.txt)                                 │
│  STEP_LINE=$(grep -n "$FIRST_STEP" "$FEATURE_FILE" | head -1 | cut -d: -f1) │
│                                                                             │
│  OUTPUT: STEP_LINE=27                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1.7: FIND PRECEDING SCENARIO DECLARATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SCENARIO_LINE=$(grep -n "Scenario" "$FEATURE_FILE" | \                     │
│    awk -F: -v step="$STEP_LINE" '$1 < step {last=$1} END {print last}')     │
│                                                                             │
│  OUTPUT: SCENARIO_LINE=25                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1.8: EXTRACT SCENARIO NAME                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SCENARIO_NAME=$(sed -n "${SCENARIO_LINE}p" "$FEATURE_FILE" | \             │
│    sed 's/.*Scenario[^:]*: *//')                                            │
│                                                                             │
│  OUTPUT: SCENARIO_NAME="Transfer funds"                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1.9: EXTRACT SCENARIO TAG                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TAG_LINE=$((SCENARIO_LINE - 1))                                            │
│  SCENARIO_TAG=$(sed -n "${TAG_LINE}p" "$FEATURE_FILE" | \                   │
│    grep -oE "@[A-Za-z0-9_-]+" | head -1)                                    │
│                                                                             │
│  OUTPUT: SCENARIO_TAG="@CSIIDi-171670"                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1.10: OUTPUT DISCOVERY RESULTS                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  echo "FEATURE_FILE=$FEATURE_FILE"                                          │
│  echo "SCENARIO_NAME=$SCENARIO_NAME"                                        │
│  echo "SCENARIO_TAG=$SCENARIO_TAG"                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
           PROCEED TO
         TEST EXECUTION
```

---

## Phase 2: Test Execution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TEST EXECUTION                                       │
└─────────────────────────────────────────────────────────────────────────────┘

                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2.1: EXECUTE TEST BY TAG                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  mvn clean test -DcucumberTags="$SCENARIO_TAG" -Dheadless=false             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2.2: CAPTURE TEST OUTPUT                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  mvn clean test -DcucumberTags="$SCENARIO_TAG" 2>&1 | tee test_output.log   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
          TEST RESULT
                │
        ┌───────┴───────┐
        ▼               ▼
     [ PASS ]       [ FAIL ]
                        │
                        ▼
               CONTINUE TO
            FAILURE CLASSIFICATION
```

---

## Phase 3: Failure Classification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FAILURE CLASSIFICATION                                    │
└─────────────────────────────────────────────────────────────────────────────┘

INPUT: test_output.log from failed execution
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3.1: DETECT FAILURE TYPE                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  grep -E "NoSuchElementException|ElementNotFound" test_output.log           │
│  EXIT_CODE=$?                                                               │
│  if [ $EXIT_CODE -eq 0 ]; then FAILURE_TYPE="LOCATOR"; fi                   │
│                                                                             │
│  grep -E "TimeoutException|WaitTimeout" test_output.log                     │
│  EXIT_CODE=$?                                                               │
│  if [ $EXIT_CODE -eq 0 ]; then FAILURE_TYPE="TIMING"; fi                    │
│                                                                             │
│  grep -E "AssertionError|assertEquals|assertTrue" test_output.log           │
│  EXIT_CODE=$?                                                               │
│  if [ $EXIT_CODE -eq 0 ]; then FAILURE_TYPE="ASSERTION"; fi                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3.2: EXTRACT FAILED STEP FROM OUTPUT                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  grep -E "^\s*(Given|When|Then|And)" test_output.log | grep -i "failed"     │
│                                                                             │
│  OUTPUT: "When user clicks X ... FAILED"                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3.3: EXTRACT STACK TRACE                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  grep -A20 "Exception" test_output.log | grep -E "at.*StepDef|PageAction"   │
│                                                                             │
│  OUTPUT: at stepDef.cbol.Login_StepDef.userClicksX(Login_StepDef.java:42)   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
            BRANCH BY
           FAILURE_TYPE
                │
        ┌───────┼───────┐
        ▼       ▼       ▼
    LOCATOR  TIMING  ASSERTION
```

---

## Phase 4: Locator Failure Debug Path

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LOCATOR FAILURE DEBUG PATH                                │
└─────────────────────────────────────────────────────────────────────────────┘

INPUT: FAILURE_TYPE="LOCATOR", stack trace line
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4.1: EXTRACT STEP DEFINITION FILE FROM STACK TRACE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEPDEF_FILE=$(grep -oE "[A-Za-z_]+_StepDef\.java" test_output.log | head -1)│
│                                                                             │
│  OUTPUT: Login_StepDef.java                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4.2: LOCATE STEP DEFINITION FILE PATH                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  find src/test/java/stepDef -name "$STEPDEF_FILE"                           │
│                                                                             │
│  OUTPUT: src/test/java/stepDef/cbol/Login_StepDef.java                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4.3: EXTRACT PAGE ACTION CLASS FROM STEP DEFINITION                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  grep -oE "[A-Za-z_]+PageActions|[A-Za-z_]+_PageActions" \                  │
│    src/test/java/stepDef/cbol/Login_StepDef.java | head -1                  │
│                                                                             │
│  OUTPUT: Login_PageActions                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4.4: LOCATE PAGE ACTION FILE PATH                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  find src/test/java/pageActions -name "*Login*PageActions*.java"            │
│                                                                             │
│  OUTPUT: src/test/java/pageActions/cbol/Login_PageActions.java              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4.5: EXTRACT LOCATOR CLASS FROM PAGE ACTION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  grep -oE "[A-Za-z_]+Locators|[A-Za-z_]+_Locators" \                        │
│    src/test/java/pageActions/cbol/Login_PageActions.java | head -1          │
│                                                                             │
│  OUTPUT: Login_Locators                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4.6: LOCATE LOCATOR FILE PATH                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  find src/test/java/pageLocators -name "*Login*Locators*.java"              │
│                                                                             │
│  OUTPUT: src/test/java/pageLocators/cbol/Login_Locators.java                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4.7: EXTRACT FAILING SELECTOR FROM ERROR                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  grep -oE "(id|xpath|css|name)\s*[:=]\s*[\"'][^\"']+[\"']" test_output.log  │
│                                                                             │
│  OUTPUT: id = "submitBtn"                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4.8: FIND SELECTOR IN LOCATOR FILE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  grep -n "submitBtn" src/test/java/pageLocators/cbol/Login_Locators.java    │
│                                                                             │
│  OUTPUT: 15:    @FindBy(id = "submitBtn")                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
          OUTPUT: LOCATOR_FILE, LINE_NUMBER, SELECTOR
```

---

## Phase 5: Timing Failure Debug Path

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TIMING FAILURE DEBUG PATH                                 │
└─────────────────────────────────────────────────────────────────────────────┘

INPUT: FAILURE_TYPE="TIMING", stack trace line
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5.1: EXTRACT PAGE ACTION FILE FROM STACK TRACE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PAGEACTION_FILE=$(grep -oE "[A-Za-z_]+PageActions\.java" test_output.log \ │
│    | head -1)                                                               │
│                                                                             │
│  OUTPUT: Login_PageActions.java                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5.2: LOCATE PAGE ACTION FILE PATH                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  find src/test/java/pageActions -name "$PAGEACTION_FILE"                    │
│                                                                             │
│  OUTPUT: src/test/java/pageActions/cbol/Login_PageActions.java              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5.3: EXTRACT LINE NUMBER FROM STACK TRACE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LINE_NUM=$(grep -oE "PageActions\.java:[0-9]+" test_output.log \           │
│    | head -1 | cut -d: -f2)                                                 │
│                                                                             │
│  OUTPUT: 87                                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5.4: EXTRACT WAIT CONFIGURATION AT LINE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  sed -n "${LINE_NUM}p" src/test/java/pageActions/cbol/Login_PageActions.java│
│                                                                             │
│  OUTPUT: util.explicitWaitForElement(locators.submitBtn, 30);               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5.5: FIND ALL WAIT CALLS IN FILE                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  grep -n "explicitWait\|implicitWait\|Thread.sleep" \                       │
│    src/test/java/pageActions/cbol/Login_PageActions.java                    │
│                                                                             │
│  OUTPUT: List of all wait configurations with line numbers                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
          OUTPUT: PAGEACTION_FILE, LINE_NUMBER, WAIT_CONFIG
```

---

## Phase 6: Assertion Failure Debug Path

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ASSERTION FAILURE DEBUG PATH                              │
└─────────────────────────────────────────────────────────────────────────────┘

INPUT: FAILURE_TYPE="ASSERTION", stack trace line
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6.1: EXTRACT EXPECTED VS ACTUAL FROM ERROR                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  grep -oE "expected:.*but was:.*" test_output.log                           │
│                                                                             │
│  OUTPUT: expected:<Welcome> but was:<Login Failed>                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6.2: EXTRACT PAGE ACTION FILE FROM STACK TRACE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PAGEACTION_FILE=$(grep -oE "[A-Za-z_]+PageActions\.java" test_output.log \ │
│    | head -1)                                                               │
│                                                                             │
│  OUTPUT: Login_PageActions.java                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6.3: LOCATE PAGE ACTION FILE PATH                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  find src/test/java/pageActions -name "$PAGEACTION_FILE"                    │
│                                                                             │
│  OUTPUT: src/test/java/pageActions/cbol/Login_PageActions.java              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6.4: FIND VERIFY/ASSERT METHODS IN PAGE ACTION                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  grep -n "verify\|assert\|Assert\|assertEquals\|assertTrue" \               │
│    src/test/java/pageActions/cbol/Login_PageActions.java                    │
│                                                                             │
│  OUTPUT: 95: Assert.assertEquals(actual, "Welcome");                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6.5: EXTRACT EXPECTED VALUE FROM CODE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  grep -oE "assertEquals\([^,]+,\s*\"[^\"]+\"" \                             │
│    src/test/java/pageActions/cbol/Login_PageActions.java                    │
│                                                                             │
│  OUTPUT: assertEquals(actual, "Welcome"                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
          OUTPUT: PAGEACTION_FILE, LINE_NUMBER, EXPECTED_VALUE, ACTUAL_VALUE
```

---

## Phase 7: Report Extraction

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REPORT EXTRACTION                                         │
└─────────────────────────────────────────────────────────────────────────────┘

                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 7.1: CHECK IF REPORTS EXIST                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ls -la target/cucumber*.json target/cucumber*.html 2>/dev/null             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 7.2: EXTRACT FAILURE SUMMARY FROM JSON REPORT                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  cat target/cucumber1.json | jq '.[] | .elements[] | select(.steps[]       │
│    | .result.status == "failed") | {name: .name, failed_step:              │
│    (.steps[] | select(.result.status == "failed") | .name)}'               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 7.3: EXTRACT ERROR MESSAGE FROM JSON REPORT                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  cat target/cucumber1.json | jq '.[] | .elements[] | .steps[] |            │
│    select(.result.status == "failed") | .result.error_message'             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 7.4: LIST ALL FAILED SCENARIOS                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  cat target/cucumber1.json | jq -r '.[] | .elements[] |                    │
│    select(.steps[] | .result.status == "failed") | .name'                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Atomic Actions Reference

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ALL ATOMIC ACTIONS                                        │
└─────────────────────────────────────────────────────────────────────────────┘

PHASE 1: SCENARIO DISCOVERY
───────────────────────────────────────────────────────────────────────────────
1.1   cat << 'EOF' > zephyr_steps.txt
1.2   sed -E 's/^(Given|When|Then|And|But) //; s/"[^"]*"//g' zephyr_steps.txt > normalized_steps.txt
1.3   PATTERN=$(cat normalized_steps.txt | tr '\n' '|' | sed 's/|$//')
1.4   grep -rlE "$PATTERN" --include="*.feature" src/test/resources/ | while read FILE; do MATCHES=$(grep -cE "$PATTERN" "$FILE"); [ "$MATCHES" -ge "$STEP_COUNT" ] && echo "$FILE"; done > matched_files.txt
1.5   FEATURE_FILE=$(head -1 matched_files.txt)
1.6   STEP_LINE=$(grep -n "<first_step>" "$FEATURE_FILE" | head -1 | cut -d: -f1)
1.7   SCENARIO_LINE=$(grep -n "Scenario" "$FEATURE_FILE" | awk -F: -v step="$STEP_LINE" '$1 < step {last=$1} END {print last}')
1.8   SCENARIO_NAME=$(sed -n "${SCENARIO_LINE}p" "$FEATURE_FILE" | sed 's/.*Scenario[^:]*: *//')
1.9   SCENARIO_TAG=$(sed -n "$((SCENARIO_LINE - 1))p" "$FEATURE_FILE" | grep -oE "@[A-Za-z0-9_-]+" | head -1)
1.10  echo "FEATURE_FILE=$FEATURE_FILE" && echo "SCENARIO_TAG=$SCENARIO_TAG"

PHASE 2: TEST EXECUTION
───────────────────────────────────────────────────────────────────────────────
2.1   mvn clean test -DcucumberTags="$SCENARIO_TAG" -Dheadless=false
2.2   mvn clean test -DcucumberTags="$SCENARIO_TAG" 2>&1 | tee test_output.log

PHASE 3: FAILURE CLASSIFICATION
───────────────────────────────────────────────────────────────────────────────
3.1   grep -E "NoSuchElementException|TimeoutException|AssertionError" test_output.log
3.2   grep -E "^\s*(Given|When|Then|And)" test_output.log | grep -i "failed"
3.3   grep -A20 "Exception" test_output.log | grep -E "StepDef|PageAction"

PHASE 4: LOCATOR FAILURE PATH
───────────────────────────────────────────────────────────────────────────────
4.1   grep -oE "[A-Za-z_]+_StepDef\.java" test_output.log | head -1
4.2   find src/test/java/stepDef -name "<stepdef_file>"
4.3   grep -oE "[A-Za-z_]+PageActions" <stepdef_path> | head -1
4.4   find src/test/java/pageActions -name "*<name>*PageActions*.java"
4.5   grep -oE "[A-Za-z_]+Locators" <pageaction_path> | head -1
4.6   find src/test/java/pageLocators -name "*<name>*Locators*.java"
4.7   grep -oE "(id|xpath|css|name)\s*[:=]\s*[\"'][^\"']+[\"']" test_output.log
4.8   grep -n "<selector>" <locator_file>

PHASE 5: TIMING FAILURE PATH
───────────────────────────────────────────────────────────────────────────────
5.1   grep -oE "[A-Za-z_]+PageActions\.java" test_output.log | head -1
5.2   find src/test/java/pageActions -name "<pageaction_file>"
5.3   grep -oE "PageActions\.java:[0-9]+" test_output.log | head -1 | cut -d: -f2
5.4   sed -n "<line>p" <pageaction_path>
5.5   grep -n "explicitWait\|implicitWait\|Thread.sleep" <pageaction_path>

PHASE 6: ASSERTION FAILURE PATH
───────────────────────────────────────────────────────────────────────────────
6.1   grep -oE "expected:.*but was:.*" test_output.log
6.2   grep -oE "[A-Za-z_]+PageActions\.java" test_output.log | head -1
6.3   find src/test/java/pageActions -name "<pageaction_file>"
6.4   grep -n "verify\|assert\|Assert" <pageaction_path>
6.5   grep -oE "assertEquals\([^,]+,\s*\"[^\"]+\"" <pageaction_path>

PHASE 7: REPORT EXTRACTION
───────────────────────────────────────────────────────────────────────────────
7.1   ls -la target/cucumber*.json target/cucumber*.html 2>/dev/null
7.2   cat target/cucumber1.json | jq '.[] | .elements[] | select(.steps[] | .result.status == "failed")'
7.3   cat target/cucumber1.json | jq '.[] | .elements[] | .steps[] | select(.result.status == "failed") | .result.error_message'
7.4   cat target/cucumber1.json | jq -r '.[] | .elements[] | select(.steps[] | .result.status == "failed") | .name'
```
