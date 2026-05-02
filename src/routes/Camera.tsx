import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/ui/Header';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { IconClose, IconRotate, IconImage } from '@/components/ui/Icon';
import { FilenameSheet } from '@/components/FilenameSheet';
import { createOriginal } from '@/services/fileService';
import { useObjectURL } from '@/hooks/useObjectURL';
import { useAppStore } from '@/stores/appStore';
import { folderPath, smartBack } from '@/utils/navigation';
import './Camera.css';

type Facing = 'environment' | 'user';

export function Camera() {
  const navigate = useNavigate();
  const currentFolderId = useAppStore((s) => s.currentFolderId);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const closeFallback = folderPath(currentFolderId);
  const close = () => smartBack(navigate, closeFallback);

  const [facing, setFacing] = useState<Facing>('environment');
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);
  const [streamReady, setStreamReady] = useState(false);

  const previewUrl = useObjectURL(captured);

  const startStream = useCallback(async (mode: Facing) => {
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStreamReady(true);
      setError(null);
    } catch (e) {
      console.warn('camera permission denied', e);
      setError('camera-unavailable');
      setStreamReady(false);
    }
  }, []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    void startStream(facing);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleShutter() {
    const video = videoRef.current;
    if (!video || !streamReady) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
    );
    if (blob) {
      setCaptured(blob);
      stopStream();
    }
  }

  async function handleFlip() {
    const next: Facing = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    await startStream(next);
  }

  function handleGallery() {
    fileInputRef.current?.click();
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCaptured(f);
    stopStream();
    e.target.value = '';
  }

  async function handleSave({ name, folderId }: { name: string; folderId: string }) {
    if (!captured) return;
    setSaving(true);
    try {
      await createOriginal({
        blob: captured,
        requestedName: name,
        ext: 'jpg',
        folderId,
      });
      navigate(folderPath(folderId), { replace: true });
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  function handleRetake() {
    setCaptured(null);
    void startStream(facing);
  }

  return (
    <div className="camera">
      <Header
        variant="transparent"
        leading={
          <IconButton label="닫기" onClick={close}>
            <IconClose size={26} />
          </IconButton>
        }
        trailing={
          !captured && streamReady ? (
            <IconButton label="카메라 전환" onClick={handleFlip}>
              <IconRotate size={22} />
            </IconButton>
          ) : null
        }
      />

      <div className="camera__viewport">
        {captured ? (
          previewUrl && <img className="camera__preview" src={previewUrl} alt="" />
        ) : (
          <video
            ref={videoRef}
            className="camera__video"
            playsInline
            muted
            autoPlay
          />
        )}

        {error && (
          <div className="camera__error">
            <p className="camera__error-title">카메라를 사용할 수 없어요</p>
            <p className="camera__error-sub">대신 사진을 갤러리에서 불러올 수 있어요</p>
            <Button
              variant="secondary"
              size="lg"
              leading={<IconImage size={20} />}
              onClick={handleGallery}
            >
              갤러리에서 가져오기
            </Button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFilePick}
        className="sr-only"
      />

      {!captured && !error && (
        <div className="camera__controls">
          <button
            type="button"
            className="camera__gallery tap"
            onClick={handleGallery}
            aria-label="갤러리에서 가져오기"
          >
            <IconImage size={24} />
          </button>
          <button
            type="button"
            className="camera__shutter tap"
            onClick={handleShutter}
            aria-label="촬영"
            disabled={!streamReady}
          >
            <span className="camera__shutter-inner" />
          </button>
          <span className="camera__spacer" aria-hidden />
        </div>
      )}

      {captured && !saving && (
        <div className="camera__retake">
          <Button variant="secondary" size="lg" fullWidth onClick={handleRetake}>
            다시 찍기
          </Button>
        </div>
      )}

      <FilenameSheet
        open={!!captured}
        previewUrl={previewUrl}
        saving={saving}
        onCancel={handleRetake}
        onConfirm={handleSave}
      />
    </div>
  );
}
