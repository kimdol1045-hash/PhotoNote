import { useObjectURL } from '@/hooks/useObjectURL';
import { IconCheck } from './ui/Icon';
import './PhotoThumb.css';

interface Props {
  blob: Blob;
  alt?: string;
  versionCount?: number;
  selectable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  onLongPress?: () => void;
}

export function PhotoThumb({
  blob,
  alt,
  versionCount,
  selectable,
  selected,
  onClick,
  onLongPress,
}: Props) {
  const url = useObjectURL(blob);

  const longPressHandlers = onLongPress
    ? (() => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        let triggered = false;
        return {
          onPointerDown: () => {
            triggered = false;
            timer = setTimeout(() => {
              triggered = true;
              onLongPress();
            }, 450);
          },
          onPointerUp: () => {
            if (timer) clearTimeout(timer);
            timer = null;
          },
          onPointerLeave: () => {
            if (timer) clearTimeout(timer);
            timer = null;
          },
          onClickCapture: (e: React.MouseEvent) => {
            if (triggered) e.stopPropagation();
          },
        };
      })()
    : {};

  return (
    <button
      type="button"
      className={`thumb tap ${selectable ? 'thumb--selectable' : ''} ${
        selected ? 'thumb--selected' : ''
      }`}
      onClick={onClick}
      {...longPressHandlers}
    >
      <div className="thumb__img-wrap">
        {url ? <img src={url} alt={alt ?? ''} className="thumb__img" /> : null}
      </div>
      {versionCount && versionCount > 1 ? (
        <span className="thumb__badge">+{versionCount - 1}</span>
      ) : null}
      {selectable && (
        <span className={`thumb__check ${selected ? 'is-on' : ''}`}>
          {selected && <IconCheck size={16} />}
        </span>
      )}
    </button>
  );
}
