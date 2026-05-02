import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { DEFAULT_PROJECT_ID, PROJECT_COLORS } from '@/types/models';
import {
  createProject,
  deleteProject,
  recolorProject,
  renameProject,
} from '@/services/projectService';
import { useAppStore } from '@/stores/appStore';
import { folderPath } from '@/utils/navigation';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { TextField } from './ui/TextField';
import { ActionSheet } from './ui/ActionSheet';
import { toast } from './ui/Toast';
import {
  IconChevronDown,
  IconCheck,
  IconPlus,
  IconMore,
  IconEdit,
  IconTrash,
} from './ui/Icon';
import './ProjectPicker.css';

export function ProjectPicker() {
  const navigate = useNavigate();
  const currentProjectId = useAppStore((s) => s.currentProjectId);
  const switchProject = useAppStore((s) => s.switchProject);

  async function goProject(id: string) {
    await switchProject(id);
    const fallback = useAppStore.getState().currentFolderId;
    navigate(folderPath(fallback), { replace: true });
  }

  const projects =
    useLiveQuery(() => db.projects.orderBy('createdAt').toArray(), []) ?? [];
  const counts = useLiveQuery(async () => {
    const map = new Map<string, number>();
    const all = await db.files.toArray();
    for (const f of all) map.set(f.projectId, (map.get(f.projectId) ?? 0) + 1);
    return map;
  }, []);

  const current = useMemo(
    () => projects.find((p) => p.id === currentProjectId),
    [projects, currentProjectId]
  );

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(PROJECT_COLORS[0]);

  const [actionFor, setActionFor] = useState<string | null>(null);
  const [renameFor, setRenameFor] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [colorFor, setColorFor] = useState<string | null>(null);
  const [deleteFor, setDeleteFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    const p = await createProject(newName, newColor);
    setNewName('');
    setNewColor(PROJECT_COLORS[0]);
    setCreating(false);
    setOpen(false);
    await goProject(p.id);
    toast(`'${p.name}' 프로젝트를 만들었어요`, 'success');
  }

  function startRename(id: string) {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    setRenameValue(p.name);
    setRenameFor(id);
  }

  async function commitRename() {
    if (!renameFor) return;
    const cleaned = renameValue.trim();
    if (!cleaned) return;
    await renameProject(renameFor, cleaned);
    setRenameFor(null);
    toast('프로젝트 이름을 바꿨어요', 'success');
  }

  async function commitDelete(cascade: boolean) {
    if (!deleteFor) return;
    setBusy(true);
    try {
      const wasCurrent = currentProjectId === deleteFor;
      await deleteProject(deleteFor, { cascade });
      setDeleteFor(null);
      if (wasCurrent) await goProject(DEFAULT_PROJECT_ID);
      toast(cascade ? '프로젝트와 사진을 삭제했어요' : '프로젝트를 삭제했어요', 'success');
    } finally {
      setBusy(false);
    }
  }

  const deleteTarget = projects.find((p) => p.id === deleteFor);
  const deleteCount = deleteFor ? counts?.get(deleteFor) ?? 0 : 0;

  return (
    <>
      <button type="button" className="proj-picker tap" onClick={() => setOpen(true)}>
        {current && (
          <span
            className="proj-picker__dot"
            style={{ backgroundColor: current.color }}
            aria-hidden
          />
        )}
        <span className="proj-picker__name">{current?.name ?? '프로젝트'}</span>
        <IconChevronDown size={18} />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="프로젝트">
        <ul className="proj-list">
          {projects.map((p) => {
            const active = p.id === currentProjectId;
            const isDefault = p.id === DEFAULT_PROJECT_ID;
            return (
              <li key={p.id} className="proj-list__row">
                <button
                  type="button"
                  className={`proj-list__item tap ${active ? 'is-active' : ''}`}
                  onClick={async () => {
                    await goProject(p.id);
                    setOpen(false);
                  }}
                >
                  <span
                    className="proj-list__dot"
                    style={{ backgroundColor: p.color }}
                    aria-hidden
                  />
                  <span className="proj-list__label">
                    <span className="proj-list__name">{p.name}</span>
                    <span className="proj-list__sub">
                      사진 {counts?.get(p.id) ?? 0}장
                      {isDefault && ' · 기본'}
                    </span>
                  </span>
                  {active && (
                    <span className="proj-list__check">
                      <IconCheck size={20} />
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="proj-list__more tap"
                  aria-label={`${p.name} 메뉴`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActionFor(p.id);
                  }}
                >
                  <IconMore size={20} />
                </button>
              </li>
            );
          })}
        </ul>

        {creating ? (
          <div className="proj-create">
            <TextField
              autoFocus
              placeholder="프로젝트 이름"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate();
              }}
              maxLength={40}
            />
            <ColorPalette value={newColor} onChange={setNewColor} />
            <div className="proj-create__actions">
              <Button
                variant="ghost"
                onClick={() => {
                  setCreating(false);
                  setNewName('');
                }}
              >
                취소
              </Button>
              <Button onClick={handleCreate} disabled={!newName.trim()}>
                만들기
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            fullWidth
            leading={<IconPlus size={20} />}
            onClick={() => setCreating(true)}
            className="proj-create__btn"
          >
            새 프로젝트
          </Button>
        )}
      </BottomSheet>

      <ActionSheet
        open={!!actionFor}
        title={projects.find((p) => p.id === actionFor)?.name}
        onClose={() => setActionFor(null)}
        items={[
          {
            key: 'rename',
            label: '이름 바꾸기',
            icon: <IconEdit size={20} />,
            onSelect: () => actionFor && startRename(actionFor),
          },
          {
            key: 'color',
            label: '색상 바꾸기',
            icon: <span className="action-color-dot" />,
            onSelect: () => actionFor && setColorFor(actionFor),
          },
          {
            key: 'delete',
            label: '삭제',
            icon: <IconTrash size={20} />,
            destructive: true,
            disabled: actionFor === DEFAULT_PROJECT_ID,
            onSelect: () => actionFor && setDeleteFor(actionFor),
          },
        ]}
      />

      <BottomSheet
        open={!!renameFor}
        onClose={() => setRenameFor(null)}
        title="프로젝트 이름 바꾸기"
      >
        <TextField
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commitRename();
          }}
          maxLength={40}
        />
        <div
          className="proj-create__actions"
          style={{ marginTop: 'var(--space-4)' }}
        >
          <Button variant="ghost" onClick={() => setRenameFor(null)}>
            취소
          </Button>
          <Button onClick={commitRename} disabled={!renameValue.trim()}>
            저장
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={!!colorFor}
        onClose={() => setColorFor(null)}
        title="프로젝트 색상"
      >
        <ColorPalette
          value={projects.find((p) => p.id === colorFor)?.color ?? PROJECT_COLORS[0]}
          onChange={async (c) => {
            if (colorFor) await recolorProject(colorFor, c);
            setColorFor(null);
            toast('색상을 바꿨어요', 'success');
          }}
        />
      </BottomSheet>

      <BottomSheet
        open={!!deleteFor}
        onClose={() => !busy && setDeleteFor(null)}
        title={`'${deleteTarget?.name ?? ''}' 프로젝트를 삭제할까요?`}
        dismissOnBackdrop={!busy}
      >
        <p className="proj-delete__desc">
          {deleteCount > 0
            ? `이 프로젝트에 사진 ${deleteCount}장이 있어요. 어떻게 처리할까요?`
            : '폴더와 함께 깨끗하게 삭제할게요.'}
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
              사진은 기본 프로젝트로 옮기기
            </Button>
          )}
          <Button
            size="lg"
            variant={deleteCount > 0 ? 'danger' : 'primary'}
            fullWidth
            onClick={() => void commitDelete(true)}
            disabled={busy}
          >
            {deleteCount > 0 ? '프로젝트와 사진 모두 삭제' : '삭제'}
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

function ColorPalette({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="proj-palette">
      {PROJECT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`proj-palette__swatch ${value === c ? 'is-active' : ''}`}
          style={{ backgroundColor: c }}
          aria-label={`색상 ${c}`}
          onClick={() => onChange(c)}
        >
          {value === c && <IconCheck size={18} />}
        </button>
      ))}
    </div>
  );
}
