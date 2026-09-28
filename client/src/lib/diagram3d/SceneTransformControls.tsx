'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls, type TransformControlsProps } from '@react-three/drei';
import type { TransformControls as TransformControlsImpl } from 'three-stdlib';

/** The installed Drei wrapper detaches the object but does not dispose the
 * three-stdlib controls. Own its document listeners and GPU gizmo resources,
 * and finish interrupted gestures so history/orbit controls cannot get stuck. */
export function SceneTransformControls(props: TransformControlsProps) {
  const controlsRef = useRef<TransformControlsImpl>(null);
  const callbacksRef = useRef(props);
  const movingRef = useRef(false);
  const [epoch, setEpoch] = useState(0);
  const get = useThree((state) => state.get);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => { callbacksRef.current = props; });

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    // Reconnect after React Strict Mode's setup/cleanup replay. Registering an
    // identical DOM listener twice is a no-op; construction already connects.
    controls.connect(get().gl.domElement);
    const finish = () => {
      if (!movingRef.current) return;
      movingRef.current = false;
      callbacksRef.current.onMouseUp?.();
      const orbit = get().controls as unknown as { enabled: boolean } | null;
      if (orbit) orbit.enabled = true;
      invalidate();
    };
    const interrupt = () => {
      if (!movingRef.current) return;
      finish();
      // Internal TransformControls dragging state is private. A fresh gizmo
      // safely clears it without reaching into the library's private fields.
      setEpoch((value) => value + 1);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') interrupt(); };
    window.addEventListener('blur', interrupt);
    window.addEventListener('pointercancel', interrupt);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('blur', interrupt);
      window.removeEventListener('pointercancel', interrupt);
      window.removeEventListener('keydown', escape);
      finish();
      controls.dispose();
    };
  }, [epoch, get, invalidate]);

  return <TransformControls {...props} key={epoch} ref={controlsRef}
    onMouseDown={(event) => { movingRef.current = true; props.onMouseDown?.(event); }}
    onMouseUp={(event) => { movingRef.current = false; props.onMouseUp?.(event); }}
  />;
}
