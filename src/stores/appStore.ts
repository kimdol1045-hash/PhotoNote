import { create } from 'zustand';
import { db, ensureSeeded } from '@/db/schema';
import { DEFAULT_PROJECT_ID, ROOT_FOLDER_ID } from '@/types/models';
import { fallbackFolderForProject } from '@/services/folderService';

interface AppState {
  hydrated: boolean;
  currentProjectId: string;
  currentFolderId: string;
  hydrate: () => Promise<void>;
  switchProject: (id: string) => Promise<void>;
  switchFolder: (id: string) => void;
  /** Called after a project is deleted; falls back to default. */
  reset: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  currentProjectId: DEFAULT_PROJECT_ID,
  currentFolderId: ROOT_FOLDER_ID,

  hydrate: async () => {
    if (get().hydrated) return;
    await ensureSeeded();
    const folderId = await fallbackFolderForProject(DEFAULT_PROJECT_ID);
    set({
      hydrated: true,
      currentProjectId: DEFAULT_PROJECT_ID,
      currentFolderId: folderId,
    });
  },

  switchProject: async (id) => {
    const exists = await db.projects.get(id);
    if (!exists) return;
    const folderId = await fallbackFolderForProject(id);
    set({ currentProjectId: id, currentFolderId: folderId });
  },

  switchFolder: (id) => set({ currentFolderId: id }),

  reset: async () => {
    const folderId = await fallbackFolderForProject(DEFAULT_PROJECT_ID);
    set({ currentProjectId: DEFAULT_PROJECT_ID, currentFolderId: folderId });
  },
}));
