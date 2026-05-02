import { useEffect, useRef, type ReactNode } from 'react';
import './BottomSheet.css';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  dismissOnBackdrop?: boolean;
}

// Counter shared across all BottomSheet instances so nested/stacked sheets
// only release body locks when the *last* one closes.
let openCount = 0;

function lockBody() {
  openCount += 1;
  document.body.style.overflow = 'hidden';
  document.body.dataset.sheetOpen = 'true';
}

function unlockBody() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) {
    document.body.style.overflow = '';
    delete document.body.dataset.sheetOpen;
  }
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  dismissOnBackdrop = true,
}: Props) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    lockBody();
    return () => {
      window.removeEventListener('keydown', onKey);
      unlockBody();
    };
  }, [open]);

  // Hard guarantee: when not open, render nothing. No transitions, no DOM,
  // no possibility of the sheet showing through CSS or stale state.
  if (!open) return null;

  return (
    <div className="sheet sheet--open">
      <div
        className="sheet__backdrop"
        onClick={dismissOnBackdrop ? onClose : undefined}
      />
      <div
        className="sheet__panel"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__handle" aria-hidden />
        {title && <div className="sheet__title">{title}</div>}
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__footer">{footer}</div>}
      </div>
    </div>
  );
}
