# Fonts

Each font in the editor's font picker needs **one `.woff2` file** in this
folder. File names must match exactly (lowercase, hyphenated) — they are loaded
by URL as `/fonts/<file-name>`.

Three places have to agree on a font, and all three are in `client/`:

| Where | What it holds |
| --- | --- |
| `public/fonts/<name>.woff2` | The file itself |
| `src/app/globals.css` | Its `@font-face` rule |
| `src/lib/fonts.ts` | Its display name in `FONT_FAMILIES` |

**Inter is the app-wide default**, set on `body` in `globals.css`.

## Inventory

| Font | File | Licence |
| --- | --- | --- |
| Inter | `inter.woff2` | SIL Open Font License 1.1 |
| Liberation Sans | `liberation-sans.woff2` | SIL Open Font License 1.1 |
| Liberation Serif | `liberation-serif.woff2` | SIL Open Font License 1.1 |
| Liberation Mono | `liberation-mono.woff2` | SIL Open Font License 1.1 |
| Gentium Basic | `gentium-basic.woff2` | SIL Open Font License 1.1 |
| Orbitron | `orbitron.woff2` | SIL Open Font License 1.1 |
| Cousine | `cousine.woff2` | Apache License 2.0 |
| Bergamo Std | `bergamo-std.woff2` | **To confirm** |
| Dustismo | `dustismo.woff2` | **To confirm** |
| Kirsty | `kirsty.woff2` | **To confirm** |
| Komika Hand | `komika-hand.woff2` | **To confirm** |
| SF Arch Rival | `sf-arch-rival.woff2` | **To confirm** |
| SF Cartoonist Hand | `sf-cartoonist-hand.woff2` | **To confirm** |

> ⚠️ The rows marked **To confirm** came from free font sites, where terms vary
> a lot: several popular faces are licensed *for personal use only*, which does
> not cover redistribution from a public web service like easydraw.net. Check
> the licence that shipped with each of those files, record it above, and drop
> any font whose terms do not permit this use — a missing font degrades
> gracefully (see Notes), so removing one costs nothing but the option.

Fonts under the SIL OFL must keep their copyright and licence notice with the
distribution; keep the original licence files alongside the sources you
downloaded.

## Notes

- If a font file is missing, choosing that font silently falls back to the
  default — nothing breaks.
- Have a `.ttf`? Convert it to `.woff2` first; it is much smaller and loads
  faster. Use <https://transfonter.org>, or the `fonttools` CLI
  (`pip install fonttools brotli`, then
  `fonttools ttLib.woff2 compress font.ttf`).
