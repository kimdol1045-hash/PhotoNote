import Dexie, { type Table } from 'dexie';
import type { FileRecord, FolderRecord, ProjectRecord } from '@/types/models';
import { DEFAULT_PROJECT_ID, PROJECT_COLORS, ROOT_FOLDER_ID } from '@/types/models';

class PhotoNoteDB extends Dexie {
  projects!: Table<ProjectRecord, string>;
  files!: Table<FileRecord, string>;
  folders!: Table<FolderRecord, string>;

  constructor() {
    super('photonote');

    // v1: original schema (no projects)
    this.version(1).stores({
      files: 'id, folderId, rootId, [folderId+createdAt], createdAt',
      folders: 'id, parentFolderId, createdAt',
    });

    // v2: introduce Project layer; backfill existing folders/files into a default project.
    this.version(2)
      .stores({
        projects: 'id, createdAt',
        files:
          'id, folderId, projectId, rootId, [folderId+createdAt], [projectId+createdAt], createdAt',
        folders:
          'id, projectId, parentFolderId, [projectId+createdAt], createdAt',
      })
      .upgrade(async (tx) => {
        await tx.table('projects').put({
          id: DEFAULT_PROJECT_ID,
          name: '기본 프로젝트',
          color: PROJECT_COLORS[0],
          createdAt: Date.now(),
        });
        await tx.table('folders').toCollection().modify((f) => {
          if (!f.projectId) f.projectId = DEFAULT_PROJECT_ID;
        });
        await tx.table('files').toCollection().modify((f) => {
          if (!f.projectId) f.projectId = DEFAULT_PROJECT_ID;
        });
      });
  }
}

export const db = new PhotoNoteDB();

export async function ensureSeeded() {
  // Seed default project + root folder. Idempotent — safe to call repeatedly.
  const project = await db.projects.get(DEFAULT_PROJECT_ID);
  if (!project) {
    await db.projects.add({
      id: DEFAULT_PROJECT_ID,
      name: '기본 프로젝트',
      color: PROJECT_COLORS[0],
      createdAt: Date.now(),
    });
  }
  const root = await db.folders.get(ROOT_FOLDER_ID);
  if (!root) {
    await db.folders.add({
      id: ROOT_FOLDER_ID,
      name: '내 사진',
      projectId: DEFAULT_PROJECT_ID,
      parentFolderId: null,
      createdAt: Date.now(),
    });
  }
}
