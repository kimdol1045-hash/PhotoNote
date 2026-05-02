import { db, ensureSeeded } from '@/db/schema';
import type { FolderRecord } from '@/types/models';
import { DEFAULT_PROJECT_ID, ROOT_FOLDER_ID } from '@/types/models';
import { uuid } from '@/utils/uuid';

export async function listFolders(projectId: string): Promise<FolderRecord[]> {
  await ensureSeeded();
  return await db.folders
    .where('[projectId+createdAt]')
    .between([projectId, -Infinity], [projectId, Infinity])
    .toArray();
}

export async function firstFolderInProject(projectId: string): Promise<FolderRecord | null> {
  const list = await listFolders(projectId);
  return list[0] ?? null;
}

export async function createFolder(
  name: string,
  projectId: string
): Promise<FolderRecord> {
  const trimmed = name.trim().slice(0, 30) || '새 폴더';
  const rec: FolderRecord = {
    id: uuid(),
    name: trimmed,
    projectId,
    parentFolderId: null,
    createdAt: Date.now(),
  };
  await db.folders.add(rec);
  return rec;
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const trimmed = name.trim().slice(0, 30);
  if (!trimmed) return;
  await db.folders.update(id, { name: trimmed });
}

interface DeleteFolderOpts {
  withFiles: boolean;
}

export async function deleteFolder(
  id: string,
  opts: DeleteFolderOpts
): Promise<void> {
  if (id === ROOT_FOLDER_ID) return;
  await db.transaction('rw', [db.folders, db.files], async () => {
    const folder = await db.folders.get(id);
    if (!folder) return;
    if (opts.withFiles) {
      await db.files.where('folderId').equals(id).delete();
    } else {
      // Move files into this project's default folder (or fallback to ROOT_FOLDER_ID).
      const fallback =
        (await db.folders
          .where('[projectId+createdAt]')
          .between([folder.projectId, -Infinity], [folder.projectId, Infinity])
          .filter((f) => f.id !== id)
          .first())?.id ?? ROOT_FOLDER_ID;
      await db.files.where('folderId').equals(id).modify({ folderId: fallback });
    }
    await db.folders.delete(id);
  });
}

/** Best-effort lookup that always returns *some* folder id for a project. */
export async function fallbackFolderForProject(projectId: string): Promise<string> {
  const f = await firstFolderInProject(projectId);
  if (f) return f.id;
  // No folders? Create a default one on the fly.
  const made = await createFolder('내 사진', projectId);
  return made.id;
}

export const ROOT_FOLDER = ROOT_FOLDER_ID;
export const DEFAULT_PROJECT = DEFAULT_PROJECT_ID;
