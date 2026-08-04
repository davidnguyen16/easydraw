import Flow from "@/lib/flow/Flow";

// Phase 2: bare editor route hosting the React Flow canvas full-screen. The
// real route becomes /editor/[id] with the toolbar/panels/menubar in later
// phases; this proves the canvas renders + is interactive.
export default function EditorPage() {
  return (
    <main className="h-screen w-full overflow-hidden">
      <Flow />
    </main>
  );
}
