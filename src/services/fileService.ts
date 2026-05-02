import { db } from '@/db/schema';
import type { FileRecord } from '@/types/models';
import { uuid } from '@/utils/uuid';
import { makeThumbnail, normalizeOriginal } from '@/utils/image';
import { sanitizeName } from '@/utils/filename';

interface CreateOriginalArgs {
  blob: Blob;
  requestedName: string;
  ext: string;
  folderId: string;
}

/**
 * Save a freshly captured (or uploaded) photo as an original.
 * The new record's projectId is derived from the destination folder.
 */
export async function createOriginal({
  blob,
  requestedName,
  ext,
  folderId,
}: CreateOriginalArgs): Promise<FileRecord> {
  const folder = await db.folders.get(folderId);
  if (!folder) throw new Error(`folder ${folderId} not found`);
  const cleanName = sanitizeName(requestedName) || 'IMG';
  const normalized = await normalizeOriginal(blob);
  const thumb = await makeThumbnail(normalized.blob);

  return await db.transaction('rw', db.files, async () => {
    const finalName = await resolveOriginalName(folderId, cleanName);
    const id = uuid();
    const rec: FileRecord = {
      id,
      name: finalName,
      ext,
      version: 0,
      parentId: null,
      rootId: id,
      projectId: folder.projectId,
      folderId,
      isOriginal: true,
      blob: normalized.blob,
      thumbnail: thumb,
      width: normalized.width,
      height: normalized.height,
      size: normalized.blob.size,
      createdAt: Date.now(),
    };
    await db.files.add(rec);
    return rec;
  });
}

