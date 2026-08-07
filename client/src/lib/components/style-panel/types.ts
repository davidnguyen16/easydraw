// Shared style-panel types — the Svelte version exported these from
// StylePanel.svelte's module block; React components import them from here.
export type TextAlign = 'left' | 'center' | 'right';

export interface NodeStyleData {
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  rounded?: boolean;
  shadow?: boolean;
  opacity?: number;
  rotation?: number;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textAlign?: TextAlign;
}
