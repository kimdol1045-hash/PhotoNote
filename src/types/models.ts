export interface ProjectRecord {
  id: string;
  name: string;
  color: string;       // hex accent, e.g. '#3182F6'
  createdAt: number;
}

export interface FileRecord {
  id: string;
  name: string;          // base name without extension
  ext: string;           // "jpg" | "png" | ...
  version: number;       // 0 = original
  parentId: string | null;
  rootId: string;
  projectId: string;
  folderId: string;
  isOriginal: boolean;
  blob: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
  size: number;
  createdAt: number;
}

export interface FolderRecord {
  id: string;
  name: string;
  projectId: string;
  parentFolderId: string | null;
  createdAt: number;
}

export const ROOT_FOLDER_ID = 'root';
export const DEFAULT_PROJECT_ID = 'default-project';

export const PROJECT_COLORS = [
  '#3182F6', // blue
  '#00C896', // green
  '#FF9500', // orange
  '#F04452', // red
  '#8B5CF6', // violet
  '#0EA5E9', // sky
  '#EC4899', // pink
  '#64748B', // slate
] as const;
