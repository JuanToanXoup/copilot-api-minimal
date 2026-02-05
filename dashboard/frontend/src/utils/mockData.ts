import type {
  Instance,
  TaskQueues,
  FailureState,
  OrchestratorEvent,
  PromptMetrics,
} from '../types';

// Mock Instances
export const mockInstances: Instance[] = [
  {
    id: 'inst-001',
    port: 63342,
    status: 'busy',
    current_task: 'task-003',
    started_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'inst-002',
    port: 63343,
    status: 'available',
    started_at: new Date(Date.now() - 7200000).toISOString(),
    idle_since: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'inst-003',
    port: 63344,
    status: 'busy',
    current_task: 'task-007',
    started_at: new Date(Date.now() - 5400000).toISOString(),
  },
  {
    id: 'inst-004',
    port: 63345,
    status: 'idle',
    started_at: new Date(Date.now() - 1800000).toISOString(),
    idle_since: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 'inst-005',
    port: 63346,
    status: 'spawning',
    started_at: new Date(Date.now() - 30000).toISOString(),
  },
  {
    id: 'inst-006',
    port: 63347,
    status: 'available',
    started_at: new Date(Date.now() - 4000000).toISOString(),
    idle_since: new Date(Date.now() - 60000).toISOString(),
  },
];

// Mock Tasks
export const mockTasks: TaskQueues = {
  inbound: [
    {
      id: 'task-001',
      failure_id: 'fail-001',
      task_type: 'CLASSIFY',
      priority: 'high',
      status: 'queued',
      created_at: new Date(Date.now() - 60000).toISOString(),
    },
    {
      id: 'task-002',
      failure_id: 'fail-002',
      task_type: 'CLASSIFY',
      priority: 'normal',
      status: 'queued',
      created_at: new Date(Date.now() - 45000).toISOString(),
    },
    {
      id: 'task-008',
      failure_id: 'fail-004',
      task_type: 'CLASSIFY',
      priority: 'low',
      status: 'queued',
      created_at: new Date(Date.now() - 30000).toISOString(),
    },
  ],
  work: [
    {
      id: 'task-003',
      failure_id: 'fail-003',
      task_type: 'INSPECT_ANALYZE',
      priority: 'high',
      assigned_instance: 'inst-001',
      status: 'assigned',
      created_at: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: 'task-007',
      failure_id: 'fail-003',
      task_type: 'FIX_GEN',
      priority: 'normal',
      assigned_instance: 'inst-003',
      status: 'assigned',
      created_at: new Date(Date.now() - 180000).toISOString(),
    },
  ],
  result: [
    {
      id: 'task-004',
      failure_id: 'fail-003',
      task_type: 'CLASSIFY',
      priority: 'high',
      assigned_instance: 'inst-002',
      status: 'completed',
      created_at: new Date(Date.now() - 600000).toISOString(),
    },
    {
      id: 'task-005',
      failure_id: 'fail-003',
      task_type: 'INSPECT_PLAN',
      priority: 'high',
      assigned_instance: 'inst-001',
      status: 'completed',
      created_at: new Date(Date.now() - 500000).toISOString(),
    },
    {
      id: 'task-006',
      failure_id: 'fail-005',
      task_type: 'VALIDATE_ANALYZE',
      priority: 'normal',
      assigned_instance: 'inst-004',
      status: 'failed',
      created_at: new Date(Date.now() - 400000).toISOString(),
    },
  ],
};

