import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import {
  deleteFiles,
  groupByRoot,
  hasOriginalsWithChildren,
  moveFiles,
} from '@/services/fileService';
import { useAppStore } from '@/stores/appStore';
import { Header } from '@/components/ui/Header';
import { IconButton } from '@/components/ui/IconButton';
import { FAB } from '@/components/ui/FAB';
import {
  IconCamera,
  IconImage,
  IconClose,
  IconMore,
  IconMove,
  IconTrash,
  IconCheck,
  IconDownload,
  IconSettings,
} from '@/components/ui/Icon';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { ProjectPicker } from '@/components/ProjectPicker';
import { FolderTabs } from '@/components/FolderTabs';
import { PhotoThumb } from '@/components/PhotoThumb';
import { MoveToFolderSheet } from '@/components/MoveToFolderSheet';
import { SettingsSheet } from '@/components/SettingsSheet';
import { downloadFolderAsZip, downloadOne, fileFullName } from '@/services/downloadService';
import './Home.css';

export function Home() {
  const navigate = useNavigate();
  const projectId = useAppStore((s) => s.currentProjectId);
  const folderId = useAppStore((s) => s.currentFolderId);

  const files = useLiveQuery(
    () =>
      db.files
        .where('[folderId+createdAt]')
        .between([folderId, -Infinity], [folderId, Infinity])
        .reverse()
        .toArray(),
    [folderId]
  );

  const groups = useMemo(() => (files ? groupByRoot(files) : []), [files]);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteCascadeAsk, setDeleteCascadeAsk] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  function enterSelection() {
    setSelectionMode(true);
    setSelected(new Set());
  }

  function exitSelection() {
    setSelectionMode(false);
    setSelected(new Set());
  }

  function toggleSelect(rootId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(groups.map((g) => g.rootId)));
  }

  function expandSelectionToFileIds(): string[] {
    const ids: string[] = [];
    for (const g of groups) {
      if (selected.has(g.rootId)) {
        for (const v of g.versions) ids.push(v.id);
      }
    }
    return ids;
  }

  async function handleMove(target: string) {
    setMoveOpen(false);
    setBusy(true);
    try {
      const ids = expandSelectionToFileIds();
      await moveFiles(ids, target);
      toast(`${selected.size}개 항목을 옮겼어요`, 'success');
      exitSelection();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRequest() {
    const ids = expandSelectionToFileIds();
    const hasOrig = await hasOriginalsWithChildren(ids);
    if (hasOrig) setDeleteCascadeAsk(true);
    else setDeleteConfirm(true);
  }

  async function handleDelete(cascade: boolean) {
    setDeleteCascadeAsk(false);
    setDeleteConfirm(false);
    setBusy(true);
    try {
      const ids = expandSelectionToFileIds();
      await deleteFiles(ids, { cascade });
      toast('삭제했어요', 'success');
      exitSelection();
    } finally {
      setBusy(false);
    }
  }

  function handleThumbClick(rootId: string, photoId: string) {
    if (selectionMode) {
      toggleSelect(rootId);
    } else {
      navigate(`/photo/${photoId}`);
    }
  }

  async function handleDownloadFolder() {
    const folder = await db.folders.get(folderId);
    if (!folder) return;
    setBusy(true);
    toast('ZIP을 만드는 중…');
    try {
      await downloadFolderAsZip(folder);
      toast('다운로드를 시작했어요', 'success');
    } catch (e) {
      console.error(e);
      toast('다운로드에 실패했어요', 'danger');
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadSelection() {
    const ids = expandSelectionToFileIds();
    if (ids.length === 0) return;
    setBusy(true);
    try {
      if (ids.length === 1) {
        const f = await db.files.get(ids[0]);
        if (f) downloadOne(f);
        toast('다운로드를 시작했어요', 'success');
      } else {
        const files = await db.files.where('id').anyOf(ids).toArray();
        const { default: JSZip } = await import('jszip');
        const zip = new JSZip();
        const used = new Map<string, number>();
        for (const f of files) {
          const base = fileFullName(f);
          const n = (used.get(base) ?? 0) + 1;
          used.set(base, n);
          zip.file(n === 1 ? base : addSuffix(base, ` (${n - 1})`), f.blob);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `selection-${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        toast(`${files.length}개 항목 ZIP을 다운로드해요`, 'success');
      }
      exitSelection();
    } catch (e) {
      console.error(e);
      toast('다운로드에 실패했어요', 'danger');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header
        title={selectionMode ? `${selected.size}개 선택` : <ProjectPicker />}
        leading={
          selectionMode ? (
            <IconButton label="선택 취소" onClick={exitSelection}>
              <IconClose size={24} />
            </IconButton>
          ) : null
        }
        trailing={
          selectionMode ? (
            <IconButton label="전체 선택" onClick={selectAll}>
              <IconCheck size={22} />
            </IconButton>
          ) : (
            <IconButton label="더보기" onClick={() => setMoreOpen(true)}>
              <IconMore size={22} />
            </IconButton>
          )
        }
      />

      {!selectionMode && <FolderTabs />}

      <main className="home">
        {files === undefined ? (
          <SkeletonGrid />
        ) : groups.length === 0 ? (
          <EmptyState />
        ) : (
          <section className="home__grid">
            {groups.map((g) => (
              <PhotoThumb
                key={g.rootId}
                blob={g.representative.thumbnail}
                versionCount={g.count}
                alt={g.representative.name}
                selectable={selectionMode}
                selected={selected.has(g.rootId)}
                onClick={() => handleThumbClick(g.rootId, g.representative.id)}
                onLongPress={
                  selectionMode
                    ? undefined
                    : () => {
                        enterSelection();
                        setSelected(new Set([g.rootId]));
                      }
                }
              />
            ))}
          </section>
        )}
      </main>

      {!selectionMode && (
        <FAB
          label="촬영"
          icon={<IconCamera size={22} />}
          onClick={() => navigate('/camera')}
        />
      )}

      {selectionMode && selected.size > 0 && (
        <div className="home__action-bar">
          <button
            type="button"
            className="home__action tap"
            onClick={() => setMoveOpen(true)}
            disabled={busy}
          >
            <IconMove size={22} />
            <span>이동</span>
          </button>
          <button
            type="button"
            className="home__action tap"
            onClick={handleDownloadSelection}
            disabled={busy}
          >
            <IconDownload size={22} />
            <span>다운로드</span>
          </button>
          <button
            type="button"
            className="home__action home__action--danger tap"
            onClick={handleDeleteRequest}
            disabled={busy}
          >
            <IconTrash size={22} />
            <span>삭제</span>
          </button>
        </div>
      )}

      <ActionSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={[
          {
            key: 'select',
            label: '선택 모드',
            icon: <IconCheck size={20} />,
            onSelect: enterSelection,
            disabled: groups.length === 0,
          },
          {
            key: 'download-folder',
            label: '이 폴더 ZIP 다운로드',
            icon: <IconDownload size={20} />,
            disabled: groups.length === 0,
            onSelect: handleDownloadFolder,
          },
          {
            key: 'settings',
            label: '설정',
            icon: <IconSettings size={20} />,
            onSelect: () => setSettingsOpen(true),
          },
        ]}
      />

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <MoveToFolderSheet
        open={moveOpen}
        excludeId={folderId}
        currentProjectId={projectId}
        onClose={() => setMoveOpen(false)}
        onPick={(t) => void handleMove(t)}
      />

      <BottomSheet
        open={deleteCascadeAsk}
        onClose={() => !busy && setDeleteCascadeAsk(false)}
        title="버전이 있는 사진이 포함되어 있어요"
      >
        <p className="home__delete-desc">
          편집본까지 모두 삭제할까요? 원본만 두고 편집본을 남길 수도 있어요.
        </p>
        <div className="home__delete-actions">
          <Button
            size="lg"
            variant="secondary"
            fullWidth
            onClick={() => void handleDelete(false)}
            disabled={busy}
          >
            편집본은 남겨두기
          </Button>
          <Button
            size="lg"
            variant="danger"
            fullWidth
            onClick={() => void handleDelete(true)}
            disabled={busy}
          >
            모두 삭제
          </Button>
          <Button
            size="lg"
            variant="ghost"
            fullWidth
            onClick={() => setDeleteCascadeAsk(false)}
            disabled={busy}
          >
            취소
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={deleteConfirm}
        onClose={() => !busy && setDeleteConfirm(false)}
        title={`${selected.size}개 항목을 삭제할까요?`}
      >
        <p className="home__delete-desc">삭제하면 되돌릴 수 없어요.</p>
        <div className="home__delete-actions">
          <Button
            size="lg"
            variant="danger"
            fullWidth
            onClick={() => void handleDelete(true)}
            disabled={busy}
          >
            삭제
          </Button>
          <Button
            size="lg"
            variant="ghost"
            fullWidth
            onClick={() => setDeleteConfirm(false)}
            disabled={busy}
          >
            취소
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

function addSuffix(filename: string, suffix: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return filename + suffix;
  return filename.slice(0, dot) + suffix + filename.slice(dot);
}

function SkeletonGrid() {
  return (
    <section className="home__grid" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="home__skeleton" />
      ))}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="home__empty">
      <div className="home__empty-icon">
        <IconImage size={36} />
      </div>
      <p className="home__empty-title">아직 사진이 없어요</p>
      <p className="home__empty-sub">아래 촬영 버튼으로 첫 사진을 남겨보세요</p>
    </div>
  );
}
