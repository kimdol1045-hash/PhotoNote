function pad(n: number, width = 2) {
  return n.toString().padStart(width, '0');
}

export function defaultPhotoName(d = new Date()): string {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `IMG_${y}${m}${day}_${hh}${mm}${ss}`;
}

export function formatRelative(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return '방금 전';
  if (diff < hour) return `${Math.floor(diff / minute)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`;
  const d = new Date(ts);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}
