# Self-Healing Test Automation Architecture (Async)

## Overview

An asynchronous, event-driven system that automatically detects, diagnoses, and fixes failing Selenium tests using multiple parallel AI agents orchestrated through an instance pool.

### Core Principle

> Agents do thinking. Orchestrator does coordination. Instances enable parallelism.

This async architecture extends the synchronous design by:
- Spawning multiple IntelliJ/Copilot instances
- Processing multiple failures in parallel
- Parallelizing agents within a single failure where possible
- Using event-driven orchestration instead of blocking calls

---

## Key Difference From Sync

| Aspect | Synchronous | Asynchronous |
|--------|-------------|--------------|
| Instances | One | Pool of many |
| Failures | One at a time | Many in parallel |
| Agent calls | Blocking | Non-blocking |
| Orchestrator | Loop | Event reactor |
| Throughput | Limited | Scalable |

---

## System Components

### IntelliJ Instance Pool

Multiple IntelliJ instances, each:
- Opened from project folder
- Has own Copilot session
- Has own WebSocket port
- Works independently

```
Instance Pool
├── Instance A (port 8080) ─ busy
├── Instance B (port 8081) ─ busy
├── Instance C (port 8082) ─ available
├── Instance D (port 8083) ─ available
└── Instance E (port 8084) ─ spawning
```

### Event-Driven Orchestrator

Does not block. Reacts to events:
- `FAILURE_RECEIVED` - new failure from Zephyr
- `INSTANCE_AVAILABLE` - instance ready for work
- `AGENT_COMPLETED` - agent finished task
- `AGENT_FAILED` - agent errored or timed out
- `VALIDATION_PASSED` - fix verified
- `VALIDATION_FAILED` - fix didn't work

### Task Queue

```
Inbound Queue (failures to process)
├── failure-123 (priority: high)
├── failure-124 (priority: normal)
└── failure-125 (priority: normal)

Work Queue (agent tasks)
├── {failure: 123, task: CLASSIFY, assigned: null}
├── {failure: 123, task: INSPECT_PLAN, assigned: instance-A}
└── {failure: 124, task: CLASSIFY, assigned: instance-B}

Result Queue (completed work)
├── {failure: 123, task: CLASSIFY, result: {...}}
└── {failure: 124, task: INSPECT_PLAN, result: {...}}
```

### State Layer

Same as sync, but with concurrency controls:

```
/state/
  failure-123/
    state.json          # Locked during updates
    inputs/
    outputs/
  failure-124/
    state.json
    inputs/
    outputs/
```

---

## Instance Pool Management

### Pool Configuration

```
min_instances: 2          # Always keep warm
max_instances: 10         # Upper limit
idle_timeout: 300s        # Kill idle instances after 5 min
spawn_timeout: 60s        # Max time to spawn new instance
task_timeout: 120s        # Max time per agent task
```

### Instance States

```
SPAWNING ─► AVAILABLE ─► BUSY ─► AVAILABLE
                │                    │
                ▼                    ▼
              IDLE ──────────► TERMINATED
```

### Instance Manager Responsibilities

- Spawn instances when demand exceeds supply
- Track instance state (available, busy, idle)
- Assign tasks to available instances
- Reclaim instances after task completion
- Terminate idle instances beyond minimum
- Handle instance crashes and restarts

### Spawning an Instance

```
1. Create temp folder or use project folder
2. Launch IntelliJ via CLI: idea <folder>
3. Wait for WebSocket port to become available
4. Register instance in pool
5. Mark as AVAILABLE
```

---

## Event-Driven Orchestrator

### Event Loop

```
while running:
    event = await event_queue.get()
    
    match event.type:
        case FAILURE_RECEIVED:
            create_state_file(event.failure)
            enqueue_task(event.failure, PLAN)
            
        case INSTANCE_AVAILABLE:
            task = get_next_task()
            if task:
                assign_task(event.instance, task)
            else:
                mark_idle(event.instance)
                
        case AGENT_COMPLETED:
            result = validate_output(event.result)
            if result.valid:
                update_state(event.failure, result)
                next_task = plan_next(event.failure)
                if next_task:
                    enqueue_task(event.failure, next_task)
                else:
                    finalize(event.failure)
            else:
                enqueue_retry(event.failure, event.task)
            release_instance(event.instance)
            emit(INSTANCE_AVAILABLE, event.instance)
            
        case AGENT_FAILED:
            handle_failure(event)
            release_instance(event.instance)
            emit(INSTANCE_AVAILABLE, event.instance)
            
        case VALIDATION_PASSED:
            stage_pr(event.failure)
            update_zephyr(event.failure, PASSED)
            
        case VALIDATION_FAILED:
            if retries_remaining(event.failure):
                enqueue_task(event.failure, GENERATE_FIX)
            else:
                escalate(event.failure)
```

