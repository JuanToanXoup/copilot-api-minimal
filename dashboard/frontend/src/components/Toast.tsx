import { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import clsx from 'clsx';
import { useStore, type ToastItem } from '../store';

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: {
    container: 'bg-green-50 border-green-200',
    icon: 'text-green-500',
    title: 'text-green-800',
    message: 'text-green-700',
  },
  error: {
    container: 'bg-red-50 border-red-200',
    icon: 'text-red-500',
    title: 'text-red-800',
    message: 'text-red-700',
  },
  warning: {
    container: 'bg-amber-50 border-amber-200',
    icon: 'text-amber-500',
    title: 'text-amber-800',
    message: 'text-amber-700',
  },
  info: {
    container: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-500',
    title: 'text-blue-800',
    message: 'text-blue-700',
  },
};

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

function Toast({ toast, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const Icon = icons[toast.type];
  const style = styles[toast.type];

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => onDismiss(toast.id), 200);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  return (
    <div
      className={clsx(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg max-w-sm',
        'transform transition-all duration-200',
        isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0',
        style.container
      )}
    >
      <Icon className={clsx('w-5 h-5 flex-shrink-0 mt-0.5', style.icon)} />
      <div className="flex-1 min-w-0">
        <p className={clsx('font-medium text-sm', style.title)}>
          {toast.title}
        </p>
        {toast.message && (
          <p className={clsx('text-sm mt-1', style.message)}>
            {toast.message}
          </p>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 rounded hover:bg-black/5 transition-colors"
      >
        <X className="w-4 h-4 text-slate-400" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast } = useStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
}
