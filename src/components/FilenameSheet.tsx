import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { useAppStore } from '@/stores/appStore';
import { defaultPhotoName } from '@/utils/date';
import { sanitizeName } from '@/utils/filename';
import { BottomSheet } from './ui/BottomSheet';
import { TextField } from './ui/TextField';
import { Button } from './ui/Button';
import { IconChevronDown, IconCheck, IconFolder } from './ui/Icon';
import './FilenameSheet.css';

interface Props {
  open: boolean;
  previewUrl: string | null;
  onCancel: () => void;
  onConfirm: (args: { name: string; folderId: string }) => void;
  saving?: boolean;
}

export function FilenameSheet({ open, previewUrl, onCancel, onConfirm, saving }: Props) {
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const currentFolderId = useAppStore((s) => s.currentFolderId);
  const folders =
    useLiveQuery(
      () =>
        db.folders
          .where('[projectId+createdAt]')
          .between([currentProjectId, -Infinity], [currentProjectId, Infinity])
          .toArray(),
      [currentProjectId]
    ) ?? [];
  const [name, setName] = useState('');
  const [folderId, setFolderId] = useState(currentFolderId);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultPhotoName());
      setFolderId(currentFolderId);
    }
  }, [open, currentFolderId]);

  const folder = folders.find((f) => f.id === folderId);
  const cleanName = sanitizeName(name);
  const canSave = !!cleanName && !saving;

  return (
    <>
      <BottomSheet
        open={open && !pickerOpen}
        onClose={onCancel}
        title="사진 이름 정하기"
        dismissOnBackdrop={!saving}
      >
        {previewUrl && (
          <div className="filename-sheet__preview">
            <img src={previewUrl} alt="" />
          </div>
        )}

        <TextField
          label="파일명"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
        />

        <button
          type="button"
          className="filename-sheet__folder tap"
          onClick={() => setPickerOpen(true)}
        >
          <span className="filename-sheet__folder-icon">
            <IconFolder size={18} />
          </span>
          <span className="filename-sheet__folder-label">저장 폴더</span>
          <span className="filename-sheet__folder-name">{folder?.name ?? '내 사진'}</span>
          <IconChevronDown size={18} />
        </button>

        <div className="filename-sheet__actions">
          <Button variant="ghost" size="lg" fullWidth onClick={onCancel} disabled={saving}>
            취소
          </Button>
          <Button
            size="lg"
            fullWidth
            onClick={() => onConfirm({ name: cleanName, folderId })}
            disabled={!canSave}
          >
            {saving ? '저장 중…' : '저장'}
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="저장 폴더 선택"
      >
        <ul className="filename-sheet__folder-list">
          {folders.map((f) => {
            const active = f.id === folderId;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  className={`filename-sheet__folder-item tap ${active ? 'is-active' : ''}`}
                  onClick={() => {
                    setFolderId(f.id);
                    setPickerOpen(false);
                  }}
                >
                  <IconFolder size={20} />
                  <span>{f.name}</span>
                  {active && (
                    <span className="filename-sheet__folder-check">
                      <IconCheck size={20} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}
