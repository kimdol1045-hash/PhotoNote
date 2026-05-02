import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import {
  createFolder,
  deleteFolder,
  renameFolder,
} from '@/services/folderService';
import { ROOT_FOLDER_ID } from '@/types/models';
import { useAppStore } from '@/stores/appStore';
import { folderPath } from '@/utils/navigation';
import { BottomSheet } from './ui/BottomSheet';
import { TextField } from './ui/TextField';
import { Button } from './ui/Button';
import { ActionSheet } from './ui/ActionSheet';
import { toast } from './ui/Toast';
import { IconPlus, IconEdit, IconTrash } from './ui/Icon';
import { FolderChip } from './FolderChip';
import './FolderTabs.css';

export function FolderTabs() {
  const navigate = useNavigate();
  const projectId = useAppStore((s) => s.currentProjectId);
  const folderId = useAppStore((s) => s.currentFolderId);
  const switchFolder = useAppStore((s) => s.switchFolder);

  function goFolder(id: string) {
    switchFolder(id);
    navigate(folderPath(id), { replace: true });
  }

  const folders =
    useLiveQuery(
      () =>
        db.folders
          .where('[projectId+createdAt]')
          .between([projectId, -Infinity], [projectId, Infinity])
          .toArray(),
      [projectId]
    ) ?? [];

  const counts = useLiveQuery(async () => {
    const map = new Map<string, number>();
    const all = await db.files
      .where('projectId')
      .equals(projectId)
      .toArray();
    for (const f of all) map.set(f.folderId, (map.get(f.folderId) ?? 0) + 1);
    return map;
  }, [projectId]);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [actionFor, setActionFor] = useState<string | null>(null);
  const [renameFor, setRenameFor] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteFor, setDeleteFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    const f = await createFolder(newName, projectId);
    setNewName('');
    setCreating(false);
    goFolder(f.id);
    toast(`'${f.name}' 폴더를 만들었어요`, 'success');
  }

  function startRename(id: string) {
    const f = folders.find((x) => x.id === id);
    if (!f) return;
    setRenameValue(f.name);
    setRenameFor(id);
  }

  async function commitRename() {
    if (!renameFor) return;
    const cleaned = renameValue.trim();
    if (!cleaned) return;
    await renameFolder(renameFor, cleaned);
    setRenameFor(null);
    toast('폴더 이름을 바꿨어요', 'success');
  }

  async function commitDelete(withFiles: boolean) {
    if (!deleteFor) return;
    setBusy(true);
    try {
      if (folderId === deleteFor) {
        const fallback = folders.find((f) => f.id !== deleteFor);
        if (fallback) goFolder(fallback.id);
      }
      await deleteFolder(deleteFor, { withFiles });
      setDeleteFor(null);
      toast(
        withFiles ? '폴더와 사진을 삭제했어요' : '폴더를 삭제하고 사진은 옮겼어요',
        'success'
      );
    } finally {
      setBusy(false);
    }
  }

  const deleteTarget = folders.find((f) => f.id === deleteFor);
  const deleteCount = deleteFor ? counts?.get(deleteFor) ?? 0 : 0;

  return (
    <>
      <div className="ftabs" role="tablist">
        <div className="ftabs__scroll">
          {folders.map((f) => (
            <FolderChip
              key={f.id}
              name={f.name}
              count={counts?.get(f.id) ?? 0}
              active={f.id === folderId}
              onTap={() => goFolder(f.id)}
              onLongPress={() => setActionFor(f.id)}
            />
          ))}
          <button
            type="button"
            className="ftabs__add tap"
            onClick={() => setCreating(true)}
            aria-label="새 폴더"
          >
            <IconPlus size={18} />
          </button>
        </div>
        {folders.length > 0 && (
          <button
            type="button"
            className="ftabs__manage tap"
            aria-label="현재 폴더 관리"
            onClick={() => folderId && setActionFor(folderId)}
          >
            <IconEdit size={18} />
          </button>
        )}
      </div>

      <BottomSheet
        open={creating}
        onClose={() => setCreating(false)}
        title="새 폴더"
      >
        <TextField
          autoFocus
          placeholder="폴더 이름"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleCreate();
          }}
          maxLength={30}
        />
        <div className="proj-create__actions" style={{ marginTop: 'var(--space-4)' }}>
          <Button variant="ghost" onClick={() => setCreating(false)}>
            취소
          </Button>
          <Button onClick={handleCreate} disabled={!newName.trim()}>
            만들기
          </Button>
        </div>
      </BottomSheet>

      <ActionSheet
        open={!!actionFor}
        title={folders.find((f) => f.id === actionFor)?.name}
        onClose={() => setActionFor(null)}
        items={[
          {
            key: 'rename',
            label: '이름 바꾸기',
            icon: <IconEdit size={20} />,
            onSelect: () => actionFor && startRename(actionFor),
          },
          {
            key: 'delete',
            label: '삭제',
            icon: <IconTrash size={20} />,
            destructive: true,
            disabled: actionFor === ROOT_FOLDER_ID || folders.length <= 1,
            onSelect: () => actionFor && setDeleteFor(actionFor),
          },
        ]}
      />

      <BottomSheet
        open={!!renameFor}
        onClose={() => setRenameFor(null)}
        title="폴더 이름 바꾸기"
      >
        <TextField
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commitRename();
          }}
          maxLength={30}
        />
        <div className="proj-create__actions" style={{ marginTop: 'var(--space-4)' }}>
          <Button variant="ghost" onClick={() => setRenameFor(null)}>
            취소
          </Button>
          <Button onClick={commitRename} disabled={!renameValue.trim()}>
            저장
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={!!deleteFor}
        onClose={() => !busy && setDeleteFor(null)}
        title={`'${deleteTarget?.name ?? ''}' 폴더를 삭제할까요?`}
        dismissOnBackdrop={!busy}
      >
        <p className="proj-delete__desc">
          {deleteCount > 0
            ? `이 폴더에 사진 ${deleteCount}장이 있어요. 어떻게 처리할까요?`
            : '폴더가 비어있어요. 바로 삭제할게요.'}
        </p>
        <div className="proj-delete__actions">
          {deleteCount > 0 && (
            <Button
              size="lg"
              variant="secondary"
              fullWidth
              onClick={() => void commitDelete(false)}
              disabled={busy}
            >
              사진은 다른 폴더로 옮기기
            </Button>
          )}
          <Button
            size="lg"
            variant={deleteCount > 0 ? 'danger' : 'primary'}
            fullWidth
            onClick={() => void commitDelete(true)}
            disabled={busy}
          >
            {deleteCount > 0 ? '폴더와 사진 모두 삭제' : '삭제'}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            fullWidth
            onClick={() => setDeleteFor(null)}
            disabled={busy}
          >
            취소
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
