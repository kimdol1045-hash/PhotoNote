import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded } from '@/db/schema';
import { DEFAULT_PROJECT_ID, ROOT_FOLDER_ID } from '@/types/models';
import {
  createEditedVersion,
  createOriginal,
  deleteFile,
  groupByRoot,
  hasOriginalsWithChildren,
  listFilesInFolder,
  moveFiles,
  overwriteFile,
} from '@/services/fileService';

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

afterEach(async () => {
  await db.delete();
});

const FAKE_BLOB = new Blob(['x'], { type: 'image/jpeg' });

describe('createOriginal', () => {
  it('saves a v0 record into the chosen folder', async () => {
    const f = await createOriginal({
      blob: FAKE_BLOB,
      requestedName: 'photo',
      ext: 'jpg',
      folderId: ROOT_FOLDER_ID,
    });
    expect(f.version).toBe(0);
    expect(f.isOriginal).toBe(true);
    expect(f.folderId).toBe(ROOT_FOLDER_ID);
    expect(f.rootId).toBe(f.id);
    expect(f.parentId).toBeNull();
  });

  it('auto-suffixes when same name exists in same folder', async () => {
    const a = await createOriginal({
      blob: FAKE_BLOB,
      requestedName: 'shot',
      ext: 'jpg',
      folderId: ROOT_FOLDER_ID,
    });
    const b = await createOriginal({
      blob: FAKE_BLOB,
      requestedName: 'shot',
      ext: 'jpg',
      folderId: ROOT_FOLDER_ID,
    });
    expect(a.name).toBe('shot');
    expect(b.name).toBe('shot-1');
    expect(b.rootId).toBe(b.id);
    expect(b.rootId).not.toBe(a.rootId);
  });
});

describe('createEditedVersion', () => {
  it('increments version and shares rootId with the source', async () => {
    const orig = await createOriginal({
      blob: FAKE_BLOB,
      requestedName: 'doc',
      ext: 'jpg',
      folderId: ROOT_FOLDER_ID,
    });
    const v1 = await createEditedVersion(orig, FAKE_BLOB);
    const v2 = await createEditedVersion(orig, FAKE_BLOB);
    expect(v1.version).toBe(1);
    expect(v1.name).toBe('doc-1');
    expect(v1.parentId).toBe(orig.id);
    expect(v2.version).toBe(2);
    expect(v2.name).toBe('doc-2');
    expect(v1.rootId).toBe(orig.rootId);
    expect(v2.rootId).toBe(orig.rootId);
  });

  it('editing -1 still produces -3, not -2 (flat increment)', async () => {
    const orig = await createOriginal({
      blob: FAKE_BLOB,
      requestedName: 'flat',
      ext: 'jpg',
      folderId: ROOT_FOLDER_ID,
    });
    const v1 = await createEditedVersion(orig, FAKE_BLOB);
    await createEditedVersion(orig, FAKE_BLOB); // v2
    const v3 = await createEditedVersion(v1, FAKE_BLOB); // editing v1 → max+1 = v3
    expect(v3.version).toBe(3);
    expect(v3.name).toBe('flat-3');
    expect(v3.parentId).toBe(v1.id);
  });
});

describe('groupByRoot', () => {
  it('groups versions by rootId with the latest as representative', async () => {
    const orig = await createOriginal({
      blob: FAKE_BLOB,
      requestedName: 'g',
      ext: 'jpg',
      folderId: ROOT_FOLDER_ID,
    });
    const v1 = await createEditedVersion(orig, FAKE_BLOB);
    const files = await listFilesInFolder(ROOT_FOLDER_ID);
    const groups = groupByRoot(files);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(2);
    expect(groups[0].representative.id).toBe(v1.id);
  });
});

