import { create } from 'zustand';
import { useEffect } from 'react';
import './Toast.css';

interface ToastItem {
  id: number;
  message: string;
  tone: 'default' | 'success' | 'danger';
}

interface ToastState {
  items: ToastItem[];
  show: (message: string, tone?: ToastItem['tone']) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToast = create<ToastState>((set) => ({
  items: [],
  show: (message, tone = 'default') => {
    const id = nextId++;
    set((s) => ({ items: [...s.items, { id, message, tone }] }));
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, 2400);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export function toast(message: string, tone?: ToastItem['tone']) {
  useToast.getState().show(message, tone);
}

export function ToastViewport() {
  const items = useToast((s) => s.items);
  useEffect(() => {
    // ensure store reads on mount even with no items
  }, []);
  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {items.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
