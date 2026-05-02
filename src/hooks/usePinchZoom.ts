import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
} from 'react';

export interface ZoomTransform {
  scale: number;
  tx: number; // translate in viewport pixels (relative to container center)
  ty: number;
}

export interface UsePinchZoomOpts {
  minScale?: number;
  maxScale?: number;
  /** When false, single-pointer events skip setPointerCapture so callers
   *  that focus a text input on tap don't lose focus to the canvas. */
  capturePointer?: boolean | (() => boolean);
  onSinglePointerDown?: (e: RPointerEvent<HTMLElement>) => void;
  onSinglePointerMove?: (e: RPointerEvent<HTMLElement>) => void;
  onSinglePointerUp?: (e: RPointerEvent<HTMLElement>) => void;
}

interface PointerInfo {
  id: number;
  x: number;
  y: number;
}

export function usePinchZoom({
  minScale = 0.5,
  maxScale = 8,
  capturePointer = true,
  onSinglePointerDown,
  onSinglePointerMove,
  onSinglePointerUp,
}: UsePinchZoomOpts = {}) {
  const shouldCapture = () =>
    typeof capturePointer === 'function' ? capturePointer() : capturePointer;

  const [transform, setTransform] = useState<ZoomTransform>({
    scale: 1,
    tx: 0,
    ty: 0,
  });
  const pointersRef = useRef<Map<number, PointerInfo>>(new Map());
  const gestureRef = useRef<{
    startDist: number;
    startScale: number;
    startCenter: { x: number; y: number };
    startTransform: ZoomTransform;
  } | null>(null);

  const reset = useCallback(() => {
    setTransform({ scale: 1, tx: 0, ty: 0 });
  }, []);

  /**
   * Wheel handler attached natively (not via React's `onWheel` prop) so we
   * can register with `{ passive: false }` and call preventDefault. React
   * synthetic wheel listeners are passive by default in React 17+, which
   * silently ignores preventDefault and lets the page scroll while zooming.
   */
  const wheelTargetRef = useRef<HTMLElement | null>(null);
  const setWheelTarget = useCallback((el: HTMLElement | null) => {
    wheelTargetRef.current = el;
  }, []);

  useEffect(() => {
    const el = wheelTargetRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && Math.abs(e.deltaY) < 4) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - (rect.left + rect.width / 2);
      const cy = e.clientY - (rect.top + rect.height / 2);
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      // Functional update — avoids stale closure on `transform`.
      setTransform((prev) => {
        const next = Math.max(minScale, Math.min(maxScale, prev.scale * factor));
        const ratio = next / prev.scale;
        return {
          scale: next,
          tx: (prev.tx - cx) * ratio + cx,
          ty: (prev.ty - cy) * ratio + cy,
        };
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [minScale, maxScale]);

  /** Used by callers as event handlers on the zoomable container. */
  const handlers = {
    onPointerDown(e: RPointerEvent<HTMLElement>) {
      pointersRef.current.set(e.pointerId, {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
      });
      const ptrs = [...pointersRef.current.values()];
      if (ptrs.length >= 2 || shouldCapture()) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Some browsers throw if capture is requested on an unsupported target.
        }
      }
      if (ptrs.length === 1) {
        onSinglePointerDown?.(e);
      } else if (ptrs.length === 2) {
        onSinglePointerUp?.(e);
        const [a, b] = ptrs;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        gestureRef.current = {
          startDist: dist,
          startScale: transform.scale,
          startCenter: center,
          startTransform: transform,
        };
      }
    },

    onPointerMove(e: RPointerEvent<HTMLElement>) {
      const prev = pointersRef.current.get(e.pointerId);
      if (!prev) return;
      pointersRef.current.set(e.pointerId, {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
      });
      const ptrs = [...pointersRef.current.values()];
      if (ptrs.length === 1) {
        onSinglePointerMove?.(e);
      } else if (ptrs.length >= 2 && gestureRef.current) {
        const [a, b] = ptrs;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const g = gestureRef.current;
        const rawScale = (dist / g.startDist) * g.startScale;
        const scale = Math.max(minScale, Math.min(maxScale, rawScale));
        const dx = center.x - g.startCenter.x;
        const dy = center.y - g.startCenter.y;
        const ratio = scale / g.startScale;
        const tx = g.startTransform.tx * ratio + dx;
        const ty = g.startTransform.ty * ratio + dy;
        setTransform({ scale, tx, ty });
      }
    },

    onPointerUp(e: RPointerEvent<HTMLElement>) {
      pointersRef.current.delete(e.pointerId);
      const ptrs = [...pointersRef.current.values()];
      if (ptrs.length < 2) gestureRef.current = null;
      if (ptrs.length === 0) {
        onSinglePointerUp?.(e);
      }
    },

    onPointerCancel(e: RPointerEvent<HTMLElement>) {
      pointersRef.current.delete(e.pointerId);
      gestureRef.current = null;
      onSinglePointerUp?.(e);
    },
  };

  // Suppress browser-native zoom gestures (Safari) when the hook is mounted.
  useEffect(() => {
    const onGesture = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', onGesture);
    document.addEventListener('gesturechange', onGesture);
    document.addEventListener('gestureend', onGesture);
    return () => {
      document.removeEventListener('gesturestart', onGesture);
      document.removeEventListener('gesturechange', onGesture);
      document.removeEventListener('gestureend', onGesture);
    };
  }, []);

  const cssTransform = `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`;
  const isZoomed =
    transform.scale > 1.001 || transform.tx !== 0 || transform.ty !== 0;

  function setScale(scale: number) {
    const clamped = Math.max(minScale, Math.min(maxScale, scale));
    setTransform({ scale: clamped, tx: 0, ty: 0 });
  }

  return {
    transform,
    cssTransform,
    isZoomed,
    handlers,
    setWheelTarget,
    reset,
    setScale,
  };
}
