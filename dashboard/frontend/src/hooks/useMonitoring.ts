import { useCallback, useEffect } from 'react';
import { useStore } from '../store';

interface UseMonitoringProps {
  wsRef: React.RefObject<WebSocket | null>;
  connected: boolean;
  viewMode: string;
}

export function useMonitoring({ wsRef, connected, viewMode }: UseMonitoringProps) {
  const { addToast } = useStore();

  // Spawn a new IntelliJ instance
  const handleSpawnInstance = useCallback(() => {
    if (!wsRef.current) {
      addToast({
        type: 'error',
        title: 'Not Connected',
        message: 'Cannot spawn instance while disconnected.',
      });
      return;
    }

    wsRef.current.send(JSON.stringify({ type: 'spawn_instance' }));
    addToast({
      type: 'info',
      title: 'Spawning Instance',
      message: 'New IntelliJ instance is starting...',
      duration: 3000,
    });
  }, [wsRef, addToast]);

  // Retry a failed failure
  const handleRetryFailure = useCallback((failureId: string) => {
    if (!wsRef.current) {
      addToast({
        type: 'error',
        title: 'Not Connected',
        message: 'Cannot retry failure while disconnected.',
      });
      return;
    }

    wsRef.current.send(JSON.stringify({ type: 'retry_failure', failure_id: failureId }));
    addToast({
      type: 'info',
      title: 'Retrying Failure',
      message: `Retrying failure ${failureId.slice(0, 8)}...`,
      duration: 3000,
    });
  }, [wsRef, addToast]);

  // Escalate a failure
  const handleEscalateFailure = useCallback((failureId: string) => {
    if (!wsRef.current) {
      addToast({
        type: 'error',
        title: 'Not Connected',
        message: 'Cannot escalate failure while disconnected.',
      });
      return;
    }

    wsRef.current.send(JSON.stringify({ type: 'escalate_failure', failure_id: failureId }));
    addToast({
      type: 'warning',
      title: 'Failure Escalated',
      message: `Failure ${failureId.slice(0, 8)} has been escalated.`,
      duration: 3000,
    });
  }, [wsRef, addToast]);

  // Request initial monitoring data when switching to monitoring mode
  useEffect(() => {
    if (viewMode === 'monitoring' && wsRef.current && connected) {
      wsRef.current.send(JSON.stringify({ type: 'get_failures' }));
      wsRef.current.send(JSON.stringify({ type: 'get_instances' }));
      wsRef.current.send(JSON.stringify({ type: 'get_tasks' }));
      wsRef.current.send(JSON.stringify({ type: 'get_prompt_metrics' }));
    }
  }, [viewMode, connected, wsRef]);

  return {
    handleSpawnInstance,
    handleRetryFailure,
    handleEscalateFailure,
  };
}
