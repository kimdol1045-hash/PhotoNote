import { useRef } from 'react';

interface Props {
  name: string;
  count: number;
  active: boolean;
  onTap: () => void;
  onLongPress: () => void;
}

/**
 * Folder chip with custom long-press detection.
 *
 * We can't rely on `oncontextmenu` because on many mobile browsers it fires
 * *alongside* the click event, causing the chip to switch and open the menu
 * at once. So we run our own pointerdown timer and skip the click if the
 * long-press already fired.
 *
 * Lives in its own file because React Refresh / HMR can break function
 * hoisting when two components share a module.
 */
export function FolderChip({ name, count, active, onTap, onLongPress }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const cancelTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`ftabs__chip tap ${active ? 'is-active' : ''}`}
      onPointerDown={() => {
        firedRef.current = false;
        cancelTimer();
        timerRef.current = setTimeout(() => {
          firedRef.current = true;
          onLongPress();
        }, 500);
      }}
      onPointerUp={cancelTimer}
      onPointerLeave={cancelTimer}
      onPointerCancel={cancelTimer}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (firedRef.current) return;
        onTap();
      }}
    >
      <span className="ftabs__chip-name">{name}</span>
      <span className="ftabs__chip-count">{count}</span>
    </button>
  );
}
