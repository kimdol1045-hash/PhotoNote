import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '@/db/schema';
import type { FileRecord } from '@/types/models';
import {
  createEditedVersion,
  createOriginal,
  overwriteFile,
} from '@/services/fileService';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { TextField } from '@/components/ui/TextField';
import { toast } from '@/components/ui/Toast';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import {
  IconChevronLeft,
  IconPen,
  IconEraser,
  IconText,
  IconUndo,
  IconRedo,
  IconSave,
} from '@/components/ui/Icon';
import { sanitizeName } from '@/utils/filename';
import './Editor.css';

interface Point {
  x: number;
  y: number;
}

interface StrokeItem {
  type: 'stroke';
  color: string;
  size: number;
  erase: boolean;
  points: Point[];
}

interface TextItem {
  type: 'text';
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
}

type EditItem = StrokeItem | TextItem;
type Tool = 'pen' | 'erase' | 'text';

const COLORS = [
  { key: 'black', hex: '#191F28' },
  { key: 'red', hex: '#F04452' },
  { key: 'blue', hex: '#3182F6' },
  { key: 'yellow', hex: '#FFB400' },
] as const;

const STROKE_RATIOS = [0.005, 0.012, 0.022] as const;
const TEXT_RATIOS = [0.025, 0.04, 0.06] as const;

type EditorDialog = null | 'save' | 'saveAs' | 'exit';

