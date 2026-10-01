'use client';

import { useEffect, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronLeft, ChevronRight, LoaderCircle, RefreshCw, Sparkles, X } from 'lucide-react';
import { useWhiteboard } from '../whiteboard.store';
import ToolSidebar from '../ToolSidebar';
import PanelResizeHandle from '../PanelResizeHandle';
import { PREVIEW_MIN_WIDTH, resolvePanelLayout } from '../panel-layout';
import { useWhiteboardPanelLayout } from '../panel-layout.store';
import DiagramPreviewViewer from './DiagramPreviewViewer';
import { cancelPreview, checkCreationAvailability, generatePreview, PreviewApiError, recoverPreview, type PreviewCommitReceipt, type PreviewCommitTarget, type PreviewRequest } from './preview-api';
import { initialPreviewState, previewReducer } from './preview-state';
import { capturePreviewRequest, feedbackAfterSuccess, IDEA_MAX_LENGTH, FEEDBACK_MAX_LENGTH } from './preview-intent';
import { canCreateFromPreview, captureCommitTarget, createReviewedDiagram, needsPreviewAcknowledgment, previewApprovalKey } from './preview-commit';

const BUTTON = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50';
const WIDE_PREVIEW = '(min-width: 1024px)';
function subscribePreviewLayout(onChange: () => void) {
  const media = window.matchMedia(WIDE_PREVIEW);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
const widePreview = () => window.matchMedia(WIDE_PREVIEW).matches;
const serverPreviewLayout = () => false;
type CreationState = {
  phase: 'idle' | 'saving' | 'creating' | 'opening' | 'error' | 'created';
  target: PreviewCommitTarget | null;
  receipt: PreviewCommitReceipt | null;
  error: string | null;
};
const EMPTY_CREATION: CreationState = { phase: 'idle', target: null, receipt: null, error: null };
/** AI preview and explicit creation from an immutable server-owned result.
 * Keep the board/2D viewport mounted; dispose hidden 3D GPU resources.
 */
export default function WhiteboardPreviewWorkspace({ children, ready, initialHint = '' }: { children: ReactNode; ready: boolean; initialHint?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<'whiteboard' | 'preview'>('whiteboard');
  const wide = useSyncExternalStore(subscribePreviewLayout, widePreview, serverPreviewLayout);
  const layout = useWhiteboardPanelLayout();
  const loadLayout = layout.load;
  const workspace = useRef<HTMLDivElement>(null);
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const sizes = resolvePanelLayout(workspaceWidth || (wide ? 1024 : 768), wide, layout);
  const previewCollapsed = wide && layout.previewCollapsed;
  const [hint, setHint] = useState(initialHint);
  const [ideaExpanded, setIdeaExpanded] = useState(true);
  const latestHint = useRef(initialHint);
  const [feedback, setFeedback] = useState('');
  const [unresolved, setUnresolved] = useState<PreviewRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [state, dispatch] = useReducer(previewReducer, initialPreviewState);
  const [creation, setCreation] = useState<CreationState>(EMPTY_CREATION);
  const [acknowledgedKey, setAcknowledgedKey] = useState<string | null>(null);
  const [serverStaleId, setServerStaleId] = useState<string | null>(null);
  const committing = useRef<AbortController | null>(null);
  const checking = useRef<AbortController | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);
  const [reviewResultId, setReviewResultId] = useState<string | null>(null);
  const pending = useRef<{ controller: AbortController; request: PreviewRequest } | null>(null);
  const unresolvedRef = useRef<PreviewRequest | null>(null);
  const mounted = useRef(false);
  const panel = useRef<HTMLElement | null>(null);
  const viewer = useRef<HTMLDivElement>(null);
  const feedbackSection = useRef<HTMLDivElement>(null);
  const feedbackInput = useRef<HTMLTextAreaElement>(null);
  const creationNotice = useRef<HTMLDivElement>(null);
  const engine = useWhiteboard((s) => s.engine);
  const diagramId = useWhiteboard((s) => s.diagramId);
  const revision = useWhiteboard((s) => s.contentRevision);
  const blocked = useWhiteboard((s) => s.previewBlockedReason);
  const loading = state.status === 'loading';
  const result = state.result;
  const stale = result && (result.source.revision !== revision || result.hint !== hint);
  const everGenerated = Boolean(result || state.previous);
  const creating = ['saving', 'creating', 'opening', 'created'].includes(creation.phase);
  const requestBlocked = !ready || !engine || !diagramId || loading || cancelling || creating || checkingAvailability || Boolean(unresolved) || Boolean(blocked);
  const approvalKey = previewApprovalKey(result, revision, hint, feedback);
  const needsAcknowledgment = !creation.receipt && (needsPreviewAcknowledgment(result, revision, hint, feedback) || Boolean(result && serverStaleId === result.id));
  const acknowledged = !needsAcknowledgment || acknowledgedKey === approvalKey;
  const creationEligible = Boolean(creation.receipt || creation.target || state.status === 'ready' && canCreateFromPreview(result));
  const canCreate = !requestBlocked && acknowledged && creationEligible;
  // Reducer + expiry timer drive the control; capture checks the clock again.
  const canRefine = state.status === 'ready' && Boolean(result?.document && result.documentHash && result.refinementAvailable === true);

  useEffect(() => { loadLayout(); }, [loadLayout]);
  useEffect(() => {
    const element = workspace.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWorkspaceWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      committing.current?.abort();
      committing.current = null;
      checking.current?.abort();
      checking.current = null;
      const request = pending.current?.request ?? unresolvedRef.current;
      pending.current?.controller.abort();
      pending.current = null;
      // This keyed workspace is disposed on document switch. The old request
      // cannot publish locally; tell the server not to publish it either.
      if (request) void cancelPreview(request).catch(() => { /* The durable attempt remains recoverable server-side. */ });
    };
  }, []);
  useEffect(() => {
    if (!result || state.status !== 'ready') return;
    const timeout = setTimeout(() => dispatch({ type: 'expire', now: Date.now() }), Math.max(0, result.expiresAt - Date.now()));
    return () => clearTimeout(timeout);
  }, [result, state.status]);
  useEffect(() => {
    if (result?.id === reviewResultId && state.status === 'ready') {
      viewer.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [result?.id, reviewResultId, state.status]);
  useEffect(() => {
    if (creation.error || availabilityMessage) creationNotice.current?.scrollIntoView({ block: 'nearest' });
  }, [creation.error, availabilityMessage]);

  function rememberUnresolved(request: PreviewRequest | null) {
    unresolvedRef.current = request;
    setUnresolved(request);
  }

  async function run(request: PreviewRequest, recover = false) {
    if (pending.current || cancelling || committing.current || checking.current) return;
    setAvailabilityMessage(null);
    setCreation(EMPTY_CREATION);
    setServerStaleId(null);
    setAcknowledgedKey(null);
    const controller = new AbortController();
    pending.current = { controller, request };
    dispatch({ type: 'start', id: request.id });
    try {
      const next = await (recover ? recoverPreview(request, controller.signal) : generatePreview(request, controller.signal));
      if (!controller.signal.aborted) {
        rememberUnresolved(null);
        dispatch({ type: 'resolve', id: request.id, result: next, now: Date.now() });
        setFeedback((current) => feedbackAfterSuccess(current, request, next));
        if (next.document && latestHint.current === request.hint) {
          setIdeaExpanded(false);
          if (!document.activeElement?.matches('input, textarea')) setReviewResultId(next.id);
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        rememberUnresolved(error instanceof PreviewApiError && ['RECOVERY_REQUIRED', 'INVALID_RESPONSE'].includes(error.code) ? request : null);
        dispatch({ type: 'reject', id: request.id, error: error instanceof PreviewApiError ? error.message : 'Could not generate a preview. Your whiteboard is unchanged.' });
      }
    } finally {
      if (pending.current?.controller === controller) pending.current = null;
    }
  }

  async function generate(refine = false) {
    if (!engine || !diagramId || requestBlocked || pending.current) return;
    if (refine && (state.status !== 'ready' || !feedback.trim())) return;
    try {
      const source = engine.capturePreviewSnapshot();
      const id = crypto.randomUUID();
      await run(capturePreviewRequest({ id, whiteboardId: diagramId, source, hint,
        ...(refine ? { refinement: { base: result, feedback } } : {}) }, Date.now()));
    } catch (error) {
      dispatch({ type: 'capture-error', error: error instanceof Error ? error.message : 'Could not capture this whiteboard.' });
    }
  }

  async function cancel() {
    const request = pending.current?.request ?? unresolved;
    if (!request || cancelling) return;
    pending.current?.controller.abort();
    pending.current = null;
    rememberUnresolved(request);
    setCancelling(true);
    dispatch({ type: 'cancel' });
    try {
      await cancelPreview(request);
      if (mounted.current) rememberUnresolved(null);
    } catch {
      if (mounted.current) dispatch({ type: 'capture-error', error: 'Cancellation could not be confirmed. Check the existing request or try cancelling again. A request already sent to AI may still incur a charge.' });
    } finally {
      if (mounted.current) setCancelling(false);
    }
  }

  function showPreviousPreview() {
    if (committing.current || creating || checking.current) return;
    setAvailabilityMessage(null);
    setCreation(EMPTY_CREATION);
    setServerStaleId(null);
    setAcknowledgedKey(null);
    dispatch({ type: 'previous', now: Date.now() });
  }

  async function checkAvailability() {
    if (!result?.documentHash || requestBlocked || checking.current || committing.current) return;
    const controller = new AbortController();
    checking.current = controller;
    setCheckingAvailability(true);
    setAvailabilityMessage(null);
    try {
      const available = await checkCreationAvailability(result, controller.signal);
      if (mounted.current && !controller.signal.aborted) {
        dispatch({ type: 'creation-availability', id: result.id, documentHash: result.documentHash, available });
        if (!available) setAvailabilityMessage('Creation is not enabled on the server yet. This check did not run AI.');
      }
    } catch (error) {
      if (mounted.current && !controller.signal.aborted) setAvailabilityMessage(error instanceof PreviewApiError ? error.message : 'Could not check availability. Try again.');
    } finally {
      if (checking.current === controller) checking.current = null;
      if (mounted.current) setCheckingAvailability(false);
    }
  }

  async function createDiagram() {
    if (!canCreate || !engine || !diagramId || committing.current || pending.current || checking.current) return;
    const controller = new AbortController();
    committing.current = controller; // Synchronous guard for double-clicks.
    const currentBoard = () => mounted.current && !controller.signal.aborted &&
      useWhiteboard.getState().diagramId === diagramId && useWhiteboard.getState().engine === engine;
    let savedReceipt = creation.receipt;
    try {
      const target = creation.target ?? captureCommitTarget(result, diagramId, Date.now());
      setCreation({ phase: 'saving', target, receipt: savedReceipt, error: null });
      const receipt = await createReviewedDiagram({
        target, acknowledgeStale: needsAcknowledgment && acknowledged, existingReceipt: savedReceipt,
        signal: controller.signal, isCurrent: currentBoard,
        saveSource: async () => {
          if (!currentBoard()) return false;
          if (engine.previewBlockedReason) throw new Error('Finish the current drawing gesture before creating or opening the diagram.');
          // Keep visible floating pixels/text in the source before leaving it.
          // This does not change the reviewed server snapshot or diagram hash.
          engine.commitSelection();
          engine.commitText();
          return useWhiteboard.getState().flush();
        },
        onPhase: (phase) => { if (currentBoard()) setCreation((state) => ({ ...state, phase })); },
        onReceipt: (receipt) => {
          savedReceipt = receipt;
          if (currentBoard()) setCreation((state) => ({ ...state, receipt }));
        },
      });
      if (!currentBoard()) return;
      setCreation((state) => ({ ...state, phase: 'created', receipt, error: null }));
      router.push(`/editor/${receipt.diagramId}`);
    } catch (error) {
      if (!currentBoard()) return;
      if (error instanceof PreviewApiError && error.code === 'preview_stale') {
        setServerStaleId(result?.id ?? null);
        setAcknowledgedKey(null);
      }
      setCreation((state) => ({ ...state, phase: 'error', receipt: savedReceipt,
        error: error instanceof Error ? error.message : 'Could not create the diagram. Your preview and whiteboard are still here.' }));
    } finally {
      if (committing.current === controller) committing.current = null;
    }
  }

  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="flex shrink-0 border-b border-line-soft bg-white px-3 lg:hidden" role="tablist" aria-label="Whiteboard and preview" data-whiteboard-preview>
      {(['whiteboard', 'preview'] as const).map((value) => <button key={value} type="button" role="tab"
        id={`whiteboard-tab-${value}`} aria-controls={`whiteboard-panel-${value}`} aria-selected={tab === value}
        tabIndex={tab === value ? 0 : -1}
        onKeyDown={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const next = event.key === 'Home' ? 'whiteboard' : event.key === 'End' ? 'preview' : tab === 'whiteboard' ? 'preview' : 'whiteboard';
            setTab(next);
            document.getElementById(`whiteboard-tab-${next}`)?.focus();
          }
        }}
        onClick={() => setTab(value)}
        className={`min-h-11 border-b-2 px-4 text-sm font-medium ${tab === value ? 'border-mq-red text-mq-red' : 'border-transparent text-ink-muted'}`}>
        {value === 'whiteboard' ? 'Whiteboard' : 'Preview'}
      </button>)}
    </div>
    <div ref={workspace} className="flex min-h-0 min-w-0 flex-1" data-testid="whiteboard-panel-layout">
      <div id="whiteboard-panel-whiteboard" role="tabpanel" aria-labelledby="whiteboard-tab-whiteboard"
        className={`${tab === 'whiteboard' ? 'flex' : 'hidden'} relative min-h-0 min-w-0 flex-1 lg:flex`}>
        <ToolSidebar width={sizes.toolsWidth} maxWidth={sizes.toolsMaxWidth} collapsed={layout.toolsCollapsed}
          onResize={(width) => layout.setWidth('tools', width)} onResizeEnd={layout.persist} onToggle={() => layout.toggle('tools')} />
        {children}
      </div>
      <aside ref={panel} id="whiteboard-panel-preview" aria-label="Diagram preview" tabIndex={0}
        data-whiteboard-preview data-preview-status={state.status} data-preview-id={result?.id ?? ''}
        style={wide ? { width: sizes.previewWidth } : undefined}
        className={`${tab === 'preview' ? 'flex' : 'hidden'} relative min-h-0 min-w-0 flex-1 flex-col border-l border-line-soft bg-white outline-none lg:flex lg:flex-none`}
        onPointerDownCapture={(event) => {
          if (!(event.target as HTMLElement).closest('input, textarea, select, button, a, [role="separator"], [contenteditable="true"]')) panel.current?.focus({ preventScroll: true });
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          const typing = (event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]');
          // Browser undo can still alter the last-edited hint after focus moves
          // to this readonly viewer. Keep native editing within actual fields.
          if (!typing && (event.key === 'Delete' || event.key === 'Backspace' ||
            (event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase()))) event.preventDefault();
        }} onPaste={(event) => event.stopPropagation()}>
        {wide && <button type="button" aria-label={previewCollapsed ? 'Expand AI preview' : 'Collapse AI preview'}
          aria-expanded={!previewCollapsed} aria-controls="whiteboard-preview-content" title={previewCollapsed ? 'Expand AI preview' : 'Collapse AI preview'}
          onClick={() => layout.toggle('preview')}
          className="absolute right-1 top-2 z-50 flex size-6 cursor-pointer items-center justify-center rounded-full border border-line bg-white text-ink-soft shadow-sm hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-mq-red">
          {previewCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>}
        {wide && !previewCollapsed && <PanelResizeHandle edge="left" label="Resize AI preview" controls="whiteboard-panel-preview"
          width={sizes.previewWidth} minWidth={PREVIEW_MIN_WIDTH} maxWidth={sizes.previewMaxWidth}
          onResize={(width) => layout.setWidth('preview', width)} onResizeEnd={layout.persist} />}
        <div id="whiteboard-preview-content" hidden={previewCollapsed} inert={previewCollapsed}
          className={`${previewCollapsed ? 'hidden' : 'flex'} min-h-0 min-w-0 flex-1 flex-col`}>
        <div className="shrink-0 border-b border-line-soft p-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink"><Sparkles size={18} className="text-mq-red" />Diagram preview</h2>
            <span className="rounded-full bg-[#f5efee] px-2 py-1 text-[10px] font-semibold text-mq-red lg:mr-5">AI preview</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-muted">Turn a sketch and your intent into a diagram. Your drawing stays unchanged; previews do not create saved diagrams.</p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <details open={ideaExpanded} onToggle={(event) => setIdeaExpanded(event.currentTarget.open)}
          className="shrink-0 border-b border-line-soft p-3">
          <summary className="cursor-pointer text-xs font-semibold text-ink">Idea &amp; new preview</summary>
          <div className="mt-3">
          <label htmlFor="whiteboard-preview-hint" className="block text-xs font-medium text-ink">Describe your idea <span className="font-normal text-ink-muted">(optional)</span></label>
          <textarea id="whiteboard-preview-hint" aria-label="Describe your idea" aria-describedby="preview-idea-help" value={hint} maxLength={IDEA_MAX_LENGTH} rows={3} disabled={creating}
            onChange={(event) => { latestHint.current = event.target.value; setHint(event.target.value); }} placeholder="What does your sketch mean? Describe the result, labels, relationships or style you want. You can paste relevant code too."
            className="mt-1 block w-full resize-none rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-mq-red" />
          <p id="preview-idea-help" className="mt-1 text-[11px] leading-4 text-ink-muted">Used with your current drawing. Include code if its exact behavior matters. {hint.length}/{IDEA_MAX_LENGTH}</p>
          <details className="mt-2 text-xs text-ink-muted">
            <summary className="cursor-pointer">Ideas for different kinds of drawings</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 leading-5">
              <li>UML: Show this login flow as an activity diagram, including the failure branch.</li>
              <li>System architecture: Label the API, database and services; show request directions.</li>
              <li>Room layout: Keep the room proportions and label the furniture in this sketch.</li>
              <li>Physics: Preserve the trajectory, coordinate axes and variable labels.</li>
              <li>Travel route: Connect these stops in order and keep the handwritten place names.</li>
            </ul>
          </details>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void generate()} disabled={requestBlocked}
              className={`${BUTTON} flex-1 bg-mq-red text-white hover:bg-mq-red-hover`}>
              {loading ? <LoaderCircle size={16} className="animate-spin" /> : everGenerated ? <RefreshCw size={16} /> : <Sparkles size={16} />}
              {loading ? 'Generating preview…' : everGenerated ? 'Generate from drawing' : 'Generate preview'}
            </button>
          </div>
          {blocked && <p className="mt-2 text-xs text-amber-800" role="status">{blocked}</p>}
          </div>
        </details>
        {(loading || unresolved || cancelling) && <div className="shrink-0 border-b border-line-soft px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            {loading && <p role="status" className="flex items-center gap-2 text-xs text-ink"><LoaderCircle size={14} className="animate-spin" />Generating preview…</p>}
            <button type="button" aria-label="Cancel preview" onClick={cancel} disabled={cancelling} className={`${BUTTON} border border-line text-ink`}><X size={16} />{cancelling ? 'Cancelling…' : 'Cancel'}</button>
          </div>
          {unresolved && !loading && !cancelling && <button type="button" onClick={() => void run(unresolved, true)} className={`${BUTTON} mt-2 w-full border border-line text-ink`}><RefreshCw size={16} />Check existing request</button>}
          <p className="mt-2 text-[11px] leading-4 text-ink-muted">Cancelling may still incur a charge if AI has started. Requests are never sent to AI again automatically.</p>
        </div>}
          <div className="shrink-0" aria-live="polite" aria-atomic="true">
            {stale && <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-900">Your drawing or description has changed since this preview. Refine it with the updated input, or generate from the drawing to start fresh.</p>}
            {state.status === 'error' && <p role="alert" className="flex gap-2 bg-red-50 px-4 py-3 text-xs leading-5 text-red-800"><AlertCircle size={16} className="mt-0.5 shrink-0" />{state.error}</p>}
            {state.status === 'expired' && <p className="bg-amber-50 px-4 py-3 text-xs text-amber-900">This preview has expired. Generate a new preview to continue.</p>}
          </div>
          {result?.document && <div className="flex shrink-0 justify-end border-b border-line-soft px-3 py-1.5">
            <button type="button" onClick={() => {
              feedbackSection.current?.scrollIntoView({ block: 'nearest' });
              feedbackInput.current?.focus({ preventScroll: true });
            }} className="text-xs font-medium text-mq-red underline underline-offset-2">Request changes</button>
          </div>}
          {/* Let the viewer's controls, canvas and notice contribute their full
              minimum height. Short panes scroll instead of overlapping details. */}
          <div ref={viewer} className={`relative flex-1 bg-[#faf9f6] ${result?.document ? 'flex flex-col' : 'min-h-[260px]'}`}>
            {result?.document ? <DiagramPreviewViewer key={result.id} document={result.document} active={wide ? !previewCollapsed : tab === 'preview'} /> :
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-7 text-center">
                {loading ? <LoaderCircle size={28} className="animate-spin text-mq-red" /> : <Sparkles size={28} className="text-[#c8bab8]" />}
                <p className="text-sm font-medium text-ink">{loading ? 'Reading your drawing…' : state.status === 'unrecognized' ? 'No diagram recognized' : 'Your diagram preview appears here'}</p>
                <p className="max-w-xs text-xs leading-5 text-ink-muted">{state.status === 'unrecognized' ? 'Try clearer shapes, labels and arrows, then generate another preview.' : 'Draw shapes, labels and arrows on the whiteboard, then generate a preview. Your original drawing stays unchanged.'}</p>
              </div>}
          </div>
          {state.previous && !loading && <div className="shrink-0 border-t border-line-soft px-4 py-2">
            <button type="button" onClick={showPreviousPreview} disabled={creating || checkingAvailability} className="text-xs font-medium text-mq-red underline underline-offset-2 disabled:opacity-50">Use previous preview</button>
          </div>}
          {everGenerated && <div ref={feedbackSection} className="shrink-0 border-y border-line-soft bg-[#faf9f6] p-3">
            <label htmlFor="whiteboard-preview-feedback" className="block text-xs font-medium text-ink">What should change?</label>
            <textarea ref={feedbackInput} id="whiteboard-preview-feedback" aria-label="What should change?" aria-describedby="preview-refine-help" value={feedback} maxLength={FEEDBACK_MAX_LENGTH} rows={2} disabled={creating}
              onChange={(event) => setFeedback(event.target.value)} placeholder="Add the missing connection; keep the other labels and layout."
              className="mt-1 block w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-mq-red" />
            <p id="preview-refine-help" className="mt-1 text-[11px] leading-4 text-ink-muted">Sends this preview, current sketch, description and earlier feedback to OpenAI.</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-[11px] text-ink-muted">{feedback.length}/{FEEDBACK_MAX_LENGTH}</span>
              <button type="button" onClick={() => void generate(true)} disabled={requestBlocked || !canRefine || !feedback.trim()}
                className={`${BUTTON} border border-mq-red bg-white text-mq-red hover:bg-[#f5efee]`}><Sparkles size={16} />Refine preview</button>
            </div>
            {feedback.trim() && !loading && <p className="mt-2 text-[11px] leading-4 text-ink-muted">Feedback has not been applied. Click Refine preview to submit it.</p>}
            {!canRefine && !loading && <p className="mt-2 text-[11px] leading-4 text-ink-muted">{state.status === 'ready' && result?.refinementAvailable !== true
              ? 'Generate a new preview on the updated server to enable refinement.'
              : 'View a valid, unexpired preview to refine it, or generate a new one.'}</p>}
          </div>}
          {result && <div className="shrink-0 border-t border-line-soft p-4">
            <p className="text-xs text-ink-muted">{result.document?.pages.reduce((count, page) => count + page.nodes.length, 0) ?? 0} objects · {result.document?.pages.reduce((count, page) => count + page.edges.length, 0) ?? 0} connections · {result.model}</p>
            <p className="mt-1 text-[11px] text-ink-muted">AI can make mistakes. Check labels and connections before using the result.</p>
            <details className="mt-3 text-xs text-ink-muted">
              <summary className="cursor-pointer">Instructions used for this preview</summary>
              <p className="mt-2 font-medium">{result.basePreviewId ? 'Refined from the selected previous preview' : 'Generated from the drawing'}</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{result.hint || 'No additional description.'}</p>
              {result.feedback && <><p className="mt-2 font-medium">Requested changes</p><p className="mt-1 whitespace-pre-wrap break-words">{result.feedback}</p></>}
            </details>
            {result.warnings.length > 0 && <div className="mt-3 rounded-lg bg-amber-50 p-3">
              <h3 className="text-xs font-semibold text-amber-900">Review these details</h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-amber-900">
                {result.warnings.map((warning, index) => <li key={index}>{warning.message}</li>)}
              </ul>
            </div>}
            <details className="mt-3 text-xs text-ink-muted">
              <summary className="cursor-pointer">Source snapshot</summary>
              <p className="my-2">Frozen input · {result.source.width} × {result.source.height} px · Revision {result.source.revision}</p>
              {/* The exact local input, not an arbitrary URL supplied by AI. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.source.image} alt="Captured whiteboard" data-source-revision={result.source.revision}
                className="max-h-44 w-full rounded border border-line-soft bg-white object-contain" />
            </details>
          </div>}
          {(creation.error || availabilityMessage) && <div ref={creationNotice} className="shrink-0 border-t border-line-soft p-3">
            {creation.error && <p role="alert" className="text-xs leading-5 text-red-800">{creation.receipt ? 'Diagram created. ' : ''}{creation.error}</p>}
            {availabilityMessage && <p role="status" className="text-xs leading-4 text-ink-muted">{availabilityMessage}</p>}
          </div>}
        </div>
        <div className="shrink-0 border-t border-line-soft bg-white p-3">
          {creationEligible && needsAcknowledgment && <label className="mb-2 flex items-start gap-2 text-xs leading-5 text-ink">
            <input type="checkbox" aria-label="Create from this preview anyway" checked={acknowledgedKey === approvalKey} disabled={creating}
              onChange={(event) => setAcknowledgedKey(event.target.checked ? approvalKey : null)} className="mt-1 accent-[#a6192e]" />
            <span>Create from this preview anyway<span className="block text-[11px] leading-4 text-ink-muted">Unsent changes are not included.</span></span>
          </label>}
          <button type="button" onClick={() => void createDiagram()} disabled={!canCreate} aria-describedby="preview-create-help"
            className={`${BUTTON} w-full bg-mq-red text-white hover:bg-mq-red-hover`}>
            {creating && <LoaderCircle size={16} className="animate-spin" />}
            {creation.phase === 'saving' ? 'Saving whiteboard…' : creation.phase === 'creating' ? 'Creating diagram…'
              : creation.phase === 'opening' || creation.phase === 'created' ? 'Opening diagram…' : creation.receipt ? 'Save and open diagram'
                : creation.target && creation.error ? 'Retry creation' : 'Create diagram'}
          </button>
          <p id="preview-create-help" className="mt-2 text-center text-[11px] leading-4 text-ink-muted">{result?.document && result.creationAvailable !== true
            ? 'Creation is not enabled. Check again after the server update.'
            : 'No AI rerun. Your whiteboard is kept.'}</p>
          {result?.document && result.creationAvailable !== true && state.status === 'ready' && <button type="button"
            disabled={requestBlocked} onClick={() => void checkAvailability()} title="Check this preview without sending a new AI request"
            className="mt-2 w-full text-xs font-medium text-mq-red underline underline-offset-2 disabled:opacity-50">
            {checkingAvailability ? 'Checking availability…' : 'Check availability'}
          </button>}
        </div>
        </div>
      </aside>
    </div>
  </div>;
}
