import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import type { FolderRecord, ProjectRecord } from '@/types/models';
import { BottomSheet } from './ui/BottomSheet';
import { IconFolder } from './ui/Icon';
import './MoveToFolderSheet.css';

interface Props {
  open: boolean;
  excludeId?: string;
  currentProjectId?: string;
  onClose: () => void;
  onPick: (folderId: string) => void;
}

export function MoveToFolderSheet({
  open,
  excludeId,
  currentProjectId,
  onClose,
  onPick,
}: Props) {
  const folders =
    useLiveQuery(() => db.folders.orderBy('createdAt').toArray(), []) ?? [];
  const projects =
    useLiveQuery(() => db.projects.orderBy('createdAt').toArray(), []) ?? [];

  // Apply excludeId before grouping so empty projects don't render orphan
  // headers (e.g. moving the only file out of its only folder).
  const visibleFolders = folders.filter((f) => f.id !== excludeId);
  const grouped = groupFolders(visibleFolders, projects, currentProjectId);

  return (
    <BottomSheet open={open} onClose={onClose} title="옮길 폴더">
      <div className="movefs">
        {grouped.length === 0 ? (
          <p className="movefs__empty">옮길 수 있는 다른 폴더가 없어요.</p>
        ) : (
          grouped.map((group) => (
            <section key={group.project.id} className="movefs__group">
              <header className="movefs__group-head">
                <span
                  className="movefs__group-dot"
                  style={{ backgroundColor: group.project.color }}
                  aria-hidden
                />
                <span className="movefs__group-name">{group.project.name}</span>
                {group.isCurrent && <span className="movefs__group-tag">현재</span>}
              </header>
              <ul className="movefs__list">
                {group.folders.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      className="movefs__item tap"
                      onClick={() => onPick(f.id)}
                    >
                      <IconFolder size={18} />
                      <span>{f.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </BottomSheet>
  );
}

interface FolderGroup {
  project: ProjectRecord;
  folders: FolderRecord[];
  isCurrent: boolean;
}

function groupFolders(
  folders: FolderRecord[],
  projects: ProjectRecord[],
  currentProjectId?: string
): FolderGroup[] {
  const byProject = new Map<string, FolderRecord[]>();
  for (const f of folders) {
    const arr = byProject.get(f.projectId);
    if (arr) arr.push(f);
    else byProject.set(f.projectId, [f]);
  }
  const groups: FolderGroup[] = [];
  // Show current project first.
  for (const p of projects) {
    const list = byProject.get(p.id) ?? [];
    groups.push({ project: p, folders: list, isCurrent: p.id === currentProjectId });
  }
  groups.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));
  return groups.filter((g) => g.folders.length > 0);
}
