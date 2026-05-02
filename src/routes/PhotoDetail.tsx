import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import type { FileRecord } from '@/types/models';
import { deleteFile } from '@/services/fileService';
import { downloadOne, fileFullName } from '@/services/downloadService';
import { Header } from '@/components/ui/Header';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { toast } from '@/components/ui/Toast';
import { MoveToFolderSheet } from '@/components/MoveToFolderSheet';
import { useObjectURL } from '@/hooks/useObjectURL';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { formatRelative } from '@/utils/date';
import {
  IconChevronLeft,
  IconMore,
  IconPen,
  IconDownload,
  IconMove,
  IconTrash,
  IconCheck,
} from '@/components/ui/Icon';
import { moveFile } from '@/services/fileService';
import { folderPath, smartBack } from '@/utils/navigation';
import './PhotoDetail.css';

export function PhotoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const file = useLiveQuery(() => (id ? db.files.get(id) : undefined), [id]);
  const versions =
    useLiveQuery(
      () =>
        file
          ? db.files.where('rootId').equals(file.rootId).sortBy('version')
          : Promise.resolve<FileRecord[]>([]),
      [file?.rootId]
    ) ?? [];

  const url = useObjectURL(file?.blob);
  const heroZoom = usePinchZoom({ minScale: 1, maxScale: 6 });
  const [moreOpen, setMoreOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const backFallback = file ? folderPath(file.folderId) : '/';
  const goBack = () => smartBack(navigate, backFallback);

  if (file === undefined) {
    return (
      <>
        <Header
          leading={
            <IconButton label="뒤로" onClick={goBack}>
              <IconChevronLeft />
            </IconButton>
          }
        />
        <main className="detail">
          <div className="detail__skeleton" />
        </main>
      </>
    );
  }

  if (!file) {
    return (
      <>
        <Header
          leading={
            <IconButton label="뒤로" onClick={goBack}>
              <IconChevronLeft />
            </IconButton>
          }
        />
        <main className="detail detail--missing">
          <p>해당 사진을 찾을 수 없어요</p>
          <Button onClick={() => navigate('/')}>홈으로</Button>
        </main>
      </>
    );
  }

  const hasChildren = versions.length > 1;
  const askCascade = file.isOriginal && hasChildren;

  async function handleDelete(cascade: boolean) {
    if (!file) return;
    setBusy(true);
    try {
      const fallback = folderPath(file.folderId);
      await deleteFile(file.id, { cascade });
      toast('삭제했어요', 'success');
      navigate(fallback, { replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(folderId: string) {
    if (!file) return;
    setMoveOpen(false);
    setBusy(true);
    try {
      await moveFile(file.id, folderId);
      toast('이동했어요', 'success');
    } finally {
      setBusy(false);
    }
  }

  function handleDownload() {
    if (!file) return;
    void downloadOne(file);
    toast('다운로드를 시작했어요', 'success');
  }

  return (
    <>
      <Header
        title={fileFullName(file)}
        leading={
          <IconButton label="뒤로" onClick={goBack}>
            <IconChevronLeft />
          </IconButton>
        }
        trailing={
          <IconButton label="더보기" onClick={() => setMoreOpen(true)}>
            <IconMore size={22} />
          </IconButton>
        }
      />

      <main className="detail">
        <div
          ref={heroZoom.setWheelTarget}
          className="detail__hero"
          onPointerDown={heroZoom.handlers.onPointerDown}
          onPointerMove={heroZoom.handlers.onPointerMove}
          onPointerUp={heroZoom.handlers.onPointerUp}
          onPointerCancel={heroZoom.handlers.onPointerCancel}
          onDoubleClick={() =>
            heroZoom.transform.scale > 1.001 ? heroZoom.reset() : heroZoom.setScale(2)
          }
        >
          {url && (
            <img
              src={url}
              alt={file.name}
              style={{ transform: heroZoom.cssTransform }}
              draggable={false}
            />
          )}
          {heroZoom.isZoomed && (
            <button
              type="button"
              className="detail__zoom-pill tap"
              onClick={heroZoom.reset}
            >
              {Math.round(heroZoom.transform.scale * 100)}% · 원래대로
            </button>
          )}
        </div>

        <div className="detail__meta">
          <div className="detail__meta-row">
            <span className="detail__meta-label">크기</span>
            <span className="detail__meta-value">
              {file.width} × {file.height}
            </span>
          </div>
          <div className="detail__meta-row">
            <span className="detail__meta-label">용량</span>
            <span className="detail__meta-value">{formatBytes(file.size)}</span>
          </div>
          <div className="detail__meta-row">
            <span className="detail__meta-label">저장</span>
            <span className="detail__meta-value">{formatRelative(file.createdAt)}</span>
          </div>
          <div className="detail__meta-row">
            <span className="detail__meta-label">버전</span>
            <span className="detail__meta-value">
              {file.isOriginal ? '원본' : `편집본 v${file.version}`}
              {hasChildren && ` · 그룹 ${versions.length}장`}
            </span>
          </div>
        </div>

        {hasChildren && (
          <section className="detail__versions">
            <h3 className="detail__versions-title">버전</h3>
            <ul className="detail__version-list">
              {versions.map((v) => (
                <VersionRow
                  key={v.id}
                  blob={v.thumbnail}
                  name={fileFullName(v)}
                  isOriginal={v.isOriginal}
                  isCurrent={v.id === file.id}
                  createdAt={v.createdAt}
                  onClick={() => navigate(`/photo/${v.id}`, { replace: true })}
                />
              ))}
            </ul>
          </section>
        )}
      </main>

      <div className="detail__bar">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          leading={<IconPen size={20} />}
          onClick={() => navigate(`/edit/${file.id}`)}
        >
          편집
        </Button>
      </div>

      <ActionSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={[
          {
            key: 'download',
            label: '다운로드',
            icon: <IconDownload size={20} />,
            onSelect: handleDownload,
          },
          {
            key: 'move',
            label: '폴더 이동',
            icon: <IconMove size={20} />,
            onSelect: () => setMoveOpen(true),
          },
          {
            key: 'delete',
            label: '삭제',
            icon: <IconTrash size={20} />,
            destructive: true,
            onSelect: () => setDeleteOpen(true),
          },
        ]}
      />

      <MoveToFolderSheet
        open={moveOpen}
        excludeId={file.folderId}
        currentProjectId={file.projectId}
        onClose={() => setMoveOpen(false)}
        onPick={(t) => void handleMove(t)}
      />

      <BottomSheet
        open={deleteOpen}
        onClose={() => !busy && setDeleteOpen(false)}
        title={askCascade ? '편집본까지 함께 삭제할까요?' : '이 사진을 삭제할까요?'}
        dismissOnBackdrop={!busy}
      >
        <p className="detail__delete-desc">
          {askCascade
            ? `이 원본에는 편집본 ${versions.length - 1}장이 있어요. 함께 삭제하거나 편집본을 남길 수 있어요.`
            : '삭제하면 되돌릴 수 없어요.'}
        </p>
        <div className="detail__delete-actions">
          {askCascade ? (
            <>
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
            </>
          ) : (
            <Button
              size="lg"
              variant="danger"
              fullWidth
              onClick={() => void handleDelete(true)}
              disabled={busy}
            >
              삭제
            </Button>
          )}
          <Button
            size="lg"
            variant="ghost"
            fullWidth
            onClick={() => setDeleteOpen(false)}
            disabled={busy}
          >
            취소
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

interface VersionRowProps {
  blob: Blob;
  name: string;
  isOriginal: boolean;
  isCurrent: boolean;
  createdAt: number;
  onClick: () => void;
}

function VersionRow({
  blob,
  name,
  isOriginal,
  isCurrent,
  createdAt,
  onClick,
}: VersionRowProps) {
  const url = useObjectURL(blob);
  return (
    <li>
      <button
        type="button"
        className={`version-row tap ${isCurrent ? 'is-current' : ''}`}
        onClick={onClick}
      >
        <div className="version-row__thumb">
          {url && <img src={url} alt="" />}
        </div>
        <div className="version-row__meta">
          <div className="version-row__name">
            {name}
            {isOriginal && <span className="version-row__badge">원본</span>}
          </div>
          <div className="version-row__time">{formatRelative(createdAt)}</div>
        </div>
        {isCurrent && (
          <span className="version-row__check">
            <IconCheck size={20} />
          </span>
        )}
      </button>
    </li>
  );
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}
