import { db, ensureSeeded } from '@/db/schema';
import type { ProjectRecord } from '@/types/models';
import { DEFAULT_PROJECT_ID, PROJECT_COLORS, ROOT_FOLDER_ID } from '@/types/models';
import { uuid } from '@/utils/uuid';

export async function listProjects(): Promise<ProjectRecord[]> {
  await ensureSeeded();
  return await db.projects.orderBy('createdAt').toArray();
}

export async function createProject(name: string, color?: string): Promise<ProjectRecord> {
  const trimmed = name.trim().slice(0, 40) || '새 프로젝트';
  const all = await db.projects.toArray();
  const fallbackColor = PROJECT_COLORS[all.length % PROJECT_COLORS.length];
  const rec: ProjectRecord = {
    id: uuid(),
    name: trimmed,
    color: color ?? fallbackColor,
    createdAt: Date.now(),
  };
  await db.transaction('rw', [db.projects, db.folders], async () => {
    await db.projects.add(rec);
    // Each new project starts with its own default folder.
    await db.folders.add({
      id: uuid(),
      name: '내 사진',
      projectId: rec.id,
      parentFolderId: null,
      createdAt: Date.now(),
    });
  });
  return rec;
}

export async function renameProject(id: string, name: string): Promise<void> {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return;
  await db.projects.update(id, { name: trimmed });
}

export async function recolorProject(id: string, color: string): Promise<void> {
  await db.projects.update(id, { color });
}

export async function deleteProject(id: string, opts: { cascade: boolean }): Promise<void> {
  if (id === DEFAULT_PROJECT_ID) {
    // Default project is permanent; just empty its contents if requested.
    if (opts.cascade) {
      await emptyProject(id);
    }
    return;
  }
  await db.transaction('rw', [db.projects, db.folders, db.files], async () => {
    if (opts.cascade) {
      await emptyProject(id);
      await db.folders.where('projectId').equals(id).delete();
    } else {
      // Move contents to default project root folder.
      await db.files
        .where('projectId')
        .equals(id)
        .modify({ projectId: DEFAULT_PROJECT_ID, folderId: ROOT_FOLDER_ID });
      await db.folders.where('projectId').equals(id).delete();
    }
    await db.projects.delete(id);
  });
}

async function emptyProject(id: string): Promise<void> {
  await db.files.where('projectId').equals(id).delete();
}

export async function projectFileCount(id: string): Promise<number> {
  return await db.files.where('projectId').equals(id).count();
}