### Task Assignment

```
function assign_task(instance, task):
    mark_busy(instance)
    
    write_input_file(task.failure, task.params)
    
    session = connect(instance.port)
    session.send_async(build_prompt(task))
    
    schedule_timeout(task, task_timeout)
    
    on session.complete:
        cancel_timeout(task)
        emit(AGENT_COMPLETED, {instance, task, result})
    
    on session.error:
        cancel_timeout(task)
        emit(AGENT_FAILED, {instance, task, error})
```

---

## Parallel Execution Patterns

### Pattern 1: Parallel Failures

Multiple failures processed simultaneously:

```
Time ──►

Failure-123: [CLASSIFY]──[INSPECT_PLAN]──[INSPECT_ANALYZE]──[FIX]──[VALIDATE]
Failure-124:    [CLASSIFY]──[INSPECT_PLAN]──[INSPECT_ANALYZE]──[FIX]──[VALIDATE]
Failure-125:       [CLASSIFY]──[INSPECT_PLAN]──[INSPECT_ANALYZE]──[FIX]
```

Each failure uses one instance at a time, but different failures run in parallel.

### Pattern 2: Parallel Agents Within Failure

Some agents can run concurrently:

```
Failure-123:
    │
    ├── [CLASSIFY] ────────────────┐
    │                              ▼
    └── [INSPECT_PLAN] ──► [CLI] ──► [INSPECT_ANALYZE]
                                              │
                                              ▼
                                   (merge results)
                                              │
                                              ▼
                                         [FIX_GEN]
```

Classifier and Inspection Planner don't depend on each other. Run in parallel, merge results.

### Pattern 3: Speculative Execution

Start likely next steps before current step completes:

```
[INSPECT_PLAN] ──► [CLI executing...]
       │
       └── (speculatively) [FIX_GEN prep] 

If CLI succeeds: continue with FIX_GEN
If CLI fails: discard speculative work
```

Trades compute for latency.

---

## Dependency Graph

Which agents can run in parallel:

```
CLASSIFY ─────────────────┐
                          ▼
INSPECT_PLAN ──► CLI ──► INSPECT_ANALYZE ──► FIX_GEN ──► VALIDATE_PLAN ──► CLI ──► VALIDATE_ANALYZE
```

Parallelizable pairs:
- CLASSIFY + INSPECT_PLAN (no dependency)
- Multiple CLI calls (if different URLs)

Sequential requirements:
- INSPECT_ANALYZE needs CLI result
- FIX_GEN needs INSPECT_ANALYZE output
- VALIDATE needs FIX applied

---

## State Management With Concurrency

### Locking

Each failure's state file can only be updated by one process:

```
function update_state(failure_id, updates):
    lock = acquire_lock(failure_id)
    try:
        state = read_state(failure_id)
        state = apply_updates(state, updates)
        write_state(failure_id, state)
    finally:
        release_lock(lock)
```

### Optimistic Concurrency

Alternative: version numbers

```json
{
  "id": "failure-123",
  "version": 7,
  "status": "processing",
  ...
}
```

Update only if version matches. Retry on conflict.

### Merging Parallel Results

When parallel agents complete:

```
function merge_results(failure_id, results):
    lock = acquire_lock(failure_id)
    try:
        state = read_state(failure_id)
        for result in results:
            state = apply_result(state, result)
        state.pending_parallel -= len(results)
        if state.pending_parallel == 0:
            state.ready_for_next_phase = true
        write_state(failure_id, state)
    finally:
        release_lock(lock)
```

---

## Enhanced State Schema

```json
{
  "id": "failure-123",
  "version": 7,
  "status": "processing",
  "phase": "inspection",
  
  "parallel": {
    "enabled": true,
    "pending_tasks": ["CLASSIFY", "INSPECT_PLAN"],
    "completed_tasks": [],
    "results": {}
  },
  
  "assigned_instance": null,
  "task_history": [
    {
      "task": "CLASSIFY",
      "instance": "instance-A",
      "started_at": "...",
      "completed_at": "...",
      "duration_ms": 3200
    }
  ],
  
  "retries": {
    "CLASSIFY": 0,
    "INSPECT_PLAN": 1,
    "FIX_GEN": 0
  },
  
  ...rest same as sync schema
}
```

