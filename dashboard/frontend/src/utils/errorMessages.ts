export interface FriendlyError {
  title: string;
  message: string;
  suggestion: string;
  severity: 'error' | 'warning' | 'info';
}

// Pattern-based error mappings
const errorPatterns: Array<{
  pattern: RegExp;
  error: FriendlyError;
}> = [
  {
    pattern: /cannot call recv.*session is already used/i,
    error: {
      title: 'Agent Busy',
      message: 'This agent is currently processing another request.',
      suggestion: 'Wait for the current task to complete or use a different agent.',
      severity: 'warning',
    },
  },
  {
    pattern: /connection refused|ECONNREFUSED/i,
    error: {
      title: 'Connection Failed',
      message: 'Unable to connect to the agent.',
      suggestion: 'Check that the agent is running and the port is correct.',
      severity: 'error',
    },
  },
  {
    pattern: /timeout|ETIMEDOUT/i,
    error: {
      title: 'Request Timeout',
      message: 'The agent took too long to respond.',
      suggestion: 'The task may be complex. Try breaking it into smaller steps.',
      severity: 'warning',
    },
  },
  {
    pattern: /not connected/i,
    error: {
      title: 'Not Connected',
      message: 'No connection to the backend server.',
      suggestion: 'Check your network connection and refresh the page.',
      severity: 'error',
    },
  },
  {
    pattern: /websocket.*closed|socket hang up/i,
    error: {
      title: 'Connection Lost',
      message: 'The connection to the agent was interrupted.',
      suggestion: 'The agent may have restarted. Try reconnecting.',
      severity: 'error',
    },
  },
  {
    pattern: /invalid json|JSON\.parse|unexpected token/i,
    error: {
      title: 'Invalid Response',
      message: 'The agent returned an invalid response format.',
      suggestion: 'Try rephrasing your request or check the agent logs.',
      severity: 'warning',
    },
  },
  {
    pattern: /rate limit|too many requests|429/i,
    error: {
      title: 'Rate Limited',
      message: 'Too many requests sent in a short time.',
      suggestion: 'Wait a moment before sending another request.',
      severity: 'warning',
    },
  },
  {
    pattern: /authentication|unauthorized|401|403/i,
    error: {
      title: 'Authentication Error',
      message: 'The agent could not authenticate the request.',
      suggestion: 'Check your API credentials and permissions.',
      severity: 'error',
    },
  },
  {
    pattern: /out of memory|heap|OOM/i,
    error: {
      title: 'Memory Error',
      message: 'The agent ran out of memory.',
      suggestion: 'Try a simpler request or restart the agent.',
      severity: 'error',
    },
  },
  {
    pattern: /spawn.*failed|process.*exit/i,
    error: {
      title: 'Agent Spawn Failed',
      message: 'Could not start a new agent process.',
      suggestion: 'Check that IntelliJ is installed and the project path is valid.',
      severity: 'error',
    },
  },
];

// Default error for unrecognized patterns
const defaultError: FriendlyError = {
  title: 'Error',
  message: 'An unexpected error occurred.',
  suggestion: 'Try again or check the agent logs for details.',
  severity: 'error',
};

/**
 * Convert a technical error message to a user-friendly format
 */
export function getUserFriendlyError(error: string | Error | unknown): FriendlyError {
  const errorString = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : String(error);

  for (const { pattern, error: friendlyError } of errorPatterns) {
    if (pattern.test(errorString)) {
      return friendlyError;
    }
  }

  // Return default with the original message included
  return {
    ...defaultError,
    message: errorString.length > 100
      ? errorString.slice(0, 100) + '...'
      : errorString,
  };
}

/**
 * Check if a response string contains an error
 */
export function isErrorResponse(response: string): boolean {
  const errorIndicators = [
    /^error:/i,
    /\berror\b.*:/i,
    /cannot call/i,
    /failed to/i,
    /exception/i,
    /\bfailed\b/i,
  ];

  return errorIndicators.some(pattern => pattern.test(response));
}

/**
 * Get a short error label for display in compact UI elements
 */
export function getShortErrorLabel(error: string | Error | unknown): string {
  const friendly = getUserFriendlyError(error);
  return friendly.title;
}

/**
 * Format error for toast notification
 */
export function formatErrorForToast(error: string | Error | unknown): {
  title: string;
  description: string;
} {
  const friendly = getUserFriendlyError(error);
  return {
    title: friendly.title,
    description: `${friendly.message} ${friendly.suggestion}`,
  };
}
