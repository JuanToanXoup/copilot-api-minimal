import { useState } from 'react';
import { FileText, TrendingUp, Clock, Edit3 } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';
import type { PromptMetrics } from '../types';
import PromptEditor from './PromptEditor';

interface PromptCardProps {
  metrics: PromptMetrics;
  onEdit: () => void;
}

function SuccessRateBar({ rate }: { rate: number }) {
  const percentage = Math.round(rate * 100);
  const getColor = (p: number) => {
    if (p >= 80) return 'bg-green-500';
    if (p >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={clsx('h-full transition-all duration-300', getColor(percentage))}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-medium text-slate-600 w-10 text-right">
        {percentage}%
      </span>
    </div>
  );
}

function PromptCard({ metrics, onEdit }: PromptCardProps) {
  return (
    <div className="p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-sm text-slate-700 truncate">
              {metrics.prompt_name}
            </div>
            <div className="text-[10px] text-slate-500">
              {metrics.agent_type} | v{metrics.version}
            </div>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
          title="Edit prompt"
        >
          <Edit3 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Success Rate */}
      <div className="mb-3">
        <div className="text-[10px] text-slate-500 mb-1">First Attempt Success Rate</div>
        <SuccessRateBar rate={metrics.first_attempt_success_rate} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-1.5 bg-slate-50 rounded">
          <div className="text-xs font-semibold text-slate-700">{metrics.attempts}</div>
          <div className="text-[10px] text-slate-500">Attempts</div>
        </div>
        <div className="p-1.5 bg-green-50 rounded">
          <div className="text-xs font-semibold text-green-700">{metrics.successes}</div>
          <div className="text-[10px] text-green-600">Successes</div>
        </div>
        <div className="p-1.5 bg-blue-50 rounded">
          <div className="text-xs font-semibold text-blue-700">
            {Math.round(metrics.avg_duration_ms / 1000)}s
          </div>
          <div className="text-[10px] text-blue-600">Avg Time</div>
        </div>
      </div>

      {/* Last Used */}
      {metrics.last_used && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
          <Clock className="w-3 h-3" />
          Last used: {new Date(metrics.last_used).toLocaleString()}
        </div>
      )}
    </div>
  );
}

interface PromptManagerPanelProps {
  onGetPrompt?: (agentType: string) => Promise<string>;
  onUpdatePrompt?: (agentType: string, content: string) => Promise<void>;
}

export default function PromptManagerPanel({
  onGetPrompt,
  onUpdatePrompt,
}: PromptManagerPanelProps) {
  const { promptMetrics } = useStore();
  const [editingPrompt, setEditingPrompt] = useState<PromptMetrics | null>(null);

  // Calculate overall stats
  const totalAttempts = promptMetrics.reduce((sum, m) => sum + m.attempts, 0);
  const totalSuccesses = promptMetrics.reduce((sum, m) => sum + m.successes, 0);
  const overallSuccessRate = totalAttempts > 0 ? totalSuccesses / totalAttempts : 0;

  // Group by agent type
  const groupedMetrics = promptMetrics.reduce((acc, m) => {
    if (!acc[m.agent_type]) {
      acc[m.agent_type] = [];
    }
    acc[m.agent_type].push(m);
    return acc;
  }, {} as Record<string, PromptMetrics[]>);

  return (
    <>
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600" />
              <h3 className="font-semibold text-slate-800">Prompt Manager</h3>
            </div>
            <span className="text-xs text-slate-500">{promptMetrics.length} prompts</span>
          </div>

          {/* Overall Stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span className="text-slate-600">
                Overall: {Math.round(overallSuccessRate * 100)}% success
              </span>
            </div>
            <span className="text-slate-400">
              {totalSuccesses}/{totalAttempts} attempts
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {promptMetrics.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No prompt metrics available</p>
              <p className="text-xs mt-1">Metrics will appear as prompts are used</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedMetrics).map(([agentType, metrics]) => (
                <div key={agentType}>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    {agentType}
                  </h4>
                  <div className="space-y-2">
                    {metrics.map((m) => (
                      <PromptCard
                        key={`${m.agent_type}-${m.prompt_name}`}
                        metrics={m}
                        onEdit={() => setEditingPrompt(m)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Prompt Editor Modal */}
      {editingPrompt && (
        <PromptEditor
          promptMetrics={editingPrompt}
          onClose={() => setEditingPrompt(null)}
          onGetPrompt={onGetPrompt}
          onUpdatePrompt={onUpdatePrompt}
        />
      )}
    </>
  );
}
