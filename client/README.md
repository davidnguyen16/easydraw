<h1 align="center">EasyDraw — Client</h1>

<p align="center">
  The editor itself: canvas, shape library, styling panels and export.
</p>

<p align="center">
  <a href="https://easydraw.net"><b>🌐 Live app</b></a>
  &nbsp;·&nbsp;
  <a href="../README.md">📖 Project overview</a>
  &nbsp;·&nbsp;
  <a href="../server/README.md">⚙️ Server</a>
</p>

## ℹ️ Overview

The client is a **fully static** Next.js application. Every page is prerendered
at build time and served from a CDN — there is no server-side rendering in the
request path, so the editor loads as fast as the network can deliver files, and
hosting costs stay close to nothing.

All the work happens in the browser: the canvas, the routing maths behind every
connection, and the image and PDF export are computed on the user's machine.
The API is only ever asked to store and return a document.

## 🧠 How editor state is organised

The trickiest part of a diagram editor is that "the document" exists at three
different levels of freshness at once. EasyDraw keeps them deliberately
separate rather than letting them blur together:

| Layer | Holds | Updated |
| --- | --- | --- |
| **Canvas** (`flow-store`) | The nodes and edges currently on screen | On every drag, every keystroke |
| **Document** (`editor-doc.store`) | All pages of the diagram | When you switch page, save, or export |
| **Storage** | `localStorage` snapshot + the cloud copy | Debounced, one second after you stop |

Keeping these apart is what makes page switching safe: the page you are leaving
is written back to the document before the next one is read out of it, so an
unsaved edit can never be lost in the swap.

Saving is debounced and **generation-guarded** — if you keep drawing while a
save is in flight, only the newest request is allowed to mark the document as
saved, so a slow response can never overwrite newer work with older state.

Undo/redo is a stack of JSON snapshots rather than a log of operations. It is a
little heavier in memory, and much harder to get subtly wrong.

## 🗂️ Layout

```
src/
├─ app/                    routes: landing, auth, dashboard, settings, editor
└─ lib/
   ├─ flow/                the editor
   │  ├─ nodes/            shape registry — one folder per shape
   │  ├─ edges/            connection rendering, orthogonal routing, labels
   │  ├─ editor-persistence.ts   canvas ↔ document ↔ cloud sync
   │  └─ EditorContext.tsx       actions the toolbar and menu bar call
   ├─ components/          chrome: menu bar, toolbar, sidebar, style panels
   ├─ exporters/           PNG · JPEG · PDF · .easydraw
   └─ stores/              document, editor UI, history, auth
```

## 🧩 Design notes

**Shapes are data, not special cases.** Each of the 49 shapes lives in its own
folder describing its geometry, default size and palette icon. The canvas
renders from that description, so adding a shape never means editing the
canvas, the sidebar or the style panel.

**Connections route themselves.** Edges are laid out orthogonally around the
shapes they join, with draggable bend points, and either end can float free of
any shape. Labels can sit anywhere along the line, positioned by arc length so
they stay put when the route changes shape.

**Export captures the diagram, not the screen.** Rather than photographing the
visible viewport, export re-anchors the canvas to the diagram's true bounds, so
what you get is the whole drawing at full quality — including connection bends
that stray outside every shape.

**Live style preview.** Hovering a font or size in the toolbar paints the
selected shape immediately without touching the document, so previewing costs
you no undo history and triggers no save. Only a click commits.
