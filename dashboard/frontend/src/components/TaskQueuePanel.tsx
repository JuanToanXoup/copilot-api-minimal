import { useState } from 'react';
import { Inbox, Cog, CheckCircle, Filter } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';
import type { Task, TaskType } from '../types';
import {
  getTaskTypeConfig,
  getTaskPriorityConfig,
  formatTaskDuration,
} from '../utils/taskConfig';

type QueueType = 'inbound' | 'work' | 'result';

interface QueueConfig {
  key: QueueType;
  label: string;
  icon: typeof Inbox;
  color: string;
  bgColor: string;
  description: string;
}

const queueConfigs: QueueConfig[] = [
  {
    key: 'inbound',
    label: 'Inbound',
    icon: Inbox,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    description: 'Pending tasks',
  },
  {
    key: 'work',
    label: 'Work',
    icon: Cog,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    description: 'In progress',
  },
  {
    key: 'result',
    label: 'Result',
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    description: 'Completed',
  },
];

interface TaskCardProps {
  task: Task;
}

function TaskCard({ task }: TaskCardProps) {
  const typeConfig = getTaskTypeConfig(task.task_type);
  const priorityConfig = getTaskPriorityConfig(task.priority);
  const TypeIcon = typeConfig.icon;
  const PriorityIcon = priorityConfig.icon;

  return (
    <div
      className={clsx(
        'p-2 rounded-lg border bg-white transition-all hover:shadow-sm',
        task.priority === 'high' ? 'border-red-200' : 'border-slate-200'
      )}
    >
      {/* Task Type & Priority */}
      <div className="flex items-center justify-between mb-1.5">
        <span
          className={clsx(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
            typeConfig.bgColor,
            typeConfig.color
          )}
        >
          <TypeIcon className="w-3 h-3" />
          {typeConfig.shortLabel}
        </span>
        <span
          className={clsx(
            'inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium',
            priorityConfig.bgColor,
            priorityConfig.color
          )}
          title={`${priorityConfig.label} priority`}
        >
          <PriorityIcon className="w-2.5 h-2.5" />
        </span>
      </div>

      {/* Task ID & Failure ID */}
      <div className="text-[10px] text-slate-500 font-mono truncate">
        {task.id.slice(0, 8)}
      </div>
      <div className="text-[10px] text-slate-400 truncate">
        Failure: {task.failure_id.slice(0, 8)}
      </div>

      {/* Assigned Instance (if any) */}
      {task.assigned_instance && (
        <div className="mt-1.5 text-[10px] text-blue-600">
          Instance: {task.assigned_instance.slice(0, 8)}
        </div>
      )}

      {/* Duration */}
      <div className="mt-1.5 text-[10px] text-slate-400">
        {formatTaskDuration(task.created_at)}
      </div>
    </div>
  );
}

interface TaskQueuePanelProps {
  /** Optional: provide tasks directly instead of reading from store */
  tasks?: { inbound: Task[]; work: Task[]; result: Task[] };
}

export default function TaskQueuePanel({ tasks: tasksProp }: TaskQueuePanelProps = {}) {
  const storeTasks = useStore((s) => s.tasks);
  const tasks = tasksProp ?? storeTasks;
  const [filterType, setFilterType] = useState<TaskType | 'all'>('all');
  const [filterFailureId, setFilterFailureId] = useState('');

  // Filter function
  const filterTasks = (queueTasks: Task[]): Task[] => {
    return queueTasks.filter((task) => {
      if (filterType !== 'all' && task.task_type !== filterType) return false;
      if (filterFailureId && !task.failure_id.includes(filterFailureId)) return false;
      return true;
    });
  };

  const taskTypes: (TaskType | 'all')[] = [
    'all',
    'CLASSIFY',
    'INSPECT_PLAN',
    'INSPECT_ANALYZE',
    'FIX_GEN',
    'VALIDATE_PLAN',
    'VALIDATE_ANALYZE',
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-800">Task Queues</h3>
          <div className="flex items-center gap-2">
            <Filter className="w-3 h-3 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as TaskType | 'all')}
              className="text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {taskTypes.map((type) => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : type}
                </option>
              ))}
            </select>
          </div>
        </div>
        <input
          type="text"
          placeholder="Filter by failure ID..."
          value={filterFailureId}
          onChange={(e) => setFilterFailureId(e.target.value)}
          className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {/* Queue Columns */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-3 h-full divide-x divide-slate-200">
          {queueConfigs.map((queue) => {
            const Icon = queue.icon;
            const queueTasks = filterTasks(tasks[queue.key]);

            return (
              <div key={queue.key} className="flex flex-col min-h-0">
                {/* Queue Header */}
                <div
                  className={clsx(
                    'px-3 py-2 border-b border-slate-200',
                    queue.bgColor
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon className={clsx('w-3.5 h-3.5', queue.color)} />
                      <span className={clsx('text-xs font-medium', queue.color)}>
                        {queue.label}
                      </span>
                    </div>
                    <span
                      className={clsx(
                        'px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                        queue.bgColor,
                        queue.color
                      )}
                    >
                      {queueTasks.length}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {queue.description}
                  </div>
                </div>

                {/* Queue Tasks */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {queueTasks.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 text-xs">
                      No tasks
                    </div>
                  ) : (
                    queueTasks.map((task) => (
                      <TaskCard key={task.id} task={task} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
