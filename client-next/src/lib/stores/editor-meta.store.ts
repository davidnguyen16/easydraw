import { create } from 'zustand';

// Document metadata (title + status) shown in the MenuBar header. Local-only
// until cloud persistence is ported (Zustand port of editor.store's metadata).
export type DiagramStatus = 'draft' | 'complete' | 'archived';

type EditorMetaStore = {
  fileName: string;
  status: DiagramStatus;
  lastSaved: number;
  setFileName: (name: string) => void;
  setStatus: (status: DiagramStatus) => void;
  setLastSaved: (ts: number) => void;
};

export const useEditorMeta = create<EditorMetaStore>((set) => ({
  fileName: 'Untitled',
  status: 'draft',
  lastSaved: Date.now(),
  setFileName: (fileName) => set({ fileName }),
  setStatus: (status) => set({ status }),
  setLastSaved: (lastSaved) => set({ lastSaved }),
}));
