// What drawing in SVG takes: its namespace, and a shape put into another.

export const SVG_NS = 'http://www.w3.org/2000/svg';

/** Makes a shape with these attributes and text, and puts it at the end of `parent`. */
export function el(parent: Element, tag: string, attrs: Record<string, string | number> = {}, text?: string): SVGElement {
  const e = document.createElementNS(SVG_NS, tag);
  for (const a in attrs) e.setAttribute(a, String(attrs[a]));
  if (text != null) e.textContent = text;
  parent.appendChild(e);
  return e;
}
