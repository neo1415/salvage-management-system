'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface ConfigParameter {
  key: string;
  label: string;
  description: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
}

interface ConfigFormProps {
  onSaveSuccess?: () => void;
  className?: string;
}

export function ConfigForm({ onSaveSuccess, className = '' }: ConfigFormProps) {
  const [config, setConfig] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [reason, setReason] = useState('');

  const parameters: ConfigParameter[] = [
    {
      key: 'deposit_rate',
      label: 'Deposit Rate',
      description: 'Percentage of bid amount to freeze as deposit',
      value: config.deposit_rate || 10,
      unit: '%',
      min: 1,
      max: 100,
      step: 1,
    },
    {
      key: 'minimum_deposit_floor',
      label: 'Minimum Deposit Floor',
      description: 'Minimum deposit amount regardless of bid',
      value: config.minimum_deposit_floor || 100000,
      unit: '₦',
      min: 1000,
      step: 1000,
    },
    {
      key: 'tier_1_limit',
      label: 'Tier 1 Bid Limit',
      description: 'Maximum bid amount for Tier 1 vendors',
      value: config.tier_1_limit || 500000,
      unit: '₦',
      min: 100000,
      step: 10000,
    },
    {
      key: 'minimum_bid_increment',
      label: 'Minimum Bid Increment',
      description: 'Minimum amount between consecutive bids',
      value: config.minimum_bid_increment || 20000,
      unit: '₦',
      min: 1000,
      step: 1000,
    },
    {
      key: 'document_validity_period',
      label: 'Document Validity Period',
      description: 'Time window for signing required documents',
      value: config.document_validity_period || 48,
      unit: 'hours',
      min: 1,
      max: 168,
      step: 1,
    },
    {
      key: 'max_grace_extensions',
      label: 'Maximum Grace Extensions',
      description: 'Maximum number of deadline extensions allowed',
      value: config.max_grace_extensions || 2,
      unit: 'extensions',
      min: 0,
      max: 10,
      step: 1,
    },
    {
      key: 'grace_extension_duration',
      label: 'Grace Extension Duration',
      description: 'Additional time granted per extension',
      value: config.grace_extension_duration || 24,
      unit: 'hours',
      min: 1,
      max: 72,
      step: 1,
    },
    {
      key: 'fallback_buffer_period',
      label: 'Fallback Buffer Period',
      description: 'Wait time before promoting next bidder',
      value: config.fallback_buffer_period || 24,
      unit: 'hours',
      min: 1,
      max: 72,
      step: 1,
    },
    {
      key: 'top_bidders_to_keep_frozen',
      label: 'Top Bidders to Keep Frozen',
      description: 'Number of highest bidders whose deposits remain frozen',
      value: config.top_bidders_to_keep_frozen || 3,
      unit: 'bidders',
      min: 1,
      max: 10,
      step: 1,
    },
    {
      key: 'forfeiture_percentage',
      label: 'Forfeiture Percentage',
      description: 'Percentage of deposit to forfeit on payment failure',
      value: config.forfeiture_percentage || 100,
      unit: '%',
      min: 0,
      max: 100,
      step: 5,
    },
    {
      key: 'payment_deadline_after_signing',
      label: 'Payment Deadline After Signing',
      description: 'Time window for payment after document signing',
      value: config.payment_deadline_after_signing || 72,
      unit: 'hours',
      min: 1,
      max: 168,
      step: 1,
    },
  ];

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (parameter: string, value: number) => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parameter,
          value,
          reason: reason.trim() || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setMessage({ type: 'success', text: `${parameter} updated successfully` });
        setReason('');
        if (onSaveSuccess) onSaveSuccess();
        
        // Clear success message after 3 seconds
        setTimeout(() => setMessage(null), 3000);
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.message || 'Failed to update configuration' });
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      setMessage({ type: 'error', text: 'Failed to update configuration' });
    } finally {
      setSaving(false);
    }
  };

  const validateValue = (param: ConfigParameter, value: number): string | null => {
    if (param.min !== undefined && value < param.min) {
      return `Minimum value is ${param.min}`;
    }
    if (param.max !== undefined && value > param.max) {
      return `Maximum value is ${param.max}`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#800020] rounded-full flex items-center justify-center">
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">System Configuration</h2>
            <p className="text-sm text-gray-600 mt-1">
              Configure business rules for the auction deposit system
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`mx-6 mt-6 p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <p className={`text-sm font-medium ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="p-6 space-y-6">
        {parameters.map((param) => {
          const currentValue = config[param.key] || param.value;
          const validationError = validateValue(param, currentValue);

          return (
            <div key={param.key} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-900 mb-1">
                    {param.label}
                  </label>
                  <p className="text-sm text-gray-600">{param.description}</p>
                  {param.min !== undefined || param.max !== undefined ? (
                    <p className="text-xs text-gray-500 mt-1">
                      Range: {param.min !== undefined ? `${param.min}` : '∞'} - {param.max !== undefined ? `${param.max}` : '∞'} {param.unit}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="number"
                      value={currentValue}
                      onChange={(e) => setConfig({ ...config, [param.key]: Number(e.target.value) })}
                      min={param.min}
                      max={param.max}
                      step={param.step}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent ${
                        validationError ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      {param.unit}
                    </span>
                  </div>
                  {validationError && (
                    <p className="text-xs text-red-600 mt-1">{validationError}</p>
                  )}
                </div>
                <button
                  onClick={() => handleSave(param.key, currentValue)}
                  disabled={saving || !!validationError || currentValue === param.value}
                  className="px-4 py-2 bg-[#800020] text-white font-medium rounded-lg hover:bg-[#600018] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          );
        })}

        {/* Optional Reason Field */}
        <div className="border-t border-gray-200 pt-6">
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Reason for Change (Optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Provide a reason for this configuration change..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800020] focus:border-transparent resize-none"
            rows={3}
          />
          <div className="flex items-start gap-2 mt-2">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600">
              Providing a reason helps maintain a clear audit trail of configuration changes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
