import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { StorageBar } from './StorageBar';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { toast } from './ui/Toast';
import { IconDownload } from './ui/Icon';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsSheet({ open, onClose }: Props) {
  const { canInstall, installed, promptInstall } = useInstallPrompt();

  async function handleInstall() {
    const ok = await promptInstall();
    if (ok) toast('설치를 시작했어요', 'success');
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="설정">
      <StorageBar />
      <div style={{ marginTop: 'var(--space-4)' }}>
        {canInstall && (
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            leading={<IconDownload size={20} />}
            onClick={handleInstall}
          >
            홈 화면에 설치
          </Button>
        )}
        {installed && (
          <p
            style={{
              textAlign: 'center',
              color: 'var(--color-text-weak)',
              fontSize: 'var(--font-13)',
            }}
          >
            이미 설치되어 있어요
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
