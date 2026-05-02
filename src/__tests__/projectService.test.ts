import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '@/db/schema';
import { DEFAULT_PROJECT_ID, ROOT_FOLDER_ID } from '@/types/models';
import {
  createProject,
  deleteProject,
  listProjects,
  renameProject,
} from '@/services/projectService';
import { createOriginal } from '@/services/fileService';
import { firstFolderInProject } from '@/services/folderService';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

afterEach(async () => {
  await db.delete();
});

const FAKE = new Blob(['x'], { type: 'image/jpeg' });

describe('listProjects', () => {
  it('always contains the default project', async () => {
    const list = await listProjects();
    expect(list.find((p) => p.id === DEFAULT_PROJECT_ID)).toBeTruthy();
  });
});

describe('createProject', () => {
  it('creates a project with its own default folder', async () => {
    const p = await createProject('GIS Survey 2024');
    expect(p.name).toBe('GIS Survey 2024');
    const f = await firstFolderInProject(p.id);
    expect(f).toBeTruthy();
    expect(f?.projectId).toBe(p.id);
  });
});

describe('renameProject', () => {
  it('renames an existing project', async () => {
    const p = await createProject('Old');
    await renameProject(p.id, 'New');
    expect((await db.projects.get(p.id))?.name).toBe('New');
  });
});

describe('deleteProject', () => {
  it('moves files to default project when cascade=false', async () => {
    const p = await createProject('Throwaway');
    const folder = await firstFolderInProject(p.id);
    expect(folder).toBeTruthy();
    const file = await createOriginal({
      blob: FAKE,
      requestedName: 'a',
      ext: 'jpg',
      folderId: folder!.id,
    });
    await deleteProject(p.id, { cascade: false });
    expect(await db.projects.get(p.id)).toBeUndefined();
    const moved = await db.files.get(file.id);
    expect(moved?.projectId).toBe(DEFAULT_PROJECT_ID);
    expect(moved?.folderId).toBe(ROOT_FOLDER_ID);
  });

  it('deletes files when cascade=true', async () => {
    const p = await createProject('Bin');
    const folder = await firstFolderInProject(p.id);
    const file = await createOriginal({
      blob: FAKE,
      requestedName: 'b',
      ext: 'jpg',
      folderId: folder!.id,
    });
    await deleteProject(p.id, { cascade: true });
    expect(await db.projects.get(p.id)).toBeUndefined();
    expect(await db.files.get(file.id)).toBeUndefined();
  });

  it('refuses to delete the default project', async () => {
    await deleteProject(DEFAULT_PROJECT_ID, { cascade: false });
    expect(await db.projects.get(DEFAULT_PROJECT_ID)).toBeTruthy();
  });
});

describe('cross-project file lifecycle', () => {
  it('createOriginal derives projectId from the folder it lands in', async () => {
    const p = await createProject('Shoot A');
    const folder = await firstFolderInProject(p.id);
    const file = await createOriginal({
      blob: FAKE,
      requestedName: 'shot',
      ext: 'jpg',
      folderId: folder!.id,
    });
    expect(file.projectId).toBe(p.id);
  });
});
