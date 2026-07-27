import React from 'react';
import { GeographicCoverageType } from '../../domain/types/GeographicCoverageType';
import { geographicCoverageOptions } from '../../domain/types/GeographicCoverageType';

export interface GeographicCoverageTypeSelectProps {
  value: GeographicCoverageType | null;
  onChange: (value: GeographicCoverageType | null) => void;
  disabled?: boolean;
  error?: string;
  id?: string;
}

export function GeographicCoverageTypeSelect({
  value,
  onChange,
  disabled = false,
  error,
  id,
}: GeographicCoverageTypeSelectProps) {
  return (
    <div className="w-full">
      <select
        id={id}
        disabled={disabled}
        value={value || ''}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val ? (val as GeographicCoverageType) : null);
        }}
        className={`w-full h-10 px-3 py-2 text-sm bg-white border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 ${
          error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : 'border-slate-200'
        }`}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <option value="">Selecione o tipo de cobertura</option>
        {geographicCoverageOptions.map((opt: { value: GeographicCoverageType, label: string }) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-xs text-red-500" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
