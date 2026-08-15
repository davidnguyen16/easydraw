'use client';

import { useEffect, useRef, useState } from 'react';
import type { NodePanelProps } from '@/lib/flow/nodes/types';
import {
  ENTITY_FIELD_TYPES,
  FIELD_KEY_INFO,
  FIELD_KEY_ORDER,
  resolveFieldKey,
  type EntityData,
  type EntityField,
  type FieldKey,
} from './types';

// Per-key palettes (button = filled pill; badge = same minus border;
// option-selected = a faint tint of the same hue).
const KEY_BUTTON_CLASS: Record<FieldKey, string> = {
  PK: 'bg-[#fae9c8] text-[#854f0b] border-[#d8a85a]',
  FK: 'bg-[#dce9fa] text-[#1e4380] border-[#7aa6e6]',
  PI: 'bg-[#c8eae0] text-[#0b6354] border-[#5fb59f]',
  WPI: 'bg-[#e3d8fa] text-[#5a3fb0] border-[#a18de0]',
};
const KEY_BADGE_CLASS: Record<FieldKey, string> = {
  PK: 'bg-[#fae9c8] text-[#854f0b]',
  FK: 'bg-[#dce9fa] text-[#1e4380]',
  PI: 'bg-[#c8eae0] text-[#0b6354]',
  WPI: 'bg-[#e3d8fa] text-[#5a3fb0]',
};
const KEY_OPTION_SELECTED_BG: Record<FieldKey, string> = {
  PK: 'bg-[#fff5e0]',
  FK: 'bg-[#eaf2fd]',
  PI: 'bg-[#d9f1e9]',
  WPI: 'bg-[#ede4fc]',
};

