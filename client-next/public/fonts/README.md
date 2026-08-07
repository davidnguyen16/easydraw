# Fonts

Put the font files here. Each font needs **one `.woff2` file**.

The file names must match exactly (lowercase, hyphenated) as listed below,
because `src/global.css` loads them from `/fonts/<file-name>`.
The font-family names in `global.css` and `ToolBar.svelte` must match too.

**Inter is the default font** for the whole app (set on `body` in `global.css`).

| Font in the dropdown | File name to add          |
| -------------------- | ------------------------- |
| Bergamo Std          | `bergamo-std.woff2`       |
| Cousine              | `cousine.woff2`           |
| Dustismo             | `dustismo.woff2`          |
| Gentium Basic        | `gentium-basic.woff2`     |
| Inter                | `inter.woff2`             |
| Kirsty               | `kirsty.woff2`            |
| Komika Hand          | `komika-hand.woff2`       |
| Liberation Mono      | `liberation-mono.woff2`   |
| Liberation Sans      | `liberation-sans.woff2`   |
| Liberation Serif     | `liberation-serif.woff2`  |
| Orbitron             | `orbitron.woff2`          |
| SF Arch Rival        | `sf-arch-rival.woff2`     |
| SF Cartoonist Hand   | `sf-cartoonist-hand.woff2`|

## Notes

- If a font file is missing, picking that font simply falls back to the
  default font — nothing breaks.
- Have a `.ttf` instead? Convert it to `.woff2` first (it is smaller and
  loads faster). You can use https://transfonter.org or the `fonttools`
  CLI (`pip install fonttools brotli`, then
  `fonttools ttLib.woff2 compress font.ttf`).