// Mock Failures
export const mockFailures: FailureState[] = [
  {
    id: 'fail-001',
    version: 1,
    status: 'pending',
    phase: 'classification',
    test_file: 'src/test/java/com/example/UserServiceTest.java',
    error_message: 'Expected 200 but got 404',
    stack_trace: `java.lang.AssertionError: Expected 200 but got 404
    at com.example.UserServiceTest.testGetUser(UserServiceTest.java:45)
    at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)`,
    retries: {},
    task_history: [],
    created_at: new Date(Date.now() - 60000).toISOString(),
    updated_at: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: 'fail-002',
    version: 1,
    status: 'pending',
    phase: 'classification',
    test_file: 'src/test/java/com/example/PaymentTest.java',
    error_message: 'NullPointerException in processPayment',
    retries: {},
    task_history: [],
    created_at: new Date(Date.now() - 45000).toISOString(),
    updated_at: new Date(Date.now() - 45000).toISOString(),
  },
  {
    id: 'fail-003',
    version: 4,
    status: 'processing',
    phase: 'fix_generation',
    test_file: 'src/test/java/com/example/OrderServiceTest.java',
    error_message: 'Timeout waiting for async operation',
    stack_trace: `java.util.concurrent.TimeoutException: Timeout waiting for async operation
    at com.example.OrderServiceTest.testAsyncOrder(OrderServiceTest.java:112)`,
    retries: { CLASSIFY: 0, INSPECT_PLAN: 0, INSPECT_ANALYZE: 1, FIX_GEN: 0 },
    task_history: [
      {
        task_id: 'task-004',
        task_type: 'CLASSIFY',
        status: 'completed',
        started_at: new Date(Date.now() - 600000).toISOString(),
        completed_at: new Date(Date.now() - 550000).toISOString(),
        result: 'async_timing_issue',
      },
      {
        task_id: 'task-005',
        task_type: 'INSPECT_PLAN',
        status: 'completed',
        started_at: new Date(Date.now() - 500000).toISOString(),
        completed_at: new Date(Date.now() - 450000).toISOString(),
        result: 'Plan: Increase timeout, add retry logic',
      },
      {
        task_id: 'task-003',
        task_type: 'INSPECT_ANALYZE',
        status: 'completed',
        started_at: new Date(Date.now() - 400000).toISOString(),
        completed_at: new Date(Date.now() - 320000).toISOString(),
        result: 'Root cause: Missing await in async handler',
      },
      {
        task_id: 'task-007',
        task_type: 'FIX_GEN',
        status: 'assigned',
        started_at: new Date(Date.now() - 180000).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 700000).toISOString(),
    updated_at: new Date(Date.now() - 180000).toISOString(),
  },
  {
    id: 'fail-004',
    version: 1,
    status: 'pending',
    phase: 'classification',
    test_file: 'src/test/java/com/example/AuthTest.java',
    error_message: 'Invalid token format',
    retries: {},
    task_history: [],
    created_at: new Date(Date.now() - 30000).toISOString(),
    updated_at: new Date(Date.now() - 30000).toISOString(),
  },
  {
    id: 'fail-005',
    version: 3,
    status: 'escalated',
    phase: 'validation',
    test_file: 'src/test/java/com/example/DatabaseTest.java',
    error_message: 'Connection pool exhausted',
    stack_trace: `com.zaxxer.hikari.pool.HikariPool$PoolInitializationException: Failed to initialize pool
    at com.example.DatabaseTest.testConnectionPool(DatabaseTest.java:78)`,
    retries: { CLASSIFY: 0, INSPECT_PLAN: 1, INSPECT_ANALYZE: 1, FIX_GEN: 2, VALIDATE_ANALYZE: 1 },
    task_history: [
      {
        task_id: 'task-old-1',
        task_type: 'CLASSIFY',
        status: 'completed',
        started_at: new Date(Date.now() - 900000).toISOString(),
        completed_at: new Date(Date.now() - 850000).toISOString(),
        result: 'resource_exhaustion',
      },
      {
        task_id: 'task-old-2',
        task_type: 'INSPECT_PLAN',
        status: 'completed',
        started_at: new Date(Date.now() - 800000).toISOString(),
        completed_at: new Date(Date.now() - 750000).toISOString(),
        result: 'Increase pool size',
      },
      {
        task_id: 'task-old-3',
        task_type: 'INSPECT_ANALYZE',
        status: 'completed',
        started_at: new Date(Date.now() - 700000).toISOString(),
        completed_at: new Date(Date.now() - 650000).toISOString(),
        result: 'Connection leak detected',
      },
      {
        task_id: 'task-old-4',
        task_type: 'FIX_GEN',
        status: 'completed',
        started_at: new Date(Date.now() - 600000).toISOString(),
        completed_at: new Date(Date.now() - 550000).toISOString(),
        result: 'Added connection cleanup',
      },
      {
        task_id: 'task-006',
        task_type: 'VALIDATE_ANALYZE',
        status: 'failed',
        started_at: new Date(Date.now() - 500000).toISOString(),
        completed_at: new Date(Date.now() - 400000).toISOString(),
        error: 'Fix did not resolve the issue - max retries exceeded',
      },
    ],
    created_at: new Date(Date.now() - 1000000).toISOString(),
    updated_at: new Date(Date.now() - 400000).toISOString(),
  },
  {
    id: 'fail-006',
    version: 5,
    status: 'fixed',
    phase: 'validation',
    test_file: 'src/test/java/com/example/CacheTest.java',
    error_message: 'Cache key collision',
    retries: { CLASSIFY: 0, INSPECT_PLAN: 0, INSPECT_ANALYZE: 0, FIX_GEN: 1, VALIDATE_PLAN: 0, VALIDATE_ANALYZE: 0 },
    task_history: [
      {
        task_id: 'task-fix-1',
        task_type: 'CLASSIFY',
        status: 'completed',
        started_at: new Date(Date.now() - 1200000).toISOString(),
        completed_at: new Date(Date.now() - 1150000).toISOString(),
        result: 'cache_collision',
      },
      {
        task_id: 'task-fix-2',
        task_type: 'INSPECT_PLAN',
        status: 'completed',
        started_at: new Date(Date.now() - 1100000).toISOString(),
        completed_at: new Date(Date.now() - 1050000).toISOString(),
        result: 'Use composite key',
      },
      {
        task_id: 'task-fix-3',
        task_type: 'INSPECT_ANALYZE',
        status: 'completed',
        started_at: new Date(Date.now() - 1000000).toISOString(),
        completed_at: new Date(Date.now() - 950000).toISOString(),
        result: 'Hash function needs namespace prefix',
      },
      {
        task_id: 'task-fix-4',
        task_type: 'FIX_GEN',
        status: 'completed',
        started_at: new Date(Date.now() - 900000).toISOString(),
        completed_at: new Date(Date.now() - 850000).toISOString(),
        result: 'Added namespace prefix to cache keys',
      },
      {
        task_id: 'task-fix-5',
        task_type: 'VALIDATE_PLAN',
        status: 'completed',
        started_at: new Date(Date.now() - 800000).toISOString(),
        completed_at: new Date(Date.now() - 750000).toISOString(),
        result: 'Validation plan approved',
      },
      {
        task_id: 'task-fix-6',
        task_type: 'VALIDATE_ANALYZE',
        status: 'completed',
        started_at: new Date(Date.now() - 700000).toISOString(),
        completed_at: new Date(Date.now() - 650000).toISOString(),
        result: 'All tests passing',
      },
    ],
    created_at: new Date(Date.now() - 1300000).toISOString(),
    updated_at: new Date(Date.now() - 650000).toISOString(),
  },
];

// Mock Events
export const mockEvents: OrchestratorEvent[] = [
  {
    id: 'evt-001',
    timestamp: new Date(Date.now() - 5000).toISOString(),
    type: 'INSTANCE_SPAWNED',
    payload: { instance_id: 'inst-005', port: 63346 },
  },
  {
    id: 'evt-002',
    timestamp: new Date(Date.now() - 15000).toISOString(),
    type: 'TASK_ASSIGNED',
    payload: { task_id: 'task-007', instance_id: 'inst-003', task_type: 'FIX_GEN' },
  },
  {
    id: 'evt-003',
    timestamp: new Date(Date.now() - 30000).toISOString(),
    type: 'FAILURE_RECEIVED',
    payload: { failure_id: 'fail-004', test_file: 'AuthTest.java' },
  },
  {
    id: 'evt-004',
    timestamp: new Date(Date.now() - 45000).toISOString(),
    type: 'AGENT_COMPLETED',
    payload: { task_id: 'task-003', instance_id: 'inst-001', result: 'success' },
  },
  {
    id: 'evt-005',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    type: 'TASK_QUEUED',
    payload: { task_id: 'task-001', failure_id: 'fail-001', task_type: 'CLASSIFY', priority: 'high' },
  },
  {
    id: 'evt-006',
    timestamp: new Date(Date.now() - 90000).toISOString(),
    type: 'VALIDATION_FAILED',
    payload: { failure_id: 'fail-005', task_id: 'task-006', reason: 'Max retries exceeded' },
  },
  {
    id: 'evt-007',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    type: 'INSTANCE_AVAILABLE',
    payload: { instance_id: 'inst-002', port: 63343 },
  },
  {
    id: 'evt-008',
    timestamp: new Date(Date.now() - 180000).toISOString(),
    type: 'AGENT_FAILED',
    payload: { task_id: 'task-006', instance_id: 'inst-004', error: 'Validation did not pass' },
  },
  {
    id: 'evt-009',
    timestamp: new Date(Date.now() - 240000).toISOString(),
    type: 'VALIDATION_PASSED',
    payload: { failure_id: 'fail-006', task_id: 'task-fix-6' },
  },
  {
    id: 'evt-010',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    type: 'TASK_ASSIGNED',
    payload: { task_id: 'task-003', instance_id: 'inst-001', task_type: 'INSPECT_ANALYZE' },
  },
  {
    id: 'evt-011',
    timestamp: new Date(Date.now() - 360000).toISOString(),
    type: 'INSTANCE_TERMINATED',
    payload: { instance_id: 'inst-old-001', reason: 'idle_timeout' },
  },
  {
    id: 'evt-012',
    timestamp: new Date(Date.now() - 420000).toISOString(),
    type: 'FAILURE_RECEIVED',
    payload: { failure_id: 'fail-003', test_file: 'OrderServiceTest.java' },
  },
];

// Mock Prompt Metrics
export const mockPromptMetrics: PromptMetrics[] = [
  {
    prompt_name: 'classify_failure',
    agent_type: 'classifier',
    version: '1.2.0',
    attempts: 156,
    successes: 142,
    first_attempt_success_rate: 0.91,
    avg_duration_ms: 2340,
    last_used: new Date(Date.now() - 60000).toISOString(),
  },
  {
    prompt_name: 'inspect_plan',
    agent_type: 'inspector',
    version: '2.0.1',
    attempts: 98,
    successes: 89,
    first_attempt_success_rate: 0.87,
    avg_duration_ms: 3450,
    last_used: new Date(Date.now() - 120000).toISOString(),
  },
  {
    prompt_name: 'inspect_analyze',
    agent_type: 'inspector',
    version: '2.0.1',
    attempts: 87,
    successes: 74,
    first_attempt_success_rate: 0.82,
    avg_duration_ms: 5670,
    last_used: new Date(Date.now() - 180000).toISOString(),
  },
  {
    prompt_name: 'fix_generate',
    agent_type: 'fixer',
    version: '1.5.3',
    attempts: 64,
    successes: 51,
    first_attempt_success_rate: 0.72,
    avg_duration_ms: 8920,
    last_used: new Date(Date.now() - 240000).toISOString(),
  },
  {
    prompt_name: 'validate_plan',
    agent_type: 'validator',
    version: '1.1.0',
    attempts: 45,
    successes: 41,
    first_attempt_success_rate: 0.89,
    avg_duration_ms: 1890,
    last_used: new Date(Date.now() - 300000).toISOString(),
  },
  {
    prompt_name: 'validate_analyze',
    agent_type: 'validator',
    version: '1.1.0',
    attempts: 42,
    successes: 35,
    first_attempt_success_rate: 0.78,
    avg_duration_ms: 4560,
    last_used: new Date(Date.now() - 360000).toISOString(),
  },
];

// Initialize mock store with mock data (for Mock-Monitor tab)
export function initializeMockData(store: {
  setMockInstances: (instances: Instance[]) => void;
  setMockTasks: (tasks: TaskQueues) => void;
  setMockFailures: (failures: FailureState[]) => void;
  addMockEvent: (event: OrchestratorEvent) => void;
  setMockPromptMetrics: (metrics: PromptMetrics[]) => void;
}) {
  store.setMockInstances(mockInstances);
  store.setMockTasks(mockTasks);
  store.setMockFailures(mockFailures);
  store.setMockPromptMetrics(mockPromptMetrics);

  // Add events in reverse order (oldest first) so newest appears at top
  [...mockEvents].reverse().forEach((event) => {
    store.addMockEvent(event);
  });
}