function KeyBadge({ fieldKey }: { fieldKey?: FieldKey }) {
  if (fieldKey) {
    return (
      <span
        className={`${KEY_BADGE_CLASS[fieldKey]} inline-flex min-w-[36px] flex-shrink-0 items-center justify-center rounded px-1.5 py-0.5 text-[0.72rem] leading-[1.4] font-bold`}
      >
        {FIELD_KEY_INFO[fieldKey].short}
      </span>
    );
  }
  // "None" state uses an em-dash placeholder.
  return (
    <span className="inline-flex min-w-[36px] flex-shrink-0 items-center justify-center rounded bg-transparent px-1.5 py-0.5 text-[0.72rem] leading-[1.4] font-normal text-[#b8b8b8]">
      —
    </span>
  );
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`flex-shrink-0 opacity-70 transition-transform duration-150 ${up ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function FieldsPanel({ node, onDataChange }: NodePanelProps) {
  const entity = (node.data ?? {}) as unknown as EntityData;
  const fields = (entity.fields ?? []) as EntityField[];
  const showDataTypes = entity.showDataTypes ?? false;

  // A dropdown is identified by field index AND which selector (main/optional).
  // Only one (of either kind) is open at a time.
  const [openKey, setOpenKey] = useState<{ index: number; which: 'main' | 'optional' } | null>(null);
  const [openTypeIndex, setOpenTypeIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpenKey(null);
        setOpenTypeIndex(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenKey(null);
        setOpenTypeIndex(null);
      }
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  function commitFields(next: EntityField[]) {
    onDataChange({ fields: next }, { resetHeight: true });
  }

  function patchField(index: number, patch: Partial<EntityField>) {
    commitFields(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  // Sets a field's main OR optional key. The main key also strips legacy
  // isPK/isFK booleans so old data doesn't outlive the single-select model.
  function setFieldKey(index: number, which: 'main' | 'optional', key: FieldKey | undefined) {
    commitFields(
      fields.map((f, i) => {
        if (i !== index) return f;
        const next = { ...f } as EntityField & { isPK?: boolean; isFK?: boolean };
        if (which === 'main') {
          if (key) next.key = key;
          else delete next.key;
          delete next.isPK;
          delete next.isFK;
        } else {
          if (key) next.optionalKey = key;
          else delete next.optionalKey;
        }
        return next;
      }),
    );
    setOpenKey(null);
  }

  function removeField(index: number) {
    commitFields(fields.filter((_, i) => i !== index));
    if (openKey?.index === index) setOpenKey(null);
    if (openTypeIndex === index) setOpenTypeIndex(null);
  }

  function addField() {
    commitFields([...fields, { name: 'field' }]);
  }

  function toggleKey(index: number, which: 'main' | 'optional') {
    setOpenKey((prev) => (prev && prev.index === index && prev.which === which ? null : { index, which }));
    setOpenTypeIndex(null);
  }

  function toggleType(index: number) {
    setOpenTypeIndex((prev) => (prev === index ? null : index));
    setOpenKey(null);
  }

  function selectType(index: number, value: string) {
    patchField(index, { type: value });
    setOpenTypeIndex(null);
  }

  function setShowDataTypes(value: boolean) {
    onDataChange({ showDataTypes: value }, { resetHeight: true });
    if (!value) setOpenTypeIndex(null);
  }

  // One key selector (button + dropdown). Used twice per field.
  const renderKeySelector = (
    index: number,
    which: 'main' | 'optional',
    currentKey: FieldKey | undefined,
    isOpen: boolean,
  ) => (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        className={`inline-flex h-[30px] cursor-pointer items-center gap-1 rounded-md border px-2 text-[0.75rem] font-bold transition-colors duration-[120ms] ${
          which === 'main' ? 'min-w-[52px]' : 'min-w-[46px]'
        } ${
          currentKey
            ? KEY_BUTTON_CLASS[currentKey]
            : isOpen
              ? 'border-mq-red bg-white text-ink-muted'
              : which === 'optional'
                ? 'border-dashed border-[#c4c1b8] bg-white text-ink-muted hover:border-mq-red'
                : 'border-line bg-white text-ink-muted hover:border-[#c4c1b8]'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={
          currentKey
            ? FIELD_KEY_INFO[currentKey].long
            : which === 'optional'
              ? 'Set optional key'
              : 'Set key'
        }
        onClick={() => toggleKey(index, which)}
      >
        {currentKey ? (
          <span className="leading-none">{FIELD_KEY_INFO[currentKey].short}</span>
        ) : (
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-[0.85]"
          >
            <circle cx="9" cy="14" r="4" />
            <path d="M12 11l9 -9" />
            <path d="M18 5l2 2" />
            <path d="M16 7l2 2" />
          </svg>
        )}
        <Chevron up={isOpen} />
      </button>

      {isOpen && (
        <ul
          className="absolute top-[calc(100%+4px)] left-0 z-[200] m-0 min-w-[200px] list-none rounded-lg border border-line bg-white p-1 shadow-[0_12px_24px_rgba(0,0,0,0.12)]"
          role="listbox"
        >
          {FIELD_KEY_ORDER.map((option) => {
            const info = FIELD_KEY_INFO[option];
            const isSelected = currentKey === option;
            return (
              <li key={option}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`flex w-full cursor-pointer items-center gap-2.5 rounded border-none bg-transparent px-2.5 py-2 text-left text-[0.82rem] text-ink-soft transition-colors duration-100 ${
                    isSelected ? KEY_OPTION_SELECTED_BG[option] : 'hover:bg-panel'
                  }`}
                  onClick={() => setFieldKey(index, which, option)}
                >
                  <KeyBadge fieldKey={option} />
                  <span className="flex-1 font-medium">{info.long}</span>
                  {isSelected && (
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="flex-shrink-0 text-mq-maroon"
                    >
                      <polyline points="5 12 10 17 19 8" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
          <li className="mx-1 my-1 h-px list-none bg-[#e8e5de]" role="separator" />
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!currentKey}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded border-none bg-transparent px-2.5 py-2 text-left text-[0.82rem] text-ink-soft transition-colors duration-100 hover:bg-panel"
              onClick={() => setFieldKey(index, which, undefined)}
            >
              <KeyBadge />
              <span className="flex-1 font-normal text-ink-muted">None</span>
            </button>
          </li>
        </ul>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-2.5" ref={rootRef}>
      <div className="flex items-center justify-between">
        <h3 className="m-0 text-[0.7rem] font-bold tracking-[0.08em] text-mq-maroon">FIELDS</h3>
        <span className="text-[0.78rem] tabular-nums text-ink-muted">{fields.length}</span>
      </div>

      {fields.map((field, i) => {
        const key = resolveFieldKey(field);
        const keyOpen = openKey?.index === i;
        const typeOpen = openTypeIndex === i;
        return (
          <div
            key={i}
            className={`flex flex-col gap-2 rounded-lg border bg-white p-2.5 transition-[border-color,box-shadow] duration-[120ms] ${
              keyOpen || typeOpen
                ? 'border-mq-red shadow-[0_0_0_1px_rgba(166,25,46,0.25)]'
                : 'border-line'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {renderKeySelector(i, 'main', key, keyOpen && openKey?.which === 'main')}
              {renderKeySelector(i, 'optional', field.optionalKey, keyOpen && openKey?.which === 'optional')}

              <input
                type="text"
                className="min-w-0 flex-1 rounded-md border border-line bg-white px-2.5 py-2 text-[0.9rem] text-ink-soft outline-none focus:border-mq-red"
                value={field.name}
                placeholder="field"
                onInput={(e) => patchField(i, { name: e.currentTarget.value })}
                aria-label="Field name"
              />

              <button
                type="button"
                className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-ink-muted transition-colors duration-[120ms] hover:bg-[#fdf2f1] hover:text-[#b42318]"
                aria-label="Remove field"
                onClick={() => removeField(i)}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            </div>

            {showDataTypes && (
              <div className="relative">
                <button
                  type="button"
                  className={`flex h-8 w-full cursor-pointer items-center justify-between gap-1.5 rounded-md border bg-white px-2.5 text-[0.78rem] font-semibold transition-colors duration-[120ms] ${
                    typeOpen ? 'border-mq-red text-mq-maroon' : 'border-line text-ink-soft'
                  }`}
                  aria-haspopup="listbox"
                  aria-expanded={typeOpen}
                  onClick={() => toggleType(i)}
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    {field.type ? field.type.toUpperCase() : 'TYPE'}
                  </span>
                  <Chevron up={typeOpen} />
                </button>

                {typeOpen && (
                  <ul
                    className="absolute top-[calc(100%+4px)] right-0 left-0 z-[200] m-0 max-h-[220px] list-none overflow-y-auto rounded-lg border border-line bg-white p-1 shadow-[0_12px_24px_rgba(0,0,0,0.12)]"
                    role="listbox"
                  >
                    {ENTITY_FIELD_TYPES.map((option) => {
                      const isSelected = field.type === option;
                      return (
                        <li key={option}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={`flex w-full cursor-pointer items-center justify-between gap-1.5 rounded border-none bg-transparent px-2.5 py-2 text-left text-[0.78rem] font-semibold transition-colors duration-100 hover:bg-mq-pink hover:text-mq-maroon ${
                              isSelected ? 'text-mq-maroon' : 'text-ink-soft'
                            }`}
                            onClick={() => selectType(i, option)}
                          >
                            <span>{option.toUpperCase()}</span>
                            {isSelected && (
                              <svg
                                viewBox="0 0 24 24"
                                width="14"
                                height="14"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="5 12 10 17 19 8" />
                              </svg>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        className="w-full cursor-pointer rounded-lg border border-dashed border-[#c4c1b8] bg-transparent p-2.5 text-[0.85rem] text-ink-muted transition-colors duration-[120ms] hover:border-mq-maroon hover:bg-mq-pink hover:text-mq-maroon"
        onClick={addField}
      >
        + Add field
      </button>

      {/* Master toggle: drives the type dropdowns here AND whether the entity
          node shows each field's type. */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[0.85rem] text-ink-soft">Show data types</span>
        <label className="relative inline-block h-5 w-9 flex-shrink-0">
          <input
            className="peer h-0 w-0 opacity-0"
            type="checkbox"
            checked={showDataTypes}
            onChange={(e) => setShowDataTypes(e.currentTarget.checked)}
          />
          <span className="absolute inset-0 cursor-pointer rounded-full bg-[#d0cabd] transition-colors duration-150 before:absolute before:top-0.5 before:left-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:shadow-[0_1px_2px_rgba(0,0,0,0.15)] before:transition-transform before:duration-150 before:content-[''] peer-checked:bg-mq-red peer-checked:before:translate-x-4" />
        </label>
      </div>
    </div>
  );
}
