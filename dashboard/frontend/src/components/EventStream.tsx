import { useState } from 'react';
import { Radio, Pause, Play, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';
import type { OrchestratorEventType, OrchestratorEvent } from '../types';
import {
  getEventTypeConfig,
  formatEventTimestamp,
  formatEventPayload,
  eventFilterCategories,
  type EventFilterCategory,
} from '../utils/eventConfig';

interface EventStreamProps {
  /** Optional: provide events directly instead of reading from store */
  events?: OrchestratorEvent[];
  /** Optional: provide eventsPaused state */
  eventsPaused?: boolean;
  /** Optional: provide setEventsPaused function */
  onSetEventsPaused?: (paused: boolean) => void;
  /** Optional: provide clearEvents function */
  onClearEvents?: () => void;
}

export default function EventStream({
  events: eventsProp,
  eventsPaused: eventsPausedProp,
  onSetEventsPaused,
  onClearEvents,
}: EventStreamProps = {}) {
  const storeEvents = useStore((s) => s.events);
  const storeEventsPaused = useStore((s) => s.eventsPaused);
  const storeSetEventsPaused = useStore((s) => s.setEventsPaused);
  const storeClearEvents = useStore((s) => s.clearEvents);

  const events = eventsProp ?? storeEvents;
  const eventsPaused = eventsPausedProp !== undefined ? eventsPausedProp : storeEventsPaused;
  const setEventsPaused = onSetEventsPaused ?? storeSetEventsPaused;
  const clearEvents = onClearEvents ?? storeClearEvents;

  const [enabledFilters, setEnabledFilters] = useState<Set<EventFilterCategory>>(
    new Set(eventFilterCategories.map((c) => c.id))
  );

  // Toggle filter
  const toggleFilter = (categoryId: EventFilterCategory) => {
    setEnabledFilters((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Get enabled event types
  const enabledTypes = new Set<OrchestratorEventType>();
  eventFilterCategories.forEach((category) => {
    if (enabledFilters.has(category.id)) {
      category.types.forEach((type) => enabledTypes.add(type));
    }
  });

  // Filter events
  const filteredEvents = events.filter((event) => enabledTypes.has(event.type));

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio
              className={clsx(
                'w-4 h-4',
                eventsPaused ? 'text-slate-400' : 'text-red-500 animate-pulse'
              )}
            />
            <h3 className="font-semibold text-slate-800">Event Stream</h3>
            <span className="text-xs text-slate-500">
              ({filteredEvents.length}/{events.length})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setEventsPaused(!eventsPaused)}
              className={clsx(
                'p-1.5 rounded transition-colors',
                eventsPaused
                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
              title={eventsPaused ? 'Resume' : 'Pause'}
            >
              {eventsPaused ? (
                <Play className="w-3.5 h-3.5" />
              ) : (
                <Pause className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={clearEvents}
              className="p-1.5 rounded bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-600 transition-colors"
              title="Clear events"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Toggles */}
        <div className="flex flex-wrap gap-1 mt-2">
          {eventFilterCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => toggleFilter(category.id)}
              className={clsx(
                'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                enabledFilters.has(category.id)
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-400'
              )}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Radio className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No events yet</p>
            <p className="text-xs mt-1">Events will appear here in real-time</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredEvents.map((event) => {
              const config = getEventTypeConfig(event.type);
              const Icon = config.icon;

              return (
                <div
                  key={event.id}
                  className={clsx(
                    'px-4 py-2 hover:bg-slate-50 transition-colors',
                    config.bgColor
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={clsx(
                        'p-1 rounded',
                        config.bgColor,
                        config.borderColor,
                        'border'
                      )}
                    >
                      <Icon className={clsx('w-3 h-3', config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={clsx(
                            'text-xs font-medium',
                            config.color
                          )}
                        >
                          {config.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatEventTimestamp(event.timestamp)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-600 mt-0.5 truncate">
                        {formatEventPayload(event)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {eventsPaused && (
        <div className="px-4 py-2 border-t border-slate-200 bg-amber-50">
          <div className="flex items-center gap-2 text-xs text-amber-700">
            <Pause className="w-3 h-3" />
            <span>Stream paused - new events will be buffered</span>
          </div>
        </div>
      )}
    </div>
  );
}
