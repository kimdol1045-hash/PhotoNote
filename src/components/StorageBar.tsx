import { useEffect, useState } from 'react';
import './StorageBar.css';

interface Estimate {
  usage: number;
  quota: number;
}

export function StorageBar() {
  const [est, setEst] = useState<Estimate | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!navigator.storage?.estimate) return;
      try {
        const e = await navigator.storage.estimate();
        if (cancelled) return;
        setEst({ usage: e.usage ?? 0, quota: e.quota ?? 0 });
      } catch {
        // ignore
      }
    }
    void load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!est || est.quota === 0) return null;
  const pct = Math.min(1, est.usage / est.quota);
  const tone = pct > 0.85 ? 'danger' : pct > 0.6 ? 'warn' : 'ok';
  return (
    <div className="storage">
      <div className="storage__head">
        <span className="storage__label">저장 공간</span>
        <span className="storage__value">
          {fmt(est.usage)} / {fmt(est.quota)}
        </span>
      </div>
      <div className={`storage__bar storage__bar--${tone}`}>
        <div className="storage__bar-fill" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function fmt(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
