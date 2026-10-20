// Small sums of the view: a number as an attribute writes it, a number held between two others, an ease, and the box around boxes. They use nothing of one view.


export const r2 = (n: number): string => String(Math.round(n * 100) / 100);

export const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

export const ease = (p: number): number => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export const union = (rs: DOMRect[]): DOMRect => {
  const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top));
  return new DOMRect(l, t, Math.max(...rs.map(r => r.right)) - l, Math.max(...rs.map(r => r.bottom)) - t);
};
