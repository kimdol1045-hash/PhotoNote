import { type ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import './ActionSheet.css';

export interface ActionItem {
  key: string;
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

interface Props {
  open: boolean;
  title?: string;
  items: ActionItem[];
  onClose: () => void;
}

export function ActionSheet({ open, title, items, onClose }: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <ul className="actions">
        {items.map((it) => (
          <li key={it.key}>
            <button
              type="button"
              className={`actions__item tap ${it.destructive ? 'is-destructive' : ''}`}
              disabled={it.disabled}
              onClick={() => {
                onClose();
                it.onSelect();
              }}
            >
              {it.icon && <span className="actions__icon">{it.icon}</span>}
              <span className="actions__label">{it.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
