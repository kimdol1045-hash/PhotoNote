import type { NavigateFunction } from 'react-router-dom';
import { ROOT_FOLDER_ID } from '@/types/models';

export function folderPath(folderId: string) {
  return folderId === ROOT_FOLDER_ID ? '/' : `/folder/${folderId}`;
}

export function smartBack(navigate: NavigateFunction, fallback: string) {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  if (idx > 0) navigate(-1);
  else navigate(fallback, { replace: true });
}
