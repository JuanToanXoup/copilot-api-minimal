import { Plus, Server } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';
import type { Instance } from '../types';
import {
  getInstanceStatusConfig,
  formatInstanceUptime,
  formatIdleTime,
  calculatePoolUtilization,
} from '../utils/instanceConfig';

interface InstancePoolPanelProps {
  onSpawnInstance?: () => void;
  /** Optional: provide instances directly instead of reading from store */
  instances?: Instance[];
}

export default function InstancePoolPanel({ onSpawnInstance, instances: instancesProp }: InstancePoolPanelProps) {
  const storeInstances = useStore((s) => s.instances);
  const instances = instancesProp ?? storeInstances;
  const utilization = calculatePoolUtilization(instances);

  // Filter out terminated instances for display
  const activeInstances = instances.filter((i) => i.status !== 'terminated');

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-600" />
            <h3 className="font-semibold text-slate-800">Instance Pool</h3>
          </div>
          {onSpawnInstance && (
            <button
              onClick={onSpawnInstance}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
            >
              <Plus className="w-3 h-3" />
              Spawn
            </button>
          )}
        </div>

        {/* Utilization Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Pool Utilization</span>
            <span className="font-medium">{utilization.utilizationPercent}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full transition-all duration-300',
                utilization.utilizationPercent > 80
                  ? 'bg-red-500'
                  : utilization.utilizationPercent > 50
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
              )}
              style={{ width: `${utilization.utilizationPercent}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Available: {utilization.available}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Busy: {utilization.busy}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              Idle: {utilization.idle}
            </span>
          </div>
        </div>
      </div>

      {/* Instance Grid */}
      <div className="p-4">
        {activeInstances.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No instances running</p>
            {onSpawnInstance && (
              <button
                onClick={onSpawnInstance}
                className="mt-2 text-blue-500 hover:text-blue-600 text-sm"
              >
                Spawn your first instance
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {activeInstances.map((instance) => {
              const statusConfig = getInstanceStatusConfig(instance.status);
              const StatusIcon = statusConfig.icon;
              const isAnimated = instance.status === 'spawning';

              return (
                <div
                  key={instance.id}
                  className={clsx(
                    'rounded-lg border-2 p-3 transition-all',
                    statusConfig.borderColor,
                    statusConfig.bgColor
                  )}
                >
                  {/* Instance Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusIcon
                        className={clsx(
                          'w-4 h-4',
                          statusConfig.color,
                          isAnimated && 'animate-spin'
                        )}
                      />
                      <span className="font-mono text-xs text-slate-600">
                        :{instance.port}
                      </span>
                    </div>
                    <span
                      className={clsx(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium',
                        statusConfig.bgColor,
                        statusConfig.color
                      )}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Instance ID */}
                  <div className="text-[10px] text-slate-500 font-mono truncate mb-1">
                    {instance.id.slice(0, 12)}...
                  </div>

                  {/* Current Task (if busy) */}
                  {instance.status === 'busy' && instance.current_task && (
                    <div className="mt-2 p-2 bg-white rounded border border-blue-200">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">
                        Current Task
                      </div>
                      <div className="text-xs text-blue-700 font-medium truncate">
                        {instance.current_task}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span>Uptime: {formatInstanceUptime(instance.started_at)}</span>
                    {instance.status === 'idle' && (
                      <span>Idle: {formatIdleTime(instance.idle_since)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
