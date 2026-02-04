interface VariableBindingsPanelProps {
  variables: string[];
}

export default function VariableBindingsPanel({ variables }: VariableBindingsPanelProps) {
  if (variables.length === 0) return null;

  return (
    <div className="px-3 py-2 border-b">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
          Variables
        </span>
        <span className="text-[9px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
          auto-resolves
        </span>
      </div>
      <div className="space-y-2">
        {variables.map((varName) => {
          const isInputVar = varName === 'input';
          return (
            <div key={varName} className="flex items-center gap-2">
              <span className="text-xs font-mono text-indigo-600 min-w-[80px]">
                {`{{${varName}}}`}
              </span>
              {isInputVar ? (
                <span className="flex-1 text-[10px] px-1.5 py-1 rounded bg-blue-50 text-blue-600 border border-blue-200">
                  ← Workflow input
                </span>
              ) : (
                <span className="flex-1 text-[10px] px-1.5 py-1 rounded bg-green-50 text-green-600 border border-green-200">
                  ← Auto from upstream
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
