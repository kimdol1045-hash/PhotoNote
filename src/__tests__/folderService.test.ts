import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '@/db/schema';
import { DEFAULT_PROJECT_ID, ROOT_FOLDER_ID } from '@/types/models';
import {
  createFolder,
  deleteFolder,
  listFolders,
  renameFolder,
} from '@/services/folderService';
import { createOriginal } from '@/services/fileService';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

afterEach(async () => {
  await db.delete();
});

describe('listFolders', () => {
  it('returns the root folder for the default project', async () => {
    const list = await listFolders(DEFAULT_PROJECT_ID);
    expect(list.find((f) => f.id === ROOT_FOLDER_ID)).toBeTruthy();
  });

  it('isolates folders to a single project', async () => {
    const a = await createFolder('A', DEFAULT_PROJECT_ID);
    const list = await listFolders(DEFAULT_PROJECT_ID);
    expect(list.find((f) => f.id === a.id)).toBeTruthy();
    const otherList = await listFolders('non-existent-project');
    expect(otherList).toHaveLength(0);
  });
});

describe('createFolder', () => {
  it('creates a folder bound to the given project', async () => {
    const f = await createFolder('Trip', DEFAULT_PROJECT_ID);
    expect(f.name).toBe('Trip');
    expect(f.projectId).toBe(DEFAULT_PROJECT_ID);
    expect(f.parentFolderId).toBeNull();
  });
});

describe('renameFolder', () => {
  it('renames an existing folder', async () => {
    const f = await createFolder('Old', DEFAULT_PROJECT_ID);
    await renameFolder(f.id, 'New');
    const after = await db.folders.get(f.id);
    expect(after?.name).toBe('New');
  });

  it('ignores empty rename', async () => {
    const f = await createFolder('Keep', DEFAULT_PROJECT_ID);
    await renameFolder(f.id, '   ');
    const after = await db.folders.get(f.id);
    expect(after?.name).toBe('Keep');
  });
});

describe('deleteFolder', () => {
  it('moves files to a sibling folder when withFiles=false', async () => {
    const FAKE = new Blob(['x'], { type: 'image/jpeg' });
    const f = await createFolder('Bucket', DEFAULT_PROJECT_ID);
    const file = await createOriginal({
      blob: FAKE,
      requestedName: 'p',
      ext: 'jpg',
      folderId: f.id,
    });
    await deleteFolder(f.id, { withFiles: false });
    expect(await db.folders.get(f.id)).toBeUndefined();
    const moved = await db.files.get(file.id);
    // Falls back to the project's first remaining folder (root).
    expect(moved?.folderId).toBe(ROOT_FOLDER_ID);
  });

  it('deletes folder and its files when withFiles=true', async () => {
    const FAKE = new Blob(['x'], { type: 'image/jpeg' });
    const f = await createFolder('Bin', DEFAULT_PROJECT_ID);
    const file = await createOriginal({
      blob: FAKE,
      requestedName: 'q',
      ext: 'jpg',
      folderId: f.id,
    });
    await deleteFolder(f.id, { withFiles: true });
    expect(await db.folders.get(f.id)).toBeUndefined();
    expect(await db.files.get(file.id)).toBeUndefined();
  });

  it('refuses to delete the root folder', async () => {
    await deleteFolder(ROOT_FOLDER_ID, { withFiles: true });
    expect(await db.folders.get(ROOT_FOLDER_ID)).toBeTruthy();
  });
});