---

## File Structure

```
/state/
  failure-123/
    state.json
    state.json.lock       # Lock file for concurrency
    inputs/
      task-001.json       # Task ID for parallel tracking
      task-002.json
    outputs/
      result-001.json
      result-002.json
    history/
      ...

/instances/
  instance-a/
    port: 8080
    status: busy
    current_task: task-001
    started_at: ...
  instance-b/
    port: 8081
    status: available
    current_task: null
    idle_since: ...
```

---

## Orchestrator Components

### Event Queue

Central event bus:

```
EventQueue
├── emit(event_type, payload)
├── subscribe(event_type, handler)
└── get() ─► awaits next event
```

### Task Scheduler

Manages work queue:

```
TaskScheduler
├── enqueue(failure_id, task_type, priority)
├── get_next() ─► highest priority unassigned task
├── assign(task, instance)
├── complete(task, result)
└── fail(task, error)
```

### Instance Manager

Manages instance pool:

```
InstanceManager
├── request_instance() ─► instance or spawns new
├── release(instance)
├── mark_busy(instance)
├── mark_available(instance)
├── get_stats() ─► pool metrics
└── shutdown_idle()
```

### State Manager

Handles state with concurrency:

```
StateManager
├── create(failure_id, initial_state)
├── read(failure_id) ─► state
├── update(failure_id, updates) ─► handles locking
├── merge_parallel(failure_id, results)
└── get_ready_failures() ─► failures ready for next task
```

---

## Scaling Considerations

### Horizontal Scaling

Multiple orchestrator instances (if needed):

```
Load Balancer
├── Orchestrator A ──► Instance Pool A
├── Orchestrator B ──► Instance Pool B
└── Orchestrator C ──► Instance Pool C

Shared:
├── Event Queue (Redis/Kafka)
├── State Store (shared filesystem or DB)
└── Zephyr API
```

### Resource Limits

Each IntelliJ instance consumes:
- ~2-4 GB RAM
- CPU during active processing
- Disk for project index

Plan instance limits based on available resources:

```
Available RAM: 32 GB
Per instance: 3 GB
Max instances: 10 (with buffer)
```

### Backpressure

When queue grows too large:

```
if work_queue.size > HIGH_WATERMARK:
    stop accepting new failures
    emit alert
    
if work_queue.size < LOW_WATERMARK:
    resume accepting failures
```

---

## Monitoring

### Metrics

```
# Instance pool
instances_total{status="available|busy|idle|spawning"}
instance_spawn_duration_seconds
instance_task_duration_seconds

# Task processing  
tasks_queued_total
tasks_completed_total{status="success|failed|timeout"}
task_wait_time_seconds
task_processing_time_seconds

# Failures
failures_received_total
failures_completed_total{result="fixed|escalated"}
failure_processing_time_seconds

# System
event_queue_size
memory_usage_bytes
```

### Alerts

```
- Instance pool exhausted (all busy, queue growing)
- High task failure rate
- Instance spawn failures
- State lock contention
- Event queue backup
```

---

## Failure Handling

### Instance Crash

```
on instance_health_check_failed(instance):
    tasks = get_tasks_assigned_to(instance)
    for task in tasks:
        reset_task(task)
        enqueue_task(task)
    
    remove_instance(instance)
    
    if pool_size < min_instances:
        spawn_instance()
```

### Task Timeout

```
on task_timeout(task, instance):
    kill_session(instance)
    
    if task.retries < max_retries:
        task.retries += 1
        enqueue_task(task)
    else:
        mark_task_failed(task)
        evaluate_failure_status(task.failure_id)
    
    reset_instance(instance)
    emit(INSTANCE_AVAILABLE, instance)
```

### Orchestrator Crash Recovery

On restart:

```
1. Scan /state/ for in-progress failures
2. Check each failure's state
3. Re-enqueue incomplete tasks
4. Scan /instances/ for existing instances
5. Health check each instance
6. Resume event loop
```

---

## Comparison: When To Use Which

### Use Synchronous When

