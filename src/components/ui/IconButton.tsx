import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './IconButton.css';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
  size?: 'md' | 'lg';
  tone?: 'default' | 'primary';
}

export function IconButton({
  label,
  children,
  size = 'md',
  tone = 'default',
  className = '',
  ...rest
}: Props) {
  return (
    <button
      type="button"
      aria-label={label}
      className={['icon-btn', `icon-btn--${size}`, `icon-btn--${tone}`, 'tap', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
