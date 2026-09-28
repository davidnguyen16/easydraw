/**
 * Small conveniences over @rgrove/parse-xml so importers read like the
 * formats they parse instead of like a DOM walk. The parser is spec-compliant
 * and runs in both Node and the browser, which is what keeps this package
 * testable with `node --test` and shippable in the client bundle unchanged.
 */
import { parseXml, XmlElement, XmlText, XmlCdata, type XmlNode } from '@rgrove/parse-xml';

export type { XmlElement };

export class XmlParseError extends Error {}

export function parseDocument(text: string): XmlElement {
  try {
    // Tools write HTML entities (&nbsp;) and the odd undeclared one into
    // attribute values; failing the whole file for that helps nobody.
    return parseXml(stripBom(text), { ignoreUndefinedEntities: true }).root!;
  } catch (error) {
    throw new XmlParseError(error instanceof Error ? error.message : String(error));
  }
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Local name without a namespace prefix: `bpmn:task` → `task`. */
export function localName(element: XmlElement): string {
  const colon = element.name.indexOf(':');
  return colon === -1 ? element.name : element.name.slice(colon + 1);
}

export function attr(element: XmlElement, name: string): string | undefined {
  return element.attributes[name];
}

export function children(element: XmlElement, name?: string): XmlElement[] {
  const out: XmlElement[] = [];
  for (const node of element.children) {
    if (node instanceof XmlElement && (name === undefined || localName(node) === name)) out.push(node);
  }
  return out;
}

export function child(element: XmlElement, name: string): XmlElement | undefined {
  for (const node of element.children) {
    if (node instanceof XmlElement && localName(node) === name) return node;
  }
  return undefined;
}

/** Depth-first search for the first descendant with this local name. */
export function descendant(element: XmlElement, name: string): XmlElement | undefined {
  for (const node of element.children) {
    if (!(node instanceof XmlElement)) continue;
    if (localName(node) === name) return node;
    const found = descendant(node, name);
    if (found) return found;
  }
  return undefined;
}

/** Concatenated text of direct text/CDATA children only. */
export function ownText(element: XmlElement): string {
  let text = '';
  for (const node of element.children) {
    if (node instanceof XmlText || node instanceof XmlCdata) text += node.text;
  }
  return text;
}

/** Concatenated text of the whole subtree, in document order. */
export function deepText(element: XmlElement): string {
  let text = '';
  const walk = (node: XmlNode) => {
    if (node instanceof XmlText || node instanceof XmlCdata) text += node.text;
    else if (node instanceof XmlElement) node.children.forEach(walk);
  };
  element.children.forEach(walk);
  return text;
}