describe('deleteFile', () => {
  it('cascade removes the entire root group', async () => {
    const orig = await createOriginal({
      blob: FAKE_BLOB,
      requestedName: 'c',
      ext: 'jpg',
      folderId: ROOT_FOLDER_ID,
    });
    await createEditedVersion(orig, FAKE_BLOB);
    await createEditedVersion(orig, FAKE_BLOB);
    await deleteFile(orig.id, { cascade: true });
    expect(await db.files.count()).toBe(0);
  });

  it('detach promotes children to their own roots', async () => {
    const orig = await createOriginal({
      blob: FAKE_BLOB,
      requestedName: 'd',
      ext: 'jpg',
      folderId: ROOT_FOLDER_ID,
    });
    const v1 = await createEditedVersion(orig, FAKE_BLOB);
    await deleteFile(orig.id, { cascade: false });
    const survived = await db.files.get(v1.id);
    expect(survived).toBeTruthy();
    expect(survived?.rootId).toBe(survived?.id);
    expect(survived?.parentId).toBeNull();
    expect(survived?.isOriginal).toBe(true);
    expect(survived?.version).toBe(0);
  });
});

describe('moveFiles', () => {
  it('moves multiple files to a target folder', async () => {
    await db.folders.add({
      id: 'F2',
      name: 'Inbox',
      projectId: DEFAULT_PROJECT_ID,
      parentFolderId: null,
      createdAt: Date.now(),
    });
    const a = await createOriginal({
      blob: FAKE_BLOB,
      requestedName: 'a',
      ext: 'jpg',
      folderId: ROOT_FOLDER_ID,
    });
    const b = await createOriginal({
      blob: FAKE_BLOB,
      requestedName: 'b',
      ext: 'jpg',
      folderId: ROOT_FOLDER_ID,
    });
    await moveFiles([a.id, b.id], 'F2');
    expect((await db.files.get(a.id))?.folderId).toBe('F2');
    expect((await db.files.get(b.id))?.folderId).toBe('F2');
  });
});

describe('overwriteFile', () => {
  it('replaces blob/thumbnail/dims of an edited version in place', async () => {
    const orig = await createOriginal({
      blob: FAKE_BLOB,
      requestedName: 'o',
      ext: 'jpg',
      folderId: ROOT_FOLDER_ID,
    });
    const v1 = await createEditedVersion(orig, FAKE_BLOB);
    const newBlob = new Blob(['xy'], { type: 'image/jpeg' });
    const updated = await overwriteFile(v1, newBlob);
    expect(updated.id).toBe(v1.id);          // same row
    expect(updated.version).toBe(v1.version); // version unchanged
    expect(updated.name).toBe(v1.name);       // name unchanged
    expect(updated.rootId).toBe(v1.rootId);
    expect(updated.parentId).toBe(v1.parentId);
    expect(updated.createdAt).toBe(v1.createdAt); // sort position preserved
    expect(updated.size).toBe(newBlob.size);
  });

  it('throws when called on an original (immutability invariant)', async () => {
    const orig = await createOriginal({
      blob: FAKE_BLOB,
      requestedName: 'p',
      ext: 'jpg',
      folderId: ROOT_FOLDER_ID,
    });
    await expect(overwriteFile(orig, FAKE_BLOB)).rejects.toThrow(/cannot overwrite an original/);
  });

  it('does not change the version count of the root group', async () => {
    const orig = await createOriginal({
      blob: FAKE_BLOB,
      requestedName: 'q',
      ext: 'jpg',
      folderId: ROOT_FOLDER_ID,
    });
    const v1 = await createEditedVersion(orig, FAKE_BLOB);
    await createEditedVersion(orig, FAKE_BLOB); // v2
    const before = await db.files.where('rootId').equals(orig.rootId).count();
    await overwriteFile(v1, new Blob(['z'], { type: 'image/jpeg' }));
    const after = await db.files.where('rootId').equals(orig.rootId).count();
    expect(after).toBe(before); // overwrite, not insert
  });
});

describe('hasOriginalsWithChildren', () => {
  it('detects originals that have edited descendants', async () => {
    const standalone = await createOriginal({
      blob: FAKE_BLOB,
      requestedName: 's',
      ext: 'jpg',
      folderId: ROOT_FOLDER_ID,
    });
    const withChild = await createOriginal({
      blob: FAKE_BLOB,
      requestedName: 'w',
      ext: 'jpg',
      folderId: ROOT_FOLDER_ID,
    });
    await createEditedVersion(withChild, FAKE_BLOB);
    expect(await hasOriginalsWithChildren([standalone.id])).toBe(false);
    expect(await hasOriginalsWithChildren([withChild.id])).toBe(true);
    expect(await hasOriginalsWithChildren([standalone.id, withChild.id])).toBe(true);
  });
});