- Getting started / prototyping
- Low failure volume (< 10/hour)
- Limited resources (single machine)
- Simplicity is priority

### Use Asynchronous When

- High failure volume
- SLA on fix time
- Resources available for multiple instances
- Need parallel processing

### Migration Path

```
Sync (single instance)
    │
    ▼
Sync (multiple failures queued, one at a time)
    │
    ▼
Async (parallel failures, one instance each)
    │
    ▼
Async (parallel failures, parallel agents)
    │
    ▼
Distributed (multiple orchestrators)
```

---

## Implementation Checklist

### Phase 1: Instance Pool
- [ ] Instance spawning via CLI
- [ ] WebSocket port discovery
- [ ] Instance health checks
- [ ] Pool size management
- [ ] Idle instance cleanup

### Phase 2: Event System
- [ ] Event queue implementation
- [ ] Event types defined
- [ ] Async event handlers
- [ ] Event persistence (optional)

### Phase 3: Task Scheduling
- [ ] Work queue implementation
- [ ] Priority handling
- [ ] Task assignment logic
- [ ] Timeout management

### Phase 4: Concurrent State
- [ ] File locking mechanism
- [ ] State versioning
- [ ] Parallel result merging
- [ ] Conflict resolution

### Phase 5: Parallel Execution
- [ ] Dependency graph definition
- [ ] Parallel task identification
- [ ] Result merging logic
- [ ] Speculative execution (optional)

### Phase 6: Monitoring
- [ ] Metrics collection
- [ ] Dashboard
- [ ] Alerting
- [ ] Logging aggregation

---

## Agent Roles (Unchanged)

Agent responsibilities remain the same as sync architecture:

| Agent | Role | Output |
|-------|------|--------|
| Planner | Decide next action | Action name or DONE/ESCALATE |
| Classifier | Categorize failure | Failure type |
| Inspection Planner | Plan browser check | Playwright command |
| Inspection Analyzer | Interpret DOM | Diagnosis |
| Fix Generator | Create code fix | File diff |
| Validation Planner | Plan validation | Playwright/test command |
| Validation Analyzer | Interpret results | Pass/fail |

The async architecture changes how agents are scheduled and executed, not what they do.

---

## Prompt Management System

Prompts are stored as external files for runtime editing without recompilation. This enables iterative fine-tuning to achieve near-perfect success rates.

### File Structure

```
/prompts/
  current/                    # Active prompts (symlink or configured)
    planner.md
    classifier.md
    inspection_planner.md
    inspection_analyzer.md
    fix_generator.md
    validation_planner.md
    validation_analyzer.md
    correction.md             # Used for retry attempts
  
  versions/
    v1/
      planner.md
      classifier.md
      ...
    v2/
      classifier.md           # Only changed files
    v3/
      fix_generator.md
  
  experiments/
    classifier_verbose.md     # A/B test variants
    classifier_concise.md
```

### Template Variables

Prompts use `{{variable}}` syntax for dynamic content:

```markdown
You are the Classifier agent.

## Input
- Error message: {{error_message}}
- Stack trace: {{stack_trace}}
- Test file: {{test_file}}

## Context
- Failure ID: {{failure_id}}
- State path: {{state_path}}

## Task
Determine the failure type.

## Output
Write JSON to {{output_path}}:
{
  "failure_type": "locator | timing | assertion | environment | unknown",
  "confidence": "high | medium | low",
  "reasoning": "..."
}

Reply DONE when complete.
```

### Available Variables

| Variable | Description |
|----------|-------------|
| `{{failure_id}}` | Unique failure identifier |
| `{{state_path}}` | Path to state.json |
| `{{input_path}}` | Path to inputs/task.json |
| `{{output_path}}` | Path to outputs/result.json |
| `{{error_message}}` | Test failure error |
| `{{stack_trace}}` | Full stack trace |
| `{{test_file}}` | Path to failing test |
| `{{url}}` | URL to inspect |
| `{{selector}}` | CSS/XPath selector |
| `{{dom_snippet}}` | Captured DOM fragment |
| `{{file_to_fix}}` | Path to file needing changes |
| `{{diagnosis}}` | Output from analyzer |
| `{{previous_error}}` | Error from failed attempt (for correction.md) |

### Hot Reload

Plugin watches prompt directory for changes:

```
PromptWatcher
├── watch(/prompts/current/)
├── on_file_changed(path) ─► reload_prompt(path)
├── on_file_created(path) ─► load_prompt(path)
└── on_file_deleted(path) ─► remove_prompt(path)
```

