import { Activity, CheckCircle2, Clock, AlertTriangle, TrendingUp, Server, Zap } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';
import type { FailureState, Instance, PromptMetrics, OrchestratorEvent } from '../types';
import { calculatePoolUtilization } from '../utils/instanceConfig';

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: typeof Activity;
  color: string;
  bgColor: string;
  trend?: 'up' | 'down' | 'neutral';
}

function MetricCard({ label, value, subValue, icon: Icon, color, bgColor, trend }: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between">
        <div className={clsx('p-2 rounded-lg', bgColor)}>
          <Icon className={clsx('w-5 h-5', color)} />
        </div>
        {trend && (
          <div
            className={clsx(
              'flex items-center gap-0.5 text-xs font-medium',
              trend === 'up' && 'text-green-600',
              trend === 'down' && 'text-red-600',
              trend === 'neutral' && 'text-slate-400'
            )}
          >
            <TrendingUp
              className={clsx(
                'w-3 h-3',
                trend === 'down' && 'rotate-180'
              )}
            />
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
        {subValue && (
          <div className="text-[10px] text-slate-400 mt-1">{subValue}</div>
        )}
      </div>
    </div>
  );
}

function UtilizationGauge({ percentage }: { percentage: number }) {
  const getColor = (p: number) => {
    if (p >= 80) return { stroke: '#ef4444', bg: '#fef2f2' }; // red
    if (p >= 50) return { stroke: '#eab308', bg: '#fefce8' }; // yellow
    return { stroke: '#22c55e', bg: '#f0fdf4' }; // green
  };

  const colors = getColor(percentage);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="100" height="100" className="-rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-slate-700">{percentage}%</span>
        </div>
      </div>
      <span className="text-xs text-slate-500 mt-2">Pool Utilization</span>
    </div>
  );
}

interface PromptPerformanceRowProps {
  name: string;
  successRate: number;
  attempts: number;
}

function PromptPerformanceRow({ name, successRate, attempts }: PromptPerformanceRowProps) {
  const percentage = Math.round(successRate * 100);

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-slate-700 truncate">{name}</div>
        <div className="text-[10px] text-slate-400">{attempts} attempts</div>
      </div>
      <div className="w-24">
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full transition-all',
              percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <span className="text-xs font-medium text-slate-600 w-10 text-right">{percentage}%</span>
    </div>
  );
}

interface MetricsDashboardProps {
  /** Optional: provide failures directly instead of reading from store */
  failures?: FailureState[];
  /** Optional: provide instances directly instead of reading from store */
  instances?: Instance[];
  /** Optional: provide promptMetrics directly instead of reading from store */
  promptMetrics?: PromptMetrics[];
  /** Optional: provide events directly instead of reading from store */
  events?: OrchestratorEvent[];
}

export default function MetricsDashboard({
  failures: failuresProp,
  instances: instancesProp,
  promptMetrics: promptMetricsProp,
  events: eventsProp,
}: MetricsDashboardProps = {}) {
  const storeFailures = useStore((s) => s.failures);
  const storeInstances = useStore((s) => s.instances);
  const storePromptMetrics = useStore((s) => s.promptMetrics);
  const storeEvents = useStore((s) => s.events);

  const failures = failuresProp ?? storeFailures;
  const instances = instancesProp ?? storeInstances;
  const promptMetrics = promptMetricsProp ?? storePromptMetrics;
  const events = eventsProp ?? storeEvents;
  const poolUtilization = calculatePoolUtilization(instances);

  // Calculate failure metrics
  const totalFailures = failures.length;
  const fixedFailures = failures.filter((f) => f.status === 'fixed').length;
  const escalatedFailures = failures.filter((f) => f.status === 'escalated').length;
  const processingFailures = failures.filter((f) => f.status === 'processing').length;
  const successRate = totalFailures > 0 ? fixedFailures / totalFailures : 0;

  // Calculate average fix time (mock - would come from real data)
  const avgFixTimeMs = failures
    .filter((f) => f.status === 'fixed')
    .reduce((sum, f) => {
      const created = new Date(f.created_at).getTime();
      const updated = new Date(f.updated_at).getTime();
      return sum + (updated - created);
    }, 0);
  const avgFixTimeSecs = failures.filter((f) => f.status === 'fixed').length > 0
    ? Math.round(avgFixTimeMs / failures.filter((f) => f.status === 'fixed').length / 1000)
    : 0;

  // Get recent alerts (failures and validation failures from events)
  const recentAlerts = events
    .filter((e) => ['FAILURE_RECEIVED', 'VALIDATION_FAILED', 'AGENT_FAILED'].includes(e.type))
    .slice(0, 5);

  // Sort prompts by attempts for performance table
  const topPrompts = [...promptMetrics]
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 5);

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-600" />
          <h3 className="font-semibold text-slate-800">Metrics Overview</h3>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Total Failures"
            value={totalFailures}
            subValue={`${processingFailures} in progress`}
            icon={AlertTriangle}
            color="text-red-600"
            bgColor="bg-red-100"
          />
          <MetricCard
            label="Success Rate"
            value={`${Math.round(successRate * 100)}%`}
            subValue={`${fixedFailures} fixed / ${escalatedFailures} escalated`}
            icon={CheckCircle2}
            color="text-green-600"
            bgColor="bg-green-100"
            trend={successRate >= 0.8 ? 'up' : successRate >= 0.5 ? 'neutral' : 'down'}
          />
          <MetricCard
            label="Avg Fix Time"
            value={avgFixTimeSecs > 0 ? `${avgFixTimeSecs}s` : '-'}
            icon={Clock}
            color="text-blue-600"
            bgColor="bg-blue-100"
          />
          <MetricCard
            label="Active Instances"
            value={poolUtilization.total}
            subValue={`${poolUtilization.busy} busy / ${poolUtilization.available} available`}
            icon={Server}
            color="text-purple-600"
            bgColor="bg-purple-100"
          />
        </div>

        {/* Utilization Gauge */}
        <div className="flex justify-center py-2">
          <UtilizationGauge percentage={poolUtilization.utilizationPercent} />
        </div>

        {/* Prompt Performance */}
        {topPrompts.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Prompt Performance
            </h4>
            <div className="divide-y divide-slate-100">
              {topPrompts.map((p) => (
                <PromptPerformanceRow
                  key={`${p.agent_type}-${p.prompt_name}`}
                  name={p.prompt_name}
                  successRate={p.first_attempt_success_rate}
                  attempts={p.attempts}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recent Alerts */}
        {recentAlerts.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Recent Alerts
            </h4>
            <div className="space-y-1">
              {recentAlerts.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-2 py-1.5 px-2 bg-slate-50 rounded text-xs"
                >
                  <Zap
                    className={clsx(
                      'w-3 h-3',
                      event.type === 'FAILURE_RECEIVED' && 'text-red-500',
                      event.type === 'VALIDATION_FAILED' && 'text-amber-500',
                      event.type === 'AGENT_FAILED' && 'text-orange-500'
                    )}
                  />
                  <span className="text-slate-600 flex-1 truncate">
                    {event.type.replace(/_/g, ' ').toLowerCase()}
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
