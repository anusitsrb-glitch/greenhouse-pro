import { InputHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Optional visible label shown above the input */
  label?: string;
  /** Optional helper text shown below the input */
  helperText?: string;
  /** Optional error text shown below the input */
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, helperText, id, required, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block mb-1 text-sm font-medium text-gray-700"
          >
            {label}
            {required ? <span className="text-danger"> *</span> : null}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-4 py-2 rounded-xl border transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
            'placeholder:text-gray-400',
            'disabled:bg-gray-100 disabled:cursor-not-allowed',
            error
              ? 'border-danger focus:ring-danger/50 focus:border-danger'
              : 'border-gray-300',
            className
          )}
          required={required}
          {...props}
        />

        {error ? (
          <p className="mt-1 text-sm text-danger">{error}</p>
        ) : helperText ? (
          <p className="mt-1 text-xs text-gray-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
export { Input };