Behavior:
- Edit prompt file → save → next agent call uses updated version
- No restart required
- Change takes effect immediately
- Failed loads fall back to previous version

### Prompt Loading

```
PromptManager
├── load_all() ─► reads /prompts/current/
├── get(agent_type) ─► returns template
├── render(agent_type, variables) ─► substitutes {{vars}}
├── reload(agent_type) ─► hot reload single prompt
└── get_version() ─► current prompt version hash
```

### Correction Prompt

Special prompt used when agent output fails validation:

`/prompts/current/correction.md`:

```markdown
The output file you wrote is invalid.

## Errors
{{validation_errors}}

## Your Previous Output
{{previous_output}}

## Instructions
Read the file you wrote: {{output_path}}

Fix the errors and write the corrected version to the same file.

Reply DONE when complete.
```

---

## Prompt Versioning

### Version Control Strategy

```
/prompts/
  versions/
    v1/                      # Initial prompts
    v2/                      # Improved classifier
    v3/                      # Better fix generator
    v4/                      # Current best
  
  current -> versions/v4     # Symlink to active version
```

Or via configuration:

```yaml
prompts:
  base_path: /prompts/versions
  active_version: v4
  fallback_version: v3
```

### Version Metadata

Each version directory includes metadata:

`/prompts/versions/v4/VERSION.yaml`:

```yaml
version: v4
created_at: 2024-01-15T10:30:00Z
author: john
description: Improved fix generator with better locator patterns
changes:
  - fix_generator.md: Added examples for data-testid selectors
  - classifier.md: Increased confidence thresholds
parent_version: v3
```

### Rollback

If new prompts cause issues:

```
1. Update symlink: current -> versions/v3
2. Or update config: active_version: v3
3. Hot reload triggers automatically
4. System uses previous prompts immediately
```

---

## Success Rate Tracking

### Metrics Per Prompt

Track performance for each prompt file:

```
/metrics/
  prompts/
    classifier.json
    fix_generator.json
    ...
```

`/metrics/prompts/classifier.json`:

```json
{
  "prompt": "classifier.md",
  "version": "v4",
  "period": "2024-01-15",
  
  "totals": {
    "attempts": 127,
    "successes": 118,
    "retries_needed": 23,
    "failures_after_retry": 4,
    "timeouts": 5
  },
  
  "rates": {
    "first_attempt_success": 0.819,
    "success_with_retry": 0.929,
    "overall_success": 0.961
  },
  
  "timing": {
    "avg_duration_ms": 3420,
    "p50_duration_ms": 2890,
    "p95_duration_ms": 7230
  },
  
  "tokens": {
    "avg_input": 542,
    "avg_output": 187
  },
  
  "failure_reasons": {
    "invalid_json": 2,
    "missing_field": 1,
    "timeout": 5,
    "unknown": 1
  },
  
  "last_updated": "2024-01-15T18:45:00Z"
}
```

### Metrics Collection

On each agent execution:

```
function record_prompt_metrics(agent_type, result):
    metrics = load_metrics(agent_type)
    
    metrics.totals.attempts += 1
    
    if result.success:
        metrics.totals.successes += 1
        if result.retry_count > 0:
            metrics.totals.retries_needed += 1
    else:
        if result.error == TIMEOUT:
            metrics.totals.timeouts += 1
        else:
            metrics.totals.failures_after_retry += 1
            metrics.failure_reasons[result.error] += 1
    
    metrics.timing.record(result.duration_ms)
    metrics.tokens.record(result.input_tokens, result.output_tokens)
    
    recalculate_rates(metrics)
    save_metrics(agent_type, metrics)
```

### Dashboard View

```
Prompt Performance Dashboard
═══════════════════════════════════════════════════════════════

Prompt                  │ Success │ w/Retry │ Avg Time │ Trend
────────────────────────┼─────────┼─────────┼──────────┼───────
planner.md              │  94.2%  │  98.1%  │  2.1s    │  ↑
classifier.md           │  81.9%  │  96.1%  │  3.4s    │  ↓
inspection_planner.md   │  97.3%  │  99.2%  │  1.8s    │  →
inspection_analyzer.md  │  88.4%  │  95.7%  │  4.2s    │  ↑
fix_generator.md        │  72.1%  │  89.3%  │  5.7s    │  ↓ ⚠
validation_planner.md   │  96.8%  │  99.5%  │  1.5s    │  →
validation_analyzer.md  │  91.2%  │  97.8%  │  2.3s    │  →

⚠ fix_generator.md below threshold (90%) - review needed
```

