'use client';

import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { DiagramSceneNode } from './scene-model';
import { getNodeLabelLayout, nodeLabelLayoutKey, type NodeLabelLayout, type SurfaceText } from './node-label-layout';

const NO_RAYCAST = () => {};
const MAX_TEXTURE = 2048;

function font(command: SurfaceText): string {
  const { style } = command;
  return `${style.italic ? 'italic ' : ''}${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
}

/** Unicode-safe wrapping using the same installed font metrics as the canvas. */
function wrapText(context: CanvasRenderingContext2D, command: SurfaceText): string[] {
  if (!command.multiline) return [command.text.replace(/\n/g, ' ')];
  const lines: string[] = [];
  for (const paragraph of command.text.split('\n')) {
    if (!paragraph) { lines.push(''); continue; }
    let line = '';
    for (const token of paragraph.match(/\s+|\S+/gu) ?? []) {
      if (context.measureText(line + token).width <= command.width) { line += token; continue; }
      if (line) { lines.push(line.trimEnd()); line = ''; }
      if (context.measureText(token).width <= command.width) { line = token.trimStart(); continue; }
      for (const character of token) {
        if (line && context.measureText(line + character).width > command.width) { lines.push(line); line = ''; }
        line += character;
      }
    }
    if (line) lines.push(line.trimEnd());
    if (lines.length > 512) break;
  }
  return lines;
}

function paintText(context: CanvasRenderingContext2D, command: SurfaceText) {
  if (!command.text || command.width <= 0 || command.height <= 0) return;
  context.save();
  context.beginPath(); context.rect(command.x, command.y, command.width, command.height); context.clip();
  context.font = font(command); context.fillStyle = command.style.color;
  context.textAlign = command.style.align; context.textBaseline = 'middle';
  const lineHeight = command.style.fontSize * 1.25;
  const maxLines = Math.max(1, Math.ceil(command.height / lineHeight));
  const lines = wrapText(context, command).slice(0, maxLines);
  const top = command.verticalAlign === 'middle' ? command.y + (command.height - lines.length * lineHeight) / 2 : command.y;
  const x = command.style.align === 'left' ? command.x : command.style.align === 'right' ? command.x + command.width : command.x + command.width / 2;
  lines.forEach((line, index) => {
    const y = top + (index + 0.5) * lineHeight;
    context.fillText(line, x, y);
    if (command.style.underline) {
      const width = context.measureText(line).width;
      const left = command.style.align === 'left' ? x : command.style.align === 'right' ? x - width : x - width / 2;
      context.fillRect(left, y + command.style.fontSize * 0.4, width, Math.max(0.7, command.style.fontSize / 14));
    }
  });
  context.restore();
}

function paintCanvas(canvas: HTMLCanvasElement, layout: NodeLabelLayout) {
  const context = canvas.getContext('2d');
  if (!context) return;
  context.resetTransform(); context.clearRect(0, 0, canvas.width, canvas.height);
  context.scale(canvas.width / layout.width, canvas.height / layout.height);
  context.save();
  if (layout.clip === 'ellipse') {
    context.beginPath(); context.ellipse(layout.width / 2, layout.height / 2, layout.width * 0.498, layout.height * 0.498, 0, 0, Math.PI * 2); context.clip();
  } else if (layout.clip === 'card') {
    context.beginPath();
    context.roundRect(layout.width * 0.011, layout.height * 0.011, layout.width * 0.978, layout.height * 0.978, layout.cardRadius);
    context.clip();
  }
  for (const command of layout.commands) {
    if (command.kind === 'text') paintText(context, command);
    else {
      context.fillStyle = command.fill;
      context.beginPath(); context.roundRect(command.x, command.y, command.width, command.height, command.radius ?? 0); context.fill();
    }
  }
  context.restore();
}

function surfaceGeometry(layout: NodeLabelLayout): THREE.BufferGeometry {
  const sphere = layout.surface === 'sphere';
  const geometry = new THREE.PlaneGeometry(layout.width / 100, layout.height / 100, sphere ? 48 : 1, sphere ? 48 : 1);
  if (layout.surface === 'front') return geometry;
  const vertices = geometry.getAttribute('position');
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), z = -vertices.getY(i);
    // The ellipsoid's top hemisphere carries the ink itself. A tangent card
    // would float away at its edges and hide the physical shape at low angles.
    const y = sphere ? layout.size[1] / 2 * Math.sqrt(Math.max(0, 1 - (2 * x / layout.size[0]) ** 2 - (2 * z / layout.size[2]) ** 2)) - layout.position[1] + 0.001 : 0;
    vertices.setXYZ(i, x, y, z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** Ink attached to the object's surface, never a camera-facing DOM billboard. */
export default function NodeSurfaceLabel({ node }: { node: DiagramSceneNode }) {
  const invalidate = useThree((state) => state.invalidate);
  const key = nodeLabelLayoutKey(getNodeLabelLayout(node));
  const resources = useMemo(() => {
    const layout = JSON.parse(key) as NodeLabelLayout | null;
    if (!layout) return null;
    const canvas = document.createElement('canvas');
    // Fixed supersampling is independent of zoom and bounded for large nodes.
    const scale = Math.min(2, MAX_TEXTURE / Math.max(layout.width, layout.height), Math.sqrt(1_048_576 / (layout.width * layout.height)));
    canvas.width = Math.max(1, Math.ceil(layout.width * scale));
    canvas.height = Math.max(1, Math.ceil(layout.height * scale));
    paintCanvas(canvas, layout);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const geometry = surfaceGeometry(layout);
    return { layout, canvas, texture, geometry };
  }, [key]);

  useEffect(() => {
    if (!resources) return;
    let disposed = false;
    const repaint = () => {
      if (disposed) return;
      paintCanvas(resources.canvas, resources.layout);
      resources.texture.needsUpdate = true;
      invalidate();
    };
    // Reuse fonts already loaded by the 2D editor; never fetch remote fonts.
    void document.fonts?.ready.then(repaint);
    document.fonts?.addEventListener('loadingdone', repaint);
    return () => {
      disposed = true;
      document.fonts?.removeEventListener('loadingdone', repaint);
      resources.texture.dispose();
      resources.geometry.dispose();
    };
  }, [resources, invalidate]);

  if (!resources) return null;
  return <mesh position={resources.layout.position} geometry={resources.geometry} raycast={NO_RAYCAST}>
    <meshBasicMaterial map={resources.texture} transparent opacity={resources.layout.opacity}
      depthTest depthWrite={false} alphaTest={0.015} side={THREE.FrontSide}
      polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} toneMapped={false} />
  </mesh>;
}
