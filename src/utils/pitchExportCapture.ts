/**
 * html-to-image copia getComputedStyle → inline en el clon; las sombras y filtros
 * suelen rasterizarse como rectángulos. Forzar inline !important en el DOM real
 * justo antes del raster lo evita de forma fiable.
 */
export function preparePitchDomForCapture(root: HTMLElement): () => void {
  const revert: Array<() => void> = [];

  const styleOf = (el: Element): CSSStyleDeclaration | null => {
    if (el instanceof HTMLElement || el instanceof SVGElement) return el.style;
    return null;
  };

  const set = (el: Element, prop: string, val: string) => {
    const st = styleOf(el);
    if (!st) return;
    const prev = st.getPropertyValue(prop);
    const prio = st.getPropertyPriority(prop);
    st.setProperty(prop, val, 'important');
    revert.push(() => {
      st.removeProperty(prop);
      if (prev) st.setProperty(prop, prev, prio as '' | 'important');
    });
  };

  const flattenPaint = (el: Element) => {
    set(el, 'box-shadow', 'none');
    set(el, 'filter', 'none');
    set(el, '-webkit-filter', 'none');
    set(el, 'backdrop-filter', 'none');
    set(el, '-webkit-backdrop-filter', 'none');
    set(el, 'text-shadow', 'none');
    set(el, 'outline', 'none');
  };

  set(root, 'box-shadow', 'none');

  root.querySelectorAll('.pitch-token-ground').forEach((el) => set(el, 'display', 'none'));

  root.querySelectorAll('[data-clean-capture]').forEach(flattenPaint);

  root.querySelectorAll('.pitch-player-token').forEach((el) => {
    set(el, 'filter', 'none');
    set(el, '-webkit-filter', 'none');
  });

  root.querySelectorAll('.pitch-laser-svg path').forEach((el) => set(el, 'filter', 'none'));

  root.querySelectorAll('.pitch-token-face').forEach((el) => set(el, 'transform', 'scale(1)'));

  return () => {
    revert.reverse().forEach((fn) => fn());
  };
}
