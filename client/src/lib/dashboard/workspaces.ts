import { PenLine, Workflow, type LucideIcon } from 'lucide-react';

/**
 * The two workspaces a signed-in user chooses between. Both hold documents
 * from the same API (`/diagrams`); what separates them is the document
 * `type`: everything the diagram editor opens on one side, `whiteboard` on
 * the other. Every dashboard surface — the chooser cards, the toggle, the
 * list page copy — reads from this table so the two stay parallel.
 */
export type WorkspaceId = 'diagram' | 'whiteboard';

/** Document `type` value that puts a document in the whiteboard workspace. */
export const WHITEBOARD_TYPE = 'whiteboard';

export interface Workspace {
  id: WorkspaceId;
  /** Singular display name: "Diagram". */
  label: string;
  /** Lower-case singular noun for copy: "diagram". */
  noun: string;
  /** Lower-case plural noun for copy: "diagrams". */
  plural: string;
  path: string;
  icon: LucideIcon;
  /** One line under the name on the chooser card. */
  blurb: string;
  /** The small "what's inside" line on the chooser card. */
  tagline: string;
  /** Dashboard heading and subheading. */
  title: string;
  subtitle: string;
  createLabel: string;
  /** Whether a document of this `type` belongs here. */
  includes: (type: string) => boolean;
}

export const WORKSPACES: readonly Workspace[] = [
  {
    id: 'diagram',
    label: 'Diagram',
    noun: 'diagram',
    plural: 'diagrams',
    path: '/dashboard/diagrams',
    icon: Workflow,
    blurb: 'Structure your ideas with technical diagrams.',
    tagline: 'ERD · UML · Flowchart · DFD',
    title: 'My Diagrams',
    subtitle: 'Create and manage your technical diagrams',
    createLabel: 'New Diagram',
    includes: (type) => type !== WHITEBOARD_TYPE,
  },
  {
    id: 'whiteboard',
    label: 'Whiteboard',
    noun: 'whiteboard',
    plural: 'whiteboards',
    path: '/dashboard/whiteboards',
    icon: PenLine,
    blurb: 'Sketch and paint freely, MS Paint style.',
    tagline: 'Pencil · Brush · Shapes · Text · Selection',
    title: 'My Whiteboards',
    subtitle: 'Create and manage your whiteboard documents',
    createLabel: 'New Whiteboard',
    includes: (type) => type === WHITEBOARD_TYPE,
  },
];

export function getWorkspace(id: WorkspaceId): Workspace {
  return WORKSPACES.find((w) => w.id === id)!;
}

/** The workspace a document of this `type` lives in — where "back" should go. */
export function workspaceForType(type: string): Workspace {
  return WORKSPACES.find((w) => w.includes(type)) ?? WORKSPACES[0]!;
}
