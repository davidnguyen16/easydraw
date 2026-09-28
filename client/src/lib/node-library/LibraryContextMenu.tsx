'use client';

import { Fragment, useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface LibraryContextMenuItem {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export interface LibraryContextMenuProps {
  x: number;
  y: number;
  ariaLabel: string;
  trigger: HTMLButtonElement;
  items: readonly LibraryContextMenuItem[];
  onClose: () => void;
}

const ITEM_CLASS = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-[#333333] outline-none hover:bg-[#F5F5F5] focus-visible:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-40';

/** Shared accessible popover behavior for private section and node actions. */
export default function LibraryContextMenu({ x, y, ariaLabel, trigger, items, onClose }: LibraryContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  // Wrappers may create a fresh item array while rendering. Only an actual
  // availability/order change should move keyboard focus back to the first item.
  const focusSignature = items.map((item) => `${item.key}:${item.disabled ? 1 : 0}`).join('|');

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const bounds = menu.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(Number.isFinite(x) ? x : margin, window.innerWidth - bounds.width - margin));
    const top = Math.max(margin, Math.min(Number.isFinite(y) ? y : margin, window.innerHeight - bounds.height - margin));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    const first = menu.querySelector<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)');
    (first ?? menu).focus({ preventScroll: true });
  }, [x, y, ariaLabel, focusSignature]);

  useEffect(() => {
    const outsidePointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !menuRef.current?.contains(event.target)) onClose();
    };
    const outsideScroll = (event: Event) => {
      // A short viewport may require scrolling the menu itself. Only scrolling
      // the surrounding document/sidebar invalidates its opening position.
      if (!(event.target instanceof Node) || !menuRef.current?.contains(event.target)) onClose();
    };
    window.addEventListener('pointerdown', outsidePointer, true);
    window.addEventListener('scroll', outsideScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('pointerdown', outsidePointer, true);
      window.removeEventListener('scroll', outsideScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const focusTrigger = () => {
    if (trigger.isConnected) trigger.focus({ preventScroll: true });
  };

  const run = (item: LibraryContextMenuItem) => {
    if (item.disabled) return;
    // Restore before the callback so an inline rename field's autofocus wins.
    focusTrigger();
    onClose();
    item.onSelect();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      focusTrigger();
      onClose();
      return;
    }
    if (event.key === 'Tab') {
      // A portal lives at the end of <body>. Anchor native Tab traversal at the
      // originating control rather than an unrelated body element.
      // Do not preventDefault: Shift+Tab and Tab retain their normal behavior.
      focusTrigger();
      onClose();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const enabledItems = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)') ?? []);
    if (!enabledItems.length) return;
    const active = enabledItems.findIndex((item) => item === document.activeElement);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? enabledItems.length - 1
        : event.key === 'ArrowDown' ? (active + 1) % enabledItems.length
          : (active < 0 ? enabledItems.length - 1 : (active - 1 + enabledItems.length) % enabledItems.length);
    enabledItems[next].focus({ preventScroll: true });
    enabledItems[next].scrollIntoView({ block: 'nearest' });
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={ariaLabel}
      tabIndex={-1}
      className="fixed z-[100] w-48 max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-md border border-[#E0E0E0] bg-white py-1 shadow-lg outline-none"
      style={{ left: Number.isFinite(x) ? x : 8, top: Number.isFinite(y) ? y : 8 }}
      onKeyDown={handleKeyDown}
      onKeyUp={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
    >
      {items.map((item) => <Fragment key={item.key}>
        {item.separatorBefore && <div role="separator" className="my-1 border-t border-[#EEEEEE]" />}
        <button type="button" role="menuitem" tabIndex={-1} className={ITEM_CLASS} disabled={item.disabled} onClick={() => run(item)}>
          {item.icon}<span>{item.label}</span>
        </button>
      </Fragment>)}
    </div>,
    document.body,
  );
}
