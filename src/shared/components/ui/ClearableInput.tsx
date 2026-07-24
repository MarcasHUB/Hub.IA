import React from 'react';
import { Input, InputProps } from './Input';
import { cn } from '@/shared/utils/cn';

interface ClearableInputProps extends Omit<InputProps, 'onChange'> {
  value: string;
  onChange: (val: string) => void;
  onClear?: () => void;
}

export const ClearableInput = React.forwardRef<HTMLInputElement, ClearableInputProps>(
  ({ className, value, onChange, onClear, ...props }, ref) => {
    
    const handleClear = () => {
      onChange('');
      if (onClear) {
        onClear();
      }
    };

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(value ? "pr-14" : "", className)}
          {...props}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 bg-slate-100 hover:bg-slate-200 hover:text-slate-700 px-2 py-0.5 rounded transition-colors z-10"
          >
            Limpar
          </button>
        )}
      </div>
    );
  }
);
ClearableInput.displayName = 'ClearableInput';
