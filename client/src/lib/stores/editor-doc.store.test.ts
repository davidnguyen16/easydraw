import { beforeEach, describe, expect, it } from 'vitest';
import { exportEditorStateAsJSON, useEditorDoc } from './editor-doc.store';

function createLegacyDocument() {
  return {
    activePageId: 'page-1',
    fileName: 'Existing diagram',
    status: 'draft',
    pages: [{
      id: 'page-1',
      name: 'Page 1',
      nodes: [
        { id: 'app', type: 'RectangleNode', position: { x: 20, y: 40 }, data: { label: 'App' } },
        { id: 'api', type: 'RectangleNode', position: { x: 200, y: 40 }, data: { label: 'API' } },
      ],
      edges: [{ id: 'request', source: 'app', target: 'api', data: { label: 'Request' } }],
    }],
  };
}

describe('diagram document compatibility', () => {
  beforeEach(() => useEditorDoc.getState().resetEditorState());

  it('loads and exports legacy nodes, labels and connections without a migration', () => {
    const document = createLegacyDocument();
    expect(useEditorDoc.getState().loadEditorStateFromJSON(JSON.stringify(document))).toBe(true);
    expect(JSON.parse(exportEditorStateAsJSON())).toEqual({ schemaVersion: 1, ...document });
  });

  it('converts retired Network nodes to editable generic shapes', () => {
    const document = createLegacyDocument();
    document.pages[0].nodes[1].type = 'NetworkRouterNode';
    expect(useEditorDoc.getState().loadEditorStateFromJSON(JSON.stringify(document))).toBe(true);
    const converted = useEditorDoc.getState().pages[0].nodes[1];
    expect(converted.type).toBe('RectangleNode');
    expect(converted.data).toEqual({ label: 'API' });
    expect(converted.position).toEqual({ x: 200, y: 40 });
  });

  it('ignores unmodeled top-level metadata without changing the source or graph', () => {
    const document = { ...createLegacyDocument(), legacyMetadata: { enabled: true, items: [{ id: 'old' }] } };
    const source = JSON.stringify(document);
    expect(useEditorDoc.getState().loadEditorStateFromJSON(source)).toBe(true);
    const exported = JSON.parse(exportEditorStateAsJSON());
    expect(exported).toEqual({ schemaVersion: 1, ...createLegacyDocument() });
    expect(useEditorDoc.getState()).not.toHaveProperty('legacyMetadata');
    expect(JSON.stringify(document)).toBe(source);
  });

  it('preserves the shared graph and saved 3D camera when saving or duplicating a page', () => {
    const document = createLegacyDocument();
    const view3d = {
      version: 1,
      camera: { position: [4, 5, 6], target: [0, 0, 0] },
      origin: [12, 0, -4],
      orientation: 'upright',
      showGrid: false,
    };
    const spatialDocument = { ...document, pages: [{ ...document.pages[0], view3d }] };
    expect(useEditorDoc.getState().loadEditorStateFromJSON(JSON.stringify(spatialDocument))).toBe(true);
    expect(JSON.parse(exportEditorStateAsJSON())).toEqual({ schemaVersion: 1, ...spatialDocument });
    const duplicateId = useEditorDoc.getState().duplicatePage('page-1');
    const [original, duplicate] = useEditorDoc.getState().pages;
    expect(duplicateId).toBe(duplicate.id);
    expect(duplicate.nodes).toEqual(original.nodes);
    expect(duplicate.edges).toEqual(original.edges);
    expect(duplicate.view3d).toEqual(original.view3d);
    expect(duplicate.view3d).not.toBe(original.view3d);
  });

  it('persists presentation without changing graph or losing preferences during camera changes', () => {
    const store = useEditorDoc.getState();
    store.loadEditorStateFromJSON(JSON.stringify(createLegacyDocument()));
    const original = useEditorDoc.getState().pages[0];
    const camera = { position: [4, 5, 6], target: [0, 0, 0] } as const;
    const cameraInput = { position: [...camera.position] as [number, number, number], target: [...camera.target] as [number, number, number] };
    store.setPageCamera3D('page-1', cameraInput, [12, 0, -4]);
    store.setPagePresentation3D('page-1', { orientation: 'upright', showGrid: false });
    let page = useEditorDoc.getState().pages[0];
    expect(page.view3d).toEqual({ version: 1, origin: [12, 0, -4], orientation: 'upright', showGrid: false });
    expect(page.nodes).toBe(original.nodes);
    expect(page.edges).toBe(original.edges);
    store.setPageCamera3D('page-1', cameraInput);
    page = useEditorDoc.getState().pages[0];
    expect(page.view3d).toMatchObject({ orientation: 'upright', showGrid: false, origin: [12, 0, -4], camera: cameraInput });
    store.setPagePresentation3D('page-1', { showGrid: true });
    expect(useEditorDoc.getState().pages[0].view3d?.camera).toEqual(cameraInput);
    store.setPagePresentation3D('page-1', { orientation: 'upright' });
    expect(useEditorDoc.getState().pages[0].view3d?.camera).toEqual(cameraInput);
    const saved = exportEditorStateAsJSON();
    expect(store.loadEditorStateFromJSON(saved)).toBe(true);
    expect(useEditorDoc.getState().pages[0].view3d).toMatchObject({ orientation: 'upright', showGrid: true, camera: cameraInput });
  });

  it('rejects corrupt presentation updates and unknown page ids without altering the document', () => {
    const store = useEditorDoc.getState();
    store.loadEditorStateFromJSON(JSON.stringify(createLegacyDocument()));
    const original = useEditorDoc.getState().pages;
    store.setPagePresentation3D('missing', { orientation: 'upright' });
    store.setPagePresentation3D('page-1', { orientation: 'unknown' } as never);
    store.setPagePresentation3D('page-1', { showGrid: 'false' } as never);
    expect(useEditorDoc.getState().pages).toBe(original);
  });
});
