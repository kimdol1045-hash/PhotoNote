import { db } from '@/db/schema';
import type { FileRecord, FolderRecord } from '@/types/models';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function fileFullName(f: Pick<FileRecord, 'name' | 'ext'>): string {
  return `${f.name}.${f.ext}`;
}

export async function downloadOne(file: FileRecord) {
  downloadBlob(file.blob, fileFullName(file));
}

export interface ZipProgress {
  done: number;
  total: number;
}

export async function downloadFolderAsZip(
  folder: FolderRecord,
  onProgress?: (p: ZipProgress) => void
): Promise<void> {
  const files = await db.files.where('folderId').equals(folder.id).toArray();
  if (files.length === 0) return;
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Map<string, number>();
  let done = 0;
  for (const f of files) {
    const base = fileFullName(f);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    const name = n === 1 ? base : insertSuffix(base, ` (${n - 1})`);
    zip.file(name, f.blob);
    done += 1;
    onProgress?.({ done, total: files.length });
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const safe = sanitizeFsName(folder.name);
  downloadBlob(blob, `${safe}.zip`);
}

function insertSuffix(filename: string, suffix: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return filename + suffix;
  return filename.slice(0, dot) + suffix + filename.slice(dot);
}

function sanitizeFsName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'folder';
}