async function resolveOriginalName(folderId: string, baseName: string): Promise<string> {
  const sameFolder = await db.files.where('folderId').equals(folderId).toArray();
  const existing = new Set(sameFolder.map((f) => f.name));
  if (!existing.has(baseName)) return baseName;
  for (let i = 1; i < 9999; i++) {
    const candidate = `${baseName}-${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${baseName}-${Date.now()}`;
}

export async function createEditedVersion(
  sourceFile: FileRecord,
  editedBlob: Blob
): Promise<FileRecord> {
  const thumb = await makeThumbnail(editedBlob);
  const dims = await getBlobDims(editedBlob);

  return await db.transaction('rw', db.files, async () => {
    const siblings = await db.files.where('rootId').equals(sourceFile.rootId).toArray();
    const maxVersion = siblings.reduce((max, f) => Math.max(max, f.version), 0);
    const nextVersion = maxVersion + 1;
    const id = uuid();
    const baseName = stripVersionSuffix(sourceFile.name, sourceFile.version);
    const rec: FileRecord = {
      id,
      name: `${baseName}-${nextVersion}`,
      ext: sourceFile.ext,
      version: nextVersion,
      parentId: sourceFile.id,
      rootId: sourceFile.rootId,
      projectId: sourceFile.projectId,
      folderId: sourceFile.folderId,
      isOriginal: false,
      blob: editedBlob,
      thumbnail: thumb,
      width: dims.width,
      height: dims.height,
      size: editedBlob.size,
      createdAt: Date.now(),
    };
    await db.files.add(rec);
    return rec;
  });
}

async function getBlobDims(blob: Blob) {
  const bmp = await createImageBitmap(blob);
  const dims = { width: bmp.width, height: bmp.height };
  bmp.close?.();
  return dims;
}

/**
 * Replace the blob/thumbnail/dimensions of an existing edited version in
 * place. Originals are immutable by spec — calling this on `isOriginal: true`
 * throws so callers can fall back to `createEditedVersion`.
 *
 * Note: `createdAt` is intentionally preserved so the file keeps its sort
 * position; overwriting is "edit in place", not "make newer".
 */
export async function overwriteFile(
  file: FileRecord,
  newBlob: Blob
): Promise<FileRecord> {
  if (file.isOriginal) {
    throw new Error('cannot overwrite an original file');
  }
  const thumb = await makeThumbnail(newBlob);
  const dims = await getBlobDims(newBlob);
  await db.files.update(file.id, {
    blob: newBlob,
    thumbnail: thumb,
    width: dims.width,
    height: dims.height,
    size: newBlob.size,
  });
  const updated = await db.files.get(file.id);
  if (!updated) throw new Error(`file ${file.id} disappeared during overwrite`);
  return updated;
}

function stripVersionSuffix(name: string, version: number): string {
  if (version === 0) return name;
  return name.replace(/-\d+$/, '');
}

export async function listFilesInFolder(folderId: string): Promise<FileRecord[]> {
  return await db.files
    .where('[folderId+createdAt]')
    .between([folderId, -Infinity], [folderId, Infinity])
    .reverse()
    .toArray();
}

export async function listFilesInProject(projectId: string): Promise<FileRecord[]> {
  return await db.files
    .where('[projectId+createdAt]')
    .between([projectId, -Infinity], [projectId, Infinity])
    .reverse()
    .toArray();
}

export async function moveFile(fileId: string, toFolderId: string): Promise<void> {
  const folder = await db.folders.get(toFolderId);
  if (!folder) return;
  await db.files.update(fileId, {
    folderId: toFolderId,
    projectId: folder.projectId,
  });
}

export async function moveFiles(fileIds: string[], toFolderId: string): Promise<void> {
  const folder = await db.folders.get(toFolderId);
  if (!folder) return;
  await db.transaction('rw', db.files, async () => {
    for (const id of fileIds) {
      await db.files.update(id, {
        folderId: toFolderId,
        projectId: folder.projectId,
      });
    }
  });
}

export async function deleteFiles(
  ids: string[],
  opts: { cascade: boolean }
): Promise<void> {
  for (const id of ids) {
    await deleteFile(id, opts);
  }
}

export async function hasOriginalsWithChildren(ids: string[]): Promise<boolean> {
  const files = await db.files.where('id').anyOf(ids).toArray();
  for (const f of files) {
    if (!f.isOriginal) continue;
    const count = await db.files.where('rootId').equals(f.rootId).count();
    if (count > 1) return true;
  }
  return false;
}

interface DeleteOpts {
  cascade: boolean;
}

export async function deleteFile(id: string, opts: DeleteOpts): Promise<void> {
  await db.transaction('rw', db.files, async () => {
    const f = await db.files.get(id);
    if (!f) return;
    if (!f.isOriginal) {
      await db.files.delete(id);
      return;
    }
    if (opts.cascade) {
      await db.files.where('rootId').equals(f.rootId).delete();
      return;
    }
    const children = await db.files
      .where('rootId')
      .equals(f.rootId)
      .and((x) => x.id !== f.id)
      .toArray();
    for (const c of children) {
      await db.files.update(c.id, {
        rootId: c.id,
        parentId: null,
        isOriginal: true,
        version: 0,
      });
    }
    await db.files.delete(id);
  });
}

export interface VersionGroup {
  rootId: string;
  representative: FileRecord;
  count: number;
  versions: FileRecord[];
}

export function groupByRoot(files: FileRecord[]): VersionGroup[] {
  const map = new Map<string, FileRecord[]>();
  for (const f of files) {
    const arr = map.get(f.rootId);
    if (arr) arr.push(f);
    else map.set(f.rootId, [f]);
  }
  const groups: VersionGroup[] = [];
  for (const [rootId, arr] of map) {
    const sortedByVersion = [...arr].sort((a, b) => a.version - b.version);
    // Representative = newest by createdAt, with version as tiebreaker so
    // edits that happen in the same millisecond as their source still win.
    const sortedByCreated = [...arr].sort(
      (a, b) => b.createdAt - a.createdAt || b.version - a.version
    );
    groups.push({
      rootId,
      representative: sortedByCreated[0],
      count: arr.length,
      versions: sortedByVersion,
    });
  }
  groups.sort((a, b) => b.representative.createdAt - a.representative.createdAt);
  return groups;
}
