<h1 align="center">EasyDraw - Client</h1>

<p align="center">
  The editors themselves: the whiteboard, the 2D canvas, the live 3D view, and export.
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
at build time and served from a CDN - there is no server-side rendering in the
request path, so the editors load as fast as the network can deliver files,
and hosting costs stay close to nothing.

All the work happens in the browser: the whiteboard's pixels, the routing maths
behind every connection, the WebGL rendering of the 3D view, and image and PDF
export are all computed on the user's machine. The API is only asked to store
documents, keep private libraries, and run the sketch-to-diagram preview.

## 🧊 One graph, two views

The 3D view is not a second model that has to be kept in sync. It is derived,
on every change, from the same nodes and edges the 2D canvas shows:

| 2D | 3D |
| --- | --- |
| A shape's position on the canvas | Its place on the floor (100 px = one scene unit) |
| Its width and height | Its footprint: width and depth |
| Its style, label and entity fields | The same colours, text and fields, printed on the object's surfaces |
| A connection and its bend points | A connection routed through the scene |
| A group | A plate under its children |

What only makes sense in space - how high an object is raised, how tall it
stands, its tilt - is kept in a separate `spatial3d` record on the node, so a
3D-only change never disturbs the 2D plan. The camera, the scene origin, the
floor/upright orientation and the grid are saved per page in `view3d`.

Edits made in 3D go through the same graph actions as edits made in 2D. Moving,
resizing, rotating, connecting, grouping, copying or relabelling an object in
either view is one change to one graph, with one undo history, so switching
views mid-task never loses or duplicates work. The 2D viewport stays mounted
while the 3D view is on screen, so coming back keeps its pan and zoom.

## ✏️ Whiteboard and sketch-to-diagram

The whiteboard is a raster paint engine on an HTML canvas, with its own undo
history and sixteen tools: selection and freeform selection, pan, pencil,
brush, airbrush, eraser, flood fill, eyedropper, line, curve, rectangle,
rounded rectangle, oval, polygon and text. A whiteboard is saved as an image
inside its document, a moment after you stop drawing.

Turning a sketch into a diagram takes three steps:

1. **Freeze**: the drawing (and an optional note about what you meant) is
   captured exactly as it is, so later strokes cannot change what is being read.
2. **Preview**: the API returns a proposed diagram, which can be inspected in
   2D or 3D and refined with feedback.
3. **Create**: the preview being viewed is turned into a real, editable
   diagram - exactly that one, without asking the model again - and the new
   diagram stays linked to the whiteboard it came from.

## 🧠 How editor state is organised

A diagram exists at three different levels of freshness at once. EasyDraw keeps
them deliberately separate rather than letting them blur together:

| Layer | Holds | Updated |
| --- | --- | --- |
| **Canvas** (`flow-store`) | The nodes and edges currently on screen, in 2D and 3D | On every drag, every keystroke |
| **Document** (`editor-doc.store`) | All pages of the diagram, with each page's 3D view | When you switch page, save, or export |
| **Storage** | `localStorage` snapshot + the cloud copy | Debounced, one second after you stop |

Keeping these apart is what makes page switching safe: the page you are leaving
is written back to the document before the next one is read out of it, so an
unsaved edit can never be lost in the swap.

Saves go through a **per-document queue**: an older request can never finish
after a newer one and overwrite it, and only the newest request marks the
document as saved. Adding, duplicating, deleting or importing pages saves on
its own, and leaving the editor - diagram or whiteboard - still delivers the
last edit.

Undo/redo is a stack of JSON snapshots rather than a log of operations. It is a
little heavier in memory, and much harder to get subtly wrong.

## 🗂️ Layout

```
src/
├─ app/                    routes: landing, auth, dashboard, settings, editor
└─ lib/
   ├─ flow/                the 2D editor
   │  ├─ nodes/            shape registry — one folder per shape
   │  ├─ edges/            connection rendering, orthogonal routing, labels
   │  ├─ editor-persistence.ts   canvas ↔ document ↔ cloud sync
   │  ├─ save-queue.ts           per-document ordering of saves
   │  └─ EditorContext.tsx       actions the toolbar and menu bar call
   ├─ diagram3d/           the 3D view: scene model, objects, camera, editing
   ├─ whiteboard/          paint engine, tools, sketch-to-diagram preview
   ├─ node-library/        private image and 3D object libraries
   ├─ dashboard/           document lists, samples and templates
   ├─ components/          chrome: menu bar, toolbar, sidebar, style panels
   ├─ exporters/           PNG · JPEG · PDF · .easydraw
   └─ stores/              document, editor UI, history, auth
```

## 🧩 Design notes

**Shapes are data, not special cases.** Each shape lives in its own folder
describing its geometry, default size and palette icon. Both the 2D canvas and
the 3D scene render from that description, so adding a shape never means
editing the canvas, the scene, the sidebar or the style panel.

**3D objects are recipes.** A reusable 3D object is a small JSON recipe of
parts - boxes, cylinders and other primitives with sizes, positions and
colours - validated by the same schema the renderer trusts. That keeps objects
light to store and share, and means a saved object can always be drawn.

**Connections route themselves.** Edges are laid out orthogonally around the
shapes they join, with draggable bend points, and either end can float free of
any shape. Labels can sit anywhere along the line, positioned by arc length so
they stay put when the route changes shape.

**Export captures the diagram, not the screen.** Rather than photographing the
visible viewport, 2D export re-anchors the canvas to the diagram's true bounds,
so what you get is the whole drawing at full quality, including connection
bends that stray outside every shape. In 3D, export renders the scene from the
current camera.

**Live style preview.** Hovering a font or size in the toolbar paints the
selected shape immediately without touching the document, so previewing costs
you no undo history and triggers no save. Only a click commits.

**Graceful without WebGL.** If a browser cannot start WebGL, the 3D view says
so and offers the way back to 2D; nothing about the document changes.

## 🛠️ Develop

From the repository root (the client is part of an npm workspace):

```sh
npm ci
npm run build:packages
npm run dev -w easydraw -- --port 5173
npm run test -w easydraw
npm run lint -w easydraw
npm run build:client          # static export into client/out
```

Set `NEXT_PUBLIC_API_URL` before building - `http://localhost:3000` locally,
`https://api.easydraw.net` in production. It is baked into the bundle at build
time.
