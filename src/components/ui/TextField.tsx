import { forwardRef, type InputHTMLAttributes } from 'react';
import './TextField.css';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, hint, error, className = '', ...rest },
  ref
) {
  return (
    <label className={`tf ${error ? 'tf--error' : ''} ${className}`}>
      {label && <span className="tf__label">{label}</span>}
      <input ref={ref} className="tf__input" {...rest} />
      {(error || hint) && (
        <span className={`tf__msg ${error ? 'tf__msg--error' : ''}`}>{error || hint}</span>
      )}
    </label>
  );
});
