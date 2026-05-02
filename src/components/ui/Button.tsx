import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leading,
  trailing,
  className = '',
  children,
  ...rest
}: Props) {
  const cls = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    fullWidth ? 'btn--full' : '',
    'tap',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} {...rest}>
      {leading && <span className="btn__icon">{leading}</span>}
      <span className="btn__label">{children}</span>
      {trailing && <span className="btn__icon">{trailing}</span>}
    </button>
  );
}
