'use client';

import { useState } from 'react';

// A colour control: a native swatch picker (click the dot) PLUS an editable
// hex text field. Commits on Enter/blur; invalid input reverts. Ported 1:1
// from ColorField.svelte.
interface Props {
  value: string;
  onChange: (hex: string) => void;
  label: string;
}

// Accepts "#rgb", "rgb", "#rrggbb", "rrggbb" → normalised "#RRGGBB", else null.
function normalizeHex(input: string): string | null {
  let v = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    v = v
      .split('')
      .map((c) => c + c)
      .join('');
  }
  return /^[0-9a-fA-F]{6}$/.test(v) ? '#' + v.toUpperCase() : null;
}

export default function ColorField({ value, onChange, label }: Props) {
  // Local draft so typing isn't clobbered by the reactive `value`.
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? value.toUpperCase();

  function commit() {
    if (draft !== null) {
      const hex = normalizeHex(draft);
      if (hex) onChange(hex);
    }
    setDraft(null);
  }

  function onKeydown(event: React.KeyboardEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
      input.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDraft(null);
      input.blur();
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1">
      <label className="relative inline-flex cursor-pointer" aria-label={`${label} colour picker`}>
        <span
          className="size-3.5 rounded-[3px] border border-line"
          style={{ backgroundColor: value }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value.toUpperCase())}
          className="absolute inset-0 cursor-pointer border-none p-0 opacity-0"
          aria-label={`${label} colour`}
        />
      </label>
      <input
        type="text"
        maxLength={7}
        spellCheck={false}
        className="w-16 border-none bg-transparent p-0 text-[0.78rem] text-ink-soft uppercase tabular-nums outline-none"
        value={display}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onFocus={(e) => {
          setDraft(value.toUpperCase());
          e.currentTarget.select();
        }}
        onBlur={commit}
        onKeyDown={onKeydown}
        aria-label={`${label} hex value`}
      />
    </div>
  );
}
