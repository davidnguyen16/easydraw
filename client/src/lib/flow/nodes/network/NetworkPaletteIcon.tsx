import NetworkGlyph from './NetworkGlyph';

// Palette icon for network devices — the same glyph NetworkNode draws, in the
// palette colour scheme. Port of NetworkPaletteIcon.svelte.
export default function NetworkPaletteIcon({ id }: { id: string }) {
  return (
    <NetworkGlyph
      id={id}
      mode="palette"
      fillColor="#ffffff"
      strokeColor="currentColor"
      accentColor="currentColor"
      strokeScale={0.9}
      className="h-8 w-9 overflow-visible"
    />
  );
}
