import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './FAB.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
}

export function FAB({ label, icon, className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      className={`fab tap ${className}`}
      aria-label={label}
      {...rest}
    >
      <span className="fab__icon">{icon}</span>
      <span className="fab__label">{label}</span>
    </button>
  );
}