### Alerts

```yaml
alerts:
  prompt_success_rate:
    threshold: 0.90
    window: 1h
    action: notify
  
  prompt_degradation:
    drop_percent: 10
    window: 24h
    action: notify
  
  prompt_timeout_spike:
    threshold: 0.10
    window: 1h
    action: notify
```

---

## A/B Testing Prompts

### Configuration

```yaml
experiments:
  classifier:
    enabled: true
    variants:
      - name: control
        file: classifier.md
        weight: 50
      - name: verbose
        file: experiments/classifier_verbose.md
        weight: 50
    track_separately: true
    min_samples: 100
    auto_promote: true
    promote_threshold: 0.05  # 5% improvement required
```

### Variant Selection

```
function get_prompt(agent_type, failure_id):
    experiment = get_experiment(agent_type)
    
    if experiment and experiment.enabled:
        # Deterministic assignment based on failure_id
        variant = select_variant(experiment, failure_id)
        record_assignment(failure_id, agent_type, variant)
        return load_prompt(variant.file)
    
    return load_prompt(default_path(agent_type))
```

### Results Comparison

```
A/B Test Results: classifier
════════════════════════════════════════════════════════════════

Variant         │ Samples │ Success │ w/Retry │ Avg Time
────────────────┼─────────┼─────────┼─────────┼──────────
control         │   156   │  81.4%  │  95.5%  │  3.42s
verbose         │   148   │  87.2%  │  97.3%  │  3.89s
                          │ +5.8%   │ +1.8%   │ +0.47s

Statistical significance: p < 0.05 ✓
Recommendation: Promote "verbose" variant

[Promote] [Extend Test] [End Test]
```

### Auto-Promotion

When experiment reaches significance:

```
function evaluate_experiment(experiment):
    if samples < experiment.min_samples:
        return CONTINUE
    
    control = get_metrics(experiment.control)
    challenger = get_metrics(experiment.best_challenger)
    
    improvement = challenger.success_rate - control.success_rate
    
    if improvement > experiment.promote_threshold:
        if is_significant(control, challenger):
            promote_variant(experiment, challenger)
            return PROMOTED
    
    if improvement < -experiment.promote_threshold:
        if is_significant(control, challenger):
            return CHALLENGER_WORSE
    
    return CONTINUE
```

---

## Prompt Development Workflow

### 1. Identify Problem

Dashboard shows `fix_generator.md` at 72% success rate.

### 2. Analyze Failures

Review failure logs:

```
/logs/failures/fix_generator/
  2024-01-15-001.json  # Invalid JSON output
  2024-01-15-002.json  # Wrong selector format
  2024-01-15-003.json  # Missed existing pattern
```

### 3. Create Variant

Copy and modify:

```
cp /prompts/current/fix_generator.md /prompts/experiments/fix_generator_v2.md
```

Edit with improvements based on failure analysis.

### 4. Test Locally

Run specific failure through new prompt manually:

```
test_prompt --prompt experiments/fix_generator_v2.md --failure failure-123
```

### 5. A/B Test

Enable experiment in config. Let it run until significant.

### 6. Promote or Iterate

If better: promote to current.
If worse: analyze and iterate.

### 7. Version and Document

```
cp /prompts/experiments/fix_generator_v2.md /prompts/versions/v5/fix_generator.md
```

Update VERSION.yaml with changes.

---

## Implementation Checklist (Prompt Management)

### Phase 7: Prompt System
- [ ] External prompt file loading
- [ ] Template variable substitution
- [ ] Hot reload with file watching
- [ ] Fallback on load failure

### Phase 8: Versioning
- [ ] Version directory structure
- [ ] Version metadata files
- [ ] Symlink or config-based switching
- [ ] Rollback mechanism

### Phase 9: Metrics
- [ ] Per-prompt success tracking
- [ ] Timing and token metrics
- [ ] Failure reason categorization
- [ ] Metrics persistence

### Phase 10: Experimentation
- [ ] A/B test configuration
- [ ] Deterministic variant assignment
- [ ] Separate metrics per variant
- [ ] Statistical significance calculation
- [ ] Auto-promotion logic
