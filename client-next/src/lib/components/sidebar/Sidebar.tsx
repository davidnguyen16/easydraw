'use client';

import { useEffect, useState } from 'react';
import NodeContainer from './NodeContainer';
import CollapseButton from './CollapseButton';
import ResizeHandle from './ResizeHandle';
import { useSidebarStore } from '@/lib/stores/sidebar.store';
import {
  getShapesByCategory,
  type NodeShape,
  type NodeCategory,
  type PaletteGroupId,
} from '@/lib/flow/nodes/registry';

interface PaletteGroupDefinition {
  id: PaletteGroupId;
  title: string;
}
interface PaletteCategoryDefinition {
  id: NodeCategory;
  title: string;
  groups?: readonly PaletteGroupDefinition[];
}

const PALETTE_CATEGORIES: readonly PaletteCategoryDefinition[] = [
  { id: 'basic', title: 'BASIC' },
  { id: 'arrows', title: 'ARROWS' },
  { id: 'flowchart', title: 'FLOWCHART' },
  { id: 'entity-relation', title: 'ENTITY RELATION' },
  { id: 'uml', title: 'UML' },
  {
    id: 'network',
    title: 'NETWORK',
    groups: [
      { id: 'network-devices', title: 'Network Devices' },
      { id: 'security-traffic', title: 'Security & Traffic' },
      { id: 'end-devices', title: 'End Devices' },
      { id: 'servers-storage', title: 'Servers & Storage' },
      { id: 'wan-cloud', title: 'WAN & Cloud' },
      { id: 'zones-containers', title: 'Zones & Containers' },
      { id: 'connections', title: 'Connections' },
    ],
  },
];

export default function Sidebar() {
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const width = useSidebarStore((s) => s.width);
  const isResizing = useSidebarStore((s) => s.isResizing);
  const load = useSidebarStore((s) => s.load);
  const setRenderedWidth = useSidebarStore((s) => s.setRenderedWidth);

  const [searchBar, setSearchBar] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<NodeCategory, boolean>>(
    () => Object.fromEntries(PALETTE_CATEGORIES.map(({ id }) => [id, false])) as Record<NodeCategory, boolean>,
  );
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    setRenderedWidth(isCollapsed ? 0 : width);
  }, [isCollapsed, width, setRenderedWidth]);

  const searchQuery = searchBar.trim().toLowerCase();
  const isSearching = searchQuery.length > 0;

  const groupKey = (c: NodeCategory, g: PaletteGroupId) => `${c}:${g}`;
  const toggleCategory = (c: NodeCategory) => setExpandedCategories((p) => ({ ...p, [c]: !p[c] }));
  const toggleGroup = (c: NodeCategory, g: PaletteGroupId) =>
    setExpandedGroups((p) => ({ ...p, [groupKey(c, g)]: !p[groupKey(c, g)] }));

  const filterShapes = (shapes: readonly NodeShape[]): NodeShape[] => {
    if (!searchQuery) return [...shapes];
    return shapes.filter((shape) =>
      [shape.label, ...(shape.searchAliases ?? [])].some((term) => term.toLowerCase().includes(searchQuery)),
    );
  };

  const sections = PALETTE_CATEGORIES.map((definition) => {
    const categoryShapes = getShapesByCategory(definition.id);
    const groups = (definition.groups ?? [])
      .map((group) => {
        const shapes = filterShapes(categoryShapes.filter((shape) => shape.paletteGroup === group.id));
        return {
          id: group.id,
          heading: group.title,
          shapes,
          expanded: isSearching
            ? shapes.length > 0
            : (expandedGroups[groupKey(definition.id, group.id)] ?? false),
        };
      })
      .filter((group) => (isSearching ? group.shapes.length > 0 : true));

    const shapes = definition.groups ? [] : filterShapes(categoryShapes);
    const hasVisibleContent = shapes.length > 0 || groups.length > 0;

    return {
      category: definition.id,
      title: definition.title,
      shapes,
      groups,
      expanded: isSearching ? hasVisibleContent : expandedCategories[definition.id],
    };
  }).filter((section) => (isSearching ? section.shapes.length > 0 || section.groups.length > 0 : true));

  return (
    <aside
      className={`absolute top-[0.2%] bottom-0 left-0 z-40 m-0 rounded-none border-l-0 bg-panel ${
        isResizing ? '' : 'transition-[width] duration-150'
      } ${isCollapsed ? 'shadow-none' : 'shadow-[0_0_10px_#c4c1b8]'}`}
      style={{ width: isCollapsed ? 0 : width }}
    >
      <div
        className={`flex h-full w-full flex-col gap-[1.4em] overflow-x-hidden overflow-y-auto px-[1.2em] pt-[2.5em] pb-[1em] ${
          isCollapsed ? 'invisible' : ''
        }`}
        aria-hidden={isCollapsed}
      >
        <div className="flex h-9 items-center rounded-lg border border-line bg-white px-2.5 focus-within:border-mq-red">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0 text-ink-muted">
            <circle cx="11" cy="11" r="7" />
            <line x1="20" y1="20" x2="16.5" y2="16.5" />
          </svg>
          <input
            className="min-w-0 flex-1 appearance-none border-none bg-transparent px-2 text-[0.9rem] text-ink-soft outline-none placeholder:text-ink-muted"
            value={searchBar}
            onChange={(e) => setSearchBar(e.target.value)}
            placeholder="Search shapes"
          />
        </div>

        {sections.map((section) => (
          <NodeContainer
            key={section.category}
            heading={section.title}
            shapes={section.shapes}
            groups={section.groups}
            expanded={section.expanded}
            onToggle={() => toggleCategory(section.category)}
            onGroupToggle={(group) => toggleGroup(section.category, group)}
          />
        ))}
      </div>

      <CollapseButton />
      {!isCollapsed && <ResizeHandle />}
    </aside>
  );
}
