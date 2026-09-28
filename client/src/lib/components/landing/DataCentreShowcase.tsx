'use client';

import dynamic from 'next/dynamic';
import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Box, CircleHelp, Expand, MousePointer2, Pause, Play, Rotate3D, RotateCcw, Server, Workflow, X } from 'lucide-react';
import { LANDING_EQUIPMENT, LANDING_SCENE, LANDING_TITLE } from './landing-data';
import DataCentrePlan from './DataCentrePlan';
import styles from './HomeExperience.module.css';

const DataCentreScene = dynamic(() => import('./DataCentreScene'), { ssr: false });
const motionQuery = '(prefers-reduced-motion: reduce)';
const subscribeMotion = (callback: () => void) => {
  const media = window.matchMedia(motionQuery); media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
const prefersMotion = () => !window.matchMedia(motionQuery).matches;
const noMotionOnServer = () => false;
class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function DataCentreShowcase() {
  const [mode, setMode] = useState<'2d' | '3d'>('3d');
  const [autoRotate, setAutoRotate] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [sceneAttempt, setSceneAttempt] = useState(0);
  const [inView, setInView] = useState(false);
  const [everInView, setEverInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [help, setHelp] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const motion = useSyncExternalStore(subscribeMotion, prefersMotion, noMotionOnServer);
  const selectedNode = LANDING_SCENE.nodes.find((node) => node.id === selected);
  const selectedEquipment = LANDING_EQUIPMENT.find((node) => node.id === selected);
  const item = selectedNode ? {
    label: selectedNode.label.trim() || selectedEquipment?.label || selectedNode.id,
    zone: selectedEquipment?.zone ?? (selectedNode.type === 'TextNode' ? 'Label' : 'Structure'),
  } : undefined;
  const select = useCallback((id: string | null) => setSelected(id), []);
  const unavailable = useCallback(() => { setFailed(true); setMode('2d'); setSceneReady(false); }, []);
  const ready = useCallback(() => setSceneReady(true), []);

  useEffect(() => {
    if (!frame.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting); if (entry.isIntersecting) setEverInView(true);
    }, { rootMargin: '100px' });
    observer.observe(frame.current);
    const visibility = () => setPageVisible(document.visibilityState !== 'hidden');
    visibility(); document.addEventListener('visibilitychange', visibility);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  useEffect(() => {
    if (!expanded) return;
    closeButton.current?.focus();
    const before = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setExpanded(false); requestAnimationFrame(() => expandButton.current?.focus()); }
      if (event.key !== 'Tab') return;
      const targets = Array.from(frame.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]') ?? []).filter(el => el.getClientRects().length);
      const first = targets[0], last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = before; document.removeEventListener('keydown', key); };
  }, [expanded]);

  function changeMode(next: '2d' | '3d') {
    if (mode !== next) { setMode(next); if (next === '3d') setSceneReady(false); }
  }
  function closeExpanded() { setExpanded(false); requestAnimationFrame(() => expandButton.current?.focus()); }
  return <div id="playground" className={styles.playground}>
    <div className={styles.sampleHeading}><span><span className={styles.tinySquare} /> THE INTERACTIVE PLAYGROUND</span><span>NO SIGN-UP NEEDED</span></div>
    <div className={styles.showcasePlaceholder}>
      {expanded && <div className={styles.backdrop} onClick={closeExpanded} />}
      <div ref={frame} className={`${styles.showcase} ${expanded ? styles.expanded : ''}`} role={expanded ? 'dialog' : 'region'} aria-modal={expanded || undefined} aria-label="Interactive data centre demo" data-testid="landing-showcase" data-view={mode}>
        <div className={styles.showcaseTop}>
          <div className={styles.sampleName}><span className={styles.sampleIcon}><Server size={18} strokeWidth={1.5} /></span><div><h2>{LANDING_TITLE}</h2><p>Same sample as Dashboard → Diagram.</p></div></div>
          <div className={styles.viewSwitch} role="group" aria-label="Demo perspective">
            <button type="button" aria-pressed={mode === '2d'} onClick={() => changeMode('2d')}><Workflow size={14} />2D</button>
            <button type="button" aria-pressed={mode === '3d'} disabled={failed} onClick={() => changeMode('3d')}><Box size={14} />3D</button>
          </div>
          {expanded && <button type="button" ref={closeButton} className={styles.iconButton} aria-label="Close expanded demo" onClick={closeExpanded}><X size={17} /></button>}
        </div>
        <div className={styles.sceneStage}>
          {mode === '2d' && <DataCentrePlan selectedId={selected} onSelect={select} />}
          {mode === '3d' && <>
            {!sceneReady && <div className={styles.sceneLoading}><DataCentrePlan selectedId={null} decorative /><span role="status">Preparing your 3D perspective…</span></div>}
            {everInView && <SceneBoundary key={sceneAttempt} onFailure={unavailable}><DataCentreScene
              autoRotate={autoRotate} motionAllowed={motion && inView && pageVisible} resetKey={resetKey}
              selectedId={selected} onSelect={select} onReady={ready} onUnavailable={unavailable} /></SceneBoundary>}
          </>}
          {mode === '3d' && <span className={styles.sceneCorner}>OPERATIONS CAMPUS / DASHBOARD SAMPLE</span>}
          {help && <div className={styles.demoHelp} role="note"><strong>Make yourself at home.</strong><p>{mode === '3d' ? 'Drag to orbit the model, or use two fingers on a touch screen. Select a device to inspect it. Switch to 2D to see the same layout from above.' : 'Select a device to inspect it. Switch to 3D to orbit the same scene.'}</p><p>This sample runs in your browser. It doesn’t create or change a saved diagram.</p><button type="button" onClick={() => setHelp(false)}>Got it <X size={12} /></button></div>}
        </div>
        <div className={styles.showcaseToolbar}>
          <span className={styles.dragHint} aria-live={expanded ? 'polite' : undefined}>{mode === '3d' ? <Rotate3D size={16} /> : <MousePointer2 size={15} />}<span>{expanded && item ? `${item.label} · ${item.zone}` : mode === '3d' ? 'Drag to orbit. Find a new angle.' : 'Your 2D plan. Select a device.'}</span></span>
          <div className={styles.sceneActions}>
            <button type="button" className={styles.iconButton} aria-label={autoRotate ? 'Pause rotation' : 'Start rotation'} aria-pressed={autoRotate && motion} disabled={mode !== '3d' || !motion} title={!motion ? 'Automatic motion is disabled by your device preference' : autoRotate ? 'Pause rotation' : 'Start rotation'} onClick={() => setAutoRotate(v => !v)}>{autoRotate ? <Pause size={15} /> : <Play size={15} />}</button>
            <button type="button" className={styles.iconButton} aria-label="Reset view" title="Reset view" onClick={() => { setResetKey(v => v + 1); setSelected(null); }}><RotateCcw size={15} /></button>
            <button type="button" className={styles.iconButton} aria-label="Demo instructions" title="Demo instructions" aria-expanded={help} onClick={() => setHelp(v => !v)}><CircleHelp size={15} /></button>
            {!expanded && <button type="button" ref={expandButton} className={styles.iconButton} aria-label="Expand demo" title="Expand demo" onClick={() => setExpanded(true)}><Expand size={15} /></button>}
          </div>
        </div>
        {failed && <div className={styles.fallbackNote} role="status">3D isn’t available in this browser. You can still explore the 2D plan.<button type="button" onClick={() => { setFailed(false); setSceneReady(false); setResetKey(v => v + 1); setSceneAttempt(v => v + 1); setMode('3d'); }}>Retry 3D</button></div>}
      </div>
    </div>
    <div className={styles.sampleFooter}>
      <div className={styles.selectionInfo} aria-live="polite"><span className={styles.statusDot} /><span>{item ? <><strong>{item.label}</strong><span> · {item.zone}</span></> : <><strong>Built to be explored.</strong><span> Select any device.</span></>}</span></div>
      <span className={styles.sampleCount}>{LANDING_SCENE.nodes.length} objects<span> / </span>{LANDING_SCENE.edges.length} connections</span>
    </div>
  </div>;
}