export function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [source, setSource] = useState<FileRecord | null | undefined>(undefined);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef<HTMLCanvasElement | null>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [colorIdx, setColorIdx] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(1);

  const [items, setItems] = useState<EditItem[]>([]);
  const [redoStack, setRedoStack] = useState<EditItem[]>([]);
  const drawingRef = useRef<StrokeItem | null>(null);

  const [textDraft, setTextDraft] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');

  const [dialog, setDialog] = useState<EditorDialog>(null);
  const [saving, setSaving] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');

  const zoom = usePinchZoom({
    minScale: 1,
    maxScale: 8,
    // Skip pointer capture in text mode so the freshly-mounted <input>
    // can receive focus from the same tap.
    capturePointer: () => tool !== 'text',
    onSinglePointerDown: (e) => pointerDown(e as RPointerEvent<HTMLCanvasElement>),
    onSinglePointerMove: (e) => pointerMove(e as RPointerEvent<HTMLCanvasElement>),
    onSinglePointerUp: () => pointerUp(),
  });

  // Load source file
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      const f = await db.files.get(id);
      if (cancelled) return;
      setSource(f ?? null);
      if (!f) return;
      const bmp = await createImageBitmap(f.blob);
      if (cancelled) {
        bmp.close?.();
        return;
      }
      setBitmap(bmp);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const bg = bgRef.current;
    const draw = drawRef.current;
    if (!bitmap || !bg || !draw) return;
    bg.width = bitmap.width;
    bg.height = bitmap.height;
    draw.width = bitmap.width;
    draw.height = bitmap.height;
    const bctx = bg.getContext('2d');
    if (bctx) bctx.drawImage(bitmap, 0, 0);
    redrawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bitmap]);

  useEffect(() => {
    redrawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function redrawAll() {
    const c = drawRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const it of items) drawItem(ctx, it);
    if (drawingRef.current) drawStroke(ctx, drawingRef.current);
  }

  function getCanvasPoint(e: RPointerEvent<HTMLCanvasElement>): Point {
    const c = drawRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  }

  function pointerDown(e: RPointerEvent<HTMLCanvasElement>) {
    if (!bitmap || !drawRef.current) return;

    if (tool === 'text') {
      // If a draft input is already open, commit it before starting a new one.
      if (textDraft) commitText();
      setTextDraft(getCanvasPoint(e));
      setTextValue('');
      return;
    }

    const longSide = Math.max(bitmap.width, bitmap.height);
    const stroke: StrokeItem = {
      type: 'stroke',
      color: COLORS[colorIdx].hex,
      size: Math.max(2, longSide * STROKE_RATIOS[sizeIdx]),
      erase: tool === 'erase',
      points: [getCanvasPoint(e)],
    };
    drawingRef.current = stroke;
    setRedoStack([]);
  }

  function pointerMove(e: RPointerEvent<HTMLCanvasElement>) {
    const cur = drawingRef.current;
    if (!cur) return;
    cur.points.push(getCanvasPoint(e));
    const ctx = drawRef.current?.getContext('2d');
    if (!ctx) return;
    drawSegment(ctx, cur);
  }

  function pointerUp() {
    const cur = drawingRef.current;
    if (!cur) return;
    drawingRef.current = null;
    if (cur.points.length < 2) {
      cur.points.push({ x: cur.points[0].x + 0.01, y: cur.points[0].y + 0.01 });
    }
    setItems((prev) => [...prev, cur]);
  }

  function commitText() {
    if (!textDraft || !bitmap) {
      setTextDraft(null);
      setTextValue('');
      return;
    }
    const trimmed = textValue.trim();
    if (!trimmed) {
      setTextDraft(null);
      setTextValue('');
      return;
    }
    const longSide = Math.max(bitmap.width, bitmap.height);
    const item: TextItem = {
      type: 'text',
      x: textDraft.x,
      y: textDraft.y,
      text: trimmed,
      color: COLORS[colorIdx].hex,
      size: longSide * TEXT_RATIOS[sizeIdx],
    };
    setItems((prev) => [...prev, item]);
    setRedoStack([]);
    setTextDraft(null);
    setTextValue('');
  }

  function cancelText() {
    setTextDraft(null);
    setTextValue('');
  }

  function selectTool(next: Tool) {
    if (next !== 'text' && textDraft) commitText();
    setTool(next);
  }

  function handleUndo() {
    if (textDraft) {
      cancelText();
      return;
    }
    setItems((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [...r, last]);
      return prev.slice(0, -1);
    });
  }

  function handleRedo() {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setItems((s) => [...s, last]);
      return prev.slice(0, -1);
    });
  }

  function flatten(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const bg = bgRef.current;
      const draw = drawRef.current;
      if (!bg || !draw) return resolve(null);
      const merged = document.createElement('canvas');
      merged.width = bg.width;
      merged.height = bg.height;
      const ctx = merged.getContext('2d');
      if (!ctx) return resolve(null);
      ctx.drawImage(bg, 0, 0);
      ctx.drawImage(draw, 0, 0);
      merged.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
    });
  }

  async function doOverwrite(closeAfter = false) {
    if (!source || source.isOriginal) return;
    setSaving(true);
    try {
      const blob = await flatten();
      if (!blob) throw new Error('flatten failed');
      const updated = await overwriteFile(source, blob);
      toast(`'${updated.name}'에 저장했어요`, 'success');
      setDialog(null);
      if (closeAfter) navigate(-1);
      else navigate(`/photo/${updated.id}`);
    } catch (e) {
      console.error(e);
      toast('저장에 실패했어요', 'danger');
      setSaving(false);
    }
  }

  async function doNewVersion(closeAfter = false) {
    if (!source) return;
    setSaving(true);
    try {
      const blob = await flatten();
      if (!blob) throw new Error('flatten failed');
      const next = await createEditedVersion(source, blob);
      toast(`v${next.version}으로 저장했어요`, 'success');
      setDialog(null);
      if (closeAfter) navigate(-1);
      else navigate(`/photo/${next.id}`);
    } catch (e) {
      console.error(e);
      toast('저장에 실패했어요', 'danger');
      setSaving(false);
    }
  }

  async function doSaveAs() {
    if (!source) return;
    const cleaned = sanitizeName(saveAsName);
    if (!cleaned) return;
    setSaving(true);
    try {
      const blob = await flatten();
      if (!blob) throw new Error('flatten failed');
      const next = await createOriginal({
        blob,
        requestedName: cleaned,
        ext: 'jpg',
        folderId: source.folderId,
      });
      toast(`'${next.name}'으로 저장했어요`, 'success');
      setDialog(null);
      navigate(`/photo/${next.id}`);
    } catch (e) {
      console.error(e);
      toast('저장에 실패했어요', 'danger');
      setSaving(false);
    }
  }

  /** Default save action: overwrite for edited versions, new version for originals. */
  function doDefaultSave(closeAfter = false) {
    if (source && !source.isOriginal) return doOverwrite(closeAfter);
    return doNewVersion(closeAfter);
  }

  function handleSaveClick() {
    if (!hasEdits || saving) return;
    if (textDraft) commitText();
    setDialog('save');
  }

  function handleBackClick() {
    if (saving) return;
    if (textDraft) cancelText();
    if (hasEdits) setDialog('exit');
    else navigate(-1);
  }

  if (source === undefined) {
    return (
      <div className="editor editor--loading">
        <div className="editor__spinner" />
      </div>
    );
  }

  if (!source) {
    return (
      <div className="editor editor--missing">
        <p>편집할 사진을 찾을 수 없어요</p>
        <Button onClick={() => navigate('/')}>홈으로</Button>
      </div>
    );
  }

  const aspectRatio = bitmap ? `${bitmap.width} / ${bitmap.height}` : '4 / 3';
  const hasEdits = items.length > 0 || (textDraft !== null && textValue.trim().length > 0);
  const isOriginal = source.isOriginal;
  const canvasW = bitmap?.width ?? 1;
  const canvasH = bitmap?.height ?? 1;

  return (
    <div className="editor">
      <header className="editor__header">
        <button
          type="button"
          className="editor__chip-btn tap"
          onClick={handleBackClick}
          disabled={saving}
          aria-label="뒤로"
        >
          <IconChevronLeft size={22} />
          <span>뒤로</span>
        </button>
        <div className="editor__title">{isOriginal ? '편집' : `${source.name} 편집`}</div>
        <Button
          size="md"
          leading={<IconSave size={18} />}
          onClick={handleSaveClick}
          disabled={!hasEdits || saving}
          className="editor__save-btn"
        >
          저장
        </Button>
      </header>

      <div className="editor__stage-wrap" ref={zoom.setWheelTarget}>
        <div
          ref={stageRef}
          className="editor__stage"
          style={{ aspectRatio, transform: zoom.cssTransform }}
        >
          <canvas ref={bgRef} className="editor__bg" />
          <canvas
            ref={drawRef}
            className={`editor__draw editor__draw--${tool}`}
            onPointerDown={zoom.handlers.onPointerDown}
            onPointerMove={zoom.handlers.onPointerMove}
            onPointerUp={zoom.handlers.onPointerUp}
            onPointerCancel={zoom.handlers.onPointerCancel}
          />
          {textDraft && (
            <div
              className="editor__text-overlay"
              style={{
                left: `${(textDraft.x / canvasW) * 100}%`,
                top: `${(textDraft.y / canvasH) * 100}%`,
              }}
            >
              <input
                autoFocus
                className="editor__text-input"
                placeholder="텍스트 입력"
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitText();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelText();
                  }
                }}
                onBlur={commitText}
                style={{ color: COLORS[colorIdx].hex }}
              />
            </div>
          )}
        </div>
        {zoom.isZoomed && (
          <button
            type="button"
            className="editor__zoom-pill tap"
            onClick={zoom.reset}
            aria-label="원래 크기로"
          >
            <span className="editor__zoom-value">
              {Math.round(zoom.transform.scale * 100)}%
            </span>
            <span>원래대로</span>
          </button>
        )}
      </div>

      <div className="editor__toolbar">
        <div className="editor__toolbar-row">
          <button
            type="button"
            className="editor__icon-btn tap"
            onClick={handleUndo}
            disabled={items.length === 0 && !textDraft}
            aria-label="실행 취소"
          >
            <IconUndo size={20} />
          </button>
          <button
            type="button"
            className="editor__icon-btn tap"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            aria-label="다시 실행"
          >
            <IconRedo size={20} />
          </button>

          <span className="editor__divider" />

          <button
            type="button"
            className={`editor__icon-btn tap ${tool === 'pen' ? 'is-active' : ''}`}
            onClick={() => selectTool('pen')}
            aria-label="펜"
          >
            <IconPen size={20} />
          </button>
          <button
            type="button"
            className={`editor__icon-btn tap ${tool === 'erase' ? 'is-active' : ''}`}
            onClick={() => selectTool('erase')}
            aria-label="지우개"
          >
            <IconEraser size={20} />
          </button>
          <button
            type="button"
            className={`editor__icon-btn tap ${tool === 'text' ? 'is-active' : ''}`}
            onClick={() => selectTool('text')}
            aria-label="텍스트"
          >
            <IconText size={20} />
          </button>

          <span className="editor__divider" />

          {COLORS.map((c, i) => (
            <button
              key={c.key}
              type="button"
              className={`editor__swatch tap ${
                colorIdx === i && tool !== 'erase' ? 'is-active' : ''
              }`}
              style={{ backgroundColor: c.hex }}
              onClick={() => {
                setColorIdx(i);
                if (tool === 'erase') setTool('pen');
              }}
              aria-label={`색 ${c.key}`}
            />
          ))}

          <span className="editor__divider" />

          {STROKE_RATIOS.map((_r, i) => (
            <button
              key={i}
              type="button"
              className={`editor__size tap ${sizeIdx === i ? 'is-active' : ''}`}
              onClick={() => setSizeIdx(i)}
              aria-label={`굵기 ${i + 1}`}
            >
              <span
                className="editor__size-dot"
                style={{
                  width: 4 + i * 5,
                  height: 4 + i * 5,
                  ...(tool === 'text' ? { width: 'auto', height: 'auto' } : {}),
                }}
              >
                {tool === 'text' && (
                  <span className="editor__size-letter" style={{ fontSize: 9 + i * 4 }}>
                    A
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* SAVE popup — opens on Save click only. */}
      <BottomSheet
        open={dialog === 'save'}
        onClose={() => !saving && setDialog(null)}
        title="저장"
        dismissOnBackdrop={!saving}
      >
        <p className="editor__sheet-desc">
          {isOriginal
            ? '원본은 그대로 두고 새 버전으로 저장돼요.'
            : '이 편집본에 덮어쓰거나 새 버전으로 저장할 수 있어요.'}
        </p>
        <div className="editor__sheet-actions">
          {!isOriginal && (
            <Button
              size="lg"
              fullWidth
              leading={<IconSave size={20} />}
              onClick={() => void doOverwrite()}
              disabled={saving}
            >
              {saving ? '저장 중…' : '이 편집본에 덮어쓰기'}
            </Button>
          )}
          <Button
            variant={isOriginal ? 'primary' : 'secondary'}
            size="lg"
            fullWidth
            leading={isOriginal ? <IconSave size={20} /> : undefined}
            onClick={() => void doNewVersion()}
            disabled={saving}
          >
            새 버전으로 저장
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => {
              setSaveAsName(`${source.name}-copy`);
              setDialog('saveAs');
            }}
            disabled={saving}
          >
            다른 이름으로 저장
          </Button>
          <Button
            variant="ghost"
            size="lg"
            fullWidth
            onClick={() => setDialog(null)}
            disabled={saving}
          >
            취소
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={dialog === 'saveAs'}
        onClose={() => !saving && setDialog('save')}
        title="다른 이름으로 저장"
        dismissOnBackdrop={!saving}
      >
        <p className="editor__sheet-desc">새 사진으로 저장돼요. 같은 폴더에 들어가요.</p>
        <TextField
          autoFocus
          value={saveAsName}
          onChange={(e) => setSaveAsName(e.target.value)}
          maxLength={60}
        />
        <div className="editor__sheet-actions">
          <Button
            size="lg"
            fullWidth
            onClick={() => void doSaveAs()}
            disabled={!saveAsName.trim() || saving}
          >
            {saving ? '저장 중…' : '저장'}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            fullWidth
            onClick={() => setDialog('save')}
            disabled={saving}
          >
            뒤로
          </Button>
        </div>
      </BottomSheet>

      {/* EXIT popup — opens on Back click when there are unsaved edits. */}
      <BottomSheet
        open={dialog === 'exit'}
        onClose={() => !saving && setDialog(null)}
        title="편집한 내용이 있어요"
        dismissOnBackdrop={!saving}
      >
        <p className="editor__sheet-desc">
          저장하지 않고 나가면 그린 내용이 사라져요.
        </p>
        <div className="editor__sheet-actions">
          <Button
            size="lg"
            fullWidth
            leading={<IconSave size={20} />}
            onClick={() => void doDefaultSave(true)}
            disabled={saving}
          >
            {saving ? '저장 중…' : isOriginal ? '저장하고 나가기' : '덮어쓰고 나가기'}
          </Button>
          <Button
            variant="danger"
            size="lg"
            fullWidth
            onClick={() => navigate(-1)}
            disabled={saving}
          >
            저장하지 않고 나가기
          </Button>
          <Button
            variant="ghost"
            size="lg"
            fullWidth
            onClick={() => setDialog(null)}
            disabled={saving}
          >
            계속 편집
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

function drawItem(ctx: CanvasRenderingContext2D, item: EditItem) {
  if (item.type === 'stroke') drawStroke(ctx, item);
  else drawText(ctx, item);
}

function drawStroke(ctx: CanvasRenderingContext2D, s: StrokeItem) {
  if (s.points.length === 0) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
  ctx.beginPath();
  ctx.moveTo(s.points[0].x, s.points[0].y);
  for (let i = 1; i < s.points.length; i++) {
    const p = s.points[i];
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSegment(ctx: CanvasRenderingContext2D, s: StrokeItem) {
  if (s.points.length < 2) return;
  const a = s.points[s.points.length - 2];
  const b = s.points[s.points.length - 1];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, item: TextItem) {
  ctx.save();
  ctx.font = `bold ${item.size}px Pretendard, system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  ctx.textBaseline = 'top';
  ctx.lineWidth = Math.max(3, item.size * 0.14);
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  // Halo for legibility against busy backgrounds (maps, photos)
  ctx.strokeStyle = isDark(item.color) ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.6)';
  ctx.strokeText(item.text, item.x, item.y);
  ctx.fillStyle = item.color;
  ctx.fillText(item.text, item.x, item.y);
  ctx.restore();
}

function isDark(hex: string): boolean {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return true;
  const v = parseInt(m[1], 16);
  const r = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const b = v & 0xff;
  // perceived luminance
  return r * 0.299 + g * 0.587 + b * 0.114 < 140;
}
