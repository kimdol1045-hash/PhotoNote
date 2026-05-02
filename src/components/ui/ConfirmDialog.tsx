import type { ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

interface Props {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  destructive,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <BottomSheet open={open} onClose={onCancel} title={title} dismissOnBackdrop={!busy}>
      {description && (
        <p
          style={{
            margin: 0,
            color: 'var(--color-text-sub)',
            fontSize: 'var(--font-15)',
            lineHeight: 'var(--line-relaxed)',
          }}
        >
          {description}
        </p>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-5)' }}>
        <Button variant="ghost" size="lg" fullWidth onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? 'danger' : 'primary'}
          size="lg"
          fullWidth
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? '처리 중…' : confirmLabel}
        </Button>
      </div>
    </BottomSheet>
  );
}
