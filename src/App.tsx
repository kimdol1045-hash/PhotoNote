import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Home } from './routes/Home';
import { Camera } from './routes/Camera';
import { PhotoDetail } from './routes/PhotoDetail';
import { Editor } from './routes/Editor';
import { useAppStore } from './stores/appStore';
import { ToastViewport } from './components/ui/Toast';

export default function App() {
  const hydrate = useAppStore((s) => s.hydrate);
  const hydrated = useAppStore((s) => s.hydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }} />
    );
  }

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/folder/:folderId" element={<Home />} />
        <Route path="/camera" element={<Camera />} />
        <Route path="/photo/:id" element={<PhotoDetail />} />
        <Route path="/edit/:id" element={<Editor />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <ToastViewport />
    </div>
  );
}
