import type { ReactNode } from 'react';
import './Header.css';

interface Props {
  title?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  variant?: 'default' | 'transparent';
}

export function Header({ title, leading, trailing, variant = 'default' }: Props) {
  return (
    <header className={`app-header app-header--${variant}`}>
      <div className="app-header__slot app-header__leading">{leading}</div>
      <div className="app-header__title">{title}</div>
      <div className="app-header__slot app-header__trailing">{trailing}</div>
    </header>
  );
}
