import { useState } from 'react';
import { Send, Plus, X, AlertTriangle, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../store';

interface FailureSubmitPanelProps {
  onClose?: () => void;
}

export default function FailureSubmitPanel({ onClose }: FailureSubmitPanelProps) {
  const { addToast } = useStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    test_file: '',
    test_name: '',
    error_message: '',
    stack_trace: '',
    expected: '',
    actual: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.test_file || !formData.error_message) {
      addToast({
        type: 'error',
        title: 'Validation Error',
        message: 'Test file and error message are required.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/failures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          auto_execute: true,
        }),
      });

      const data = await response.json();

      if (data.error) {
        addToast({
          type: 'error',
          title: 'Submission Failed',
          message: data.error,
        });
      } else if (data.status === 'queued') {
        addToast({
          type: 'success',
          title: 'Failure Queued',
          message: `Failure ${data.failure_id} queued for pipeline "${data.workflow_id}"`,
          duration: 5000,
        });
        // Reset form
        setFormData({
          test_file: '',
          test_name: '',
          error_message: '',
          stack_trace: '',
          expected: '',
          actual: '',
        });
        onClose?.();
      } else if (data.status === 'created') {
        addToast({
          type: 'warning',
          title: 'Failure Created',
          message: data.message || 'No active pipeline. Set one to auto-execute.',
          duration: 5000,
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Submission Failed',
        message: 'Failed to submit failure. Check backend connection.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick submit with sample data
  const handleQuickSubmit = async () => {
    const sampleFailure = {
      test_file: 'src/test/java/com/example/AuthTest.java',
      test_name: 'testLoginWithValidCredentials',
      error_message: 'Expected status code 200 but got 401',
      stack_trace: `java.lang.AssertionError: Expected 200 but got 401
  at org.junit.Assert.fail(Assert.java:89)
  at com.example.AuthTest.testLoginWithValidCredentials(AuthTest.java:42)
  at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)`,
      expected: '200',
      actual: '401',
      auto_execute: true,
    };

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/failures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleFailure),
      });

      const data = await response.json();

      if (data.error) {
        addToast({
          type: 'error',
          title: 'Submission Failed',
          message: data.error,
        });
      } else {
        addToast({
          type: 'success',
          title: 'Test Failure Submitted',
          message: `Failure ${data.failure_id} created. Status: ${data.status}`,
          duration: 5000,
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Submission Failed',
        message: 'Failed to submit failure. Check backend connection.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-slate-600" />
          <h3 className="font-semibold text-slate-800">Submit Test Failure</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleQuickSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors disabled:opacity-50"
          >
            <Plus className="w-3 h-3" />
            Quick Test
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        {/* Test File */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Test File <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.test_file}
            onChange={(e) => setFormData({ ...formData, test_file: e.target.value })}
            placeholder="src/test/java/com/example/AuthTest.java"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Test Name */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Test Name
          </label>
          <input
            type="text"
            value={formData.test_name}
            onChange={(e) => setFormData({ ...formData, test_name: e.target.value })}
            placeholder="testLoginWithValidCredentials"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Error Message */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Error Message <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.error_message}
            onChange={(e) => setFormData({ ...formData, error_message: e.target.value })}
            placeholder="Expected 200 but got 401"
            rows={2}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Expected / Actual */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Expected
            </label>
            <input
              type="text"
              value={formData.expected}
              onChange={(e) => setFormData({ ...formData, expected: e.target.value })}
              placeholder="200"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Actual
            </label>
            <input
              type="text"
              value={formData.actual}
              onChange={(e) => setFormData({ ...formData, actual: e.target.value })}
              placeholder="401"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Stack Trace (collapsible) */}
        <details className="group">
          <summary className="text-xs font-medium text-slate-600 cursor-pointer hover:text-slate-800">
            Stack Trace (optional)
          </summary>
          <textarea
            value={formData.stack_trace}
            onChange={(e) => setFormData({ ...formData, stack_trace: e.target.value })}
            placeholder="java.lang.AssertionError: ..."
            rows={3}
            className="w-full mt-2 px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </details>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={clsx(
            'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors',
            isSubmitting
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Failure
            </>
          )}
        </button>
      </form>
    </div>
  );
}
