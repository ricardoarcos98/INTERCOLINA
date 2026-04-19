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

/**
 * html-to-image puede omitir <img> dentro de contenedores redondos con overflow-hidden.
 * Como fallback de export, pintamos la foto como background del token y ocultamos el <img>.
 */
export function bakeTokenImagesForCapture(root: HTMLElement): () => void {
  const undo: Array<() => void> = [];

  root.querySelectorAll('.pitch-token-face img').forEach((node) => {
    const img = node as HTMLImageElement;
    const face = img.parentElement as HTMLElement | null;
    const src = img.currentSrc || img.src;
    if (!face || !src) return;
    // Solo "hornear" imágenes que ya están realmente cargadas.
    if (!(img.complete && img.naturalWidth > 0 && img.naturalHeight > 0)) return;

    const prevFace = {
      backgroundImage: face.style.backgroundImage,
      backgroundSize: face.style.backgroundSize,
      backgroundPosition: face.style.backgroundPosition,
      backgroundRepeat: face.style.backgroundRepeat,
    };
    const prevImg = {
      opacity: img.style.opacity,
      visibility: img.style.visibility,
      pointerEvents: img.style.pointerEvents,
    };

    face.style.backgroundImage = `url("${src.replace(/"/g, '\\"')}")`;
    face.style.backgroundSize = 'cover';
    face.style.backgroundPosition = 'center top';
    face.style.backgroundRepeat = 'no-repeat';

    img.style.opacity = '0';
    img.style.visibility = 'hidden';
    img.style.pointerEvents = 'none';

    undo.push(() => {
      face.style.backgroundImage = prevFace.backgroundImage;
      face.style.backgroundSize = prevFace.backgroundSize;
      face.style.backgroundPosition = prevFace.backgroundPosition;
      face.style.backgroundRepeat = prevFace.backgroundRepeat;

      img.style.opacity = prevImg.opacity;
      img.style.visibility = prevImg.visibility;
      img.style.pointerEvents = prevImg.pointerEvents;
    });
  });

  return () => undo.reverse().forEach((fn) => fn());
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/**
 * html-to-image a veces no puede re-leer `blob:` urls o imágenes que ya están en memoria,
 * y termina dejando el <img> vacío en el PNG. Esto convierte las imágenes visibles a `data:`.
 *
 * Nota: para `http(s)` depende de CORS. Para `blob:` y `data:` funciona siempre.
 */
export async function inlinePitchImagesForCapture(
  root: HTMLElement,
  opts?: { proxyBase?: string },
): Promise<() => void> {
  const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
  const undo: Array<() => void> = [];

  const fetchAsBlob = async (url: string): Promise<Blob | null> => {
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  };

  await Promise.all(
    imgs.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith('data:')) return;

      // Solo nos interesa el área de la cancha; si el <img> ni siquiera cargó, no bloqueamos.
      try {
        const prev = { src: img.src, srcset: img.srcset };
        undo.push(() => {
          img.srcset = prev.srcset;
          img.src = prev.src;
        });

        // Evita que el browser intente usar srcset durante el clon.
        img.srcset = '';

        let blob = await fetchAsBlob(src);
        if (!blob && opts?.proxyBase && /^https?:\/\//i.test(src)) {
          const proxied = `${opts.proxyBase.replace(/\/$/, '')}/image-proxy?url=${encodeURIComponent(src)}`;
          blob = await fetchAsBlob(proxied);
        }
        if (!blob) return;
        const dataUrl = await blobToDataUrl(blob);
        img.src = dataUrl;
        if (typeof img.decode === 'function') {
          try {
            await img.decode();
          } catch {
            // Si decode falla, dejamos que el flujo continúe.
          }
        }
      } catch {
        // Si falla (CORS o red), dejamos el src original.
      }
    }),
  );

  return () => undo.reverse().forEach((fn) => fn());
}

/**
 * Inline exclusivo para fotos de jugadores en cancha (.pitch-token-face img).
 * Devuelve cuántas logró convertir a data URL para validar captura segura.
 */
export async function inlineTokenFaceImagesForCapture(
  root: HTMLElement,
  opts?: { proxyBase?: string },
): Promise<{ undo: () => void; inlinedCount: number }> {
  const imgs = Array.from(root.querySelectorAll('.pitch-token-face img')) as HTMLImageElement[];
  const undo: Array<() => void> = [];
  let inlinedCount = 0;

  const fetchAsBlob = async (url: string): Promise<Blob | null> => {
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) return null;
      const ct = res.headers.get('content-type') || '';
      if (!ct.startsWith('image/')) return null;
      return await res.blob();
    } catch {
      return null;
    }
  };

  for (const img of imgs) {
    const src = img.currentSrc || img.src;
    if (!src || src.startsWith('data:')) {
      inlinedCount += src.startsWith('data:') ? 1 : 0;
      continue;
    }
    const prev = { src: img.src, srcset: img.srcset };
    let blob = await fetchAsBlob(src);
    if (!blob && opts?.proxyBase && /^https?:\/\//i.test(src)) {
      const proxied = `${opts.proxyBase.replace(/\/$/, '')}/image-proxy?url=${encodeURIComponent(src)}`;
      blob = await fetchAsBlob(proxied);
    }
    if (!blob) continue;
    const dataUrl = await blobToDataUrl(blob);
    undo.push(() => {
      img.srcset = prev.srcset;
      img.src = prev.src;
    });
    img.srcset = '';
    img.src = dataUrl;
    if (typeof img.decode === 'function') {
      try {
        await img.decode();
      } catch {
        // ignore
      }
    }
    inlinedCount += 1;
  }

  return { undo: () => undo.reverse().forEach((fn) => fn()), inlinedCount };
}

/**
 * html-to-image rasteriza antes de que las fotos terminen de pintar → caras vacías.
 * Espera load/decode de todos los <img> dentro del nodo de la cancha.
 */
export async function waitForPitchImages(
  root: HTMLElement,
  timeoutMs = 15000,
  minImageCount = 0,
): Promise<void> {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const started = Date.now();
  let imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];

  while (imgs.length < minImageCount && Date.now() - started < timeoutMs) {
    await sleep(60);
    imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
  }

  const one = async (img: HTMLImageElement) => {
    if (!img.src) return;
    const localStart = Date.now();
    while (Date.now() - localStart < timeoutMs) {
      if (img.complete && img.naturalHeight > 0 && img.naturalWidth > 0) {
        if (typeof img.decode === 'function') {
          try {
            await img.decode();
          } catch {
            // ignore decode errors
          }
        }
        return;
      }
      await sleep(50);
    }
  };

  await Promise.all(imgs.map(one));

  // Si el caller exige un mínimo, esperamos a que estén realmente cargadas.
  if (minImageCount > 0) {
    while (Date.now() - started < timeoutMs) {
      const loaded = Array.from(root.querySelectorAll('img')).filter(
        (im) => im.complete && im.naturalWidth > 0 && im.naturalHeight > 0,
      ).length;
      if (loaded >= minImageCount) break;
      await sleep(80);
    }
  }

  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

/**
 * Espera específicamente las imágenes de los tokens (caras de jugadores).
 * Evita falsos positivos por otros <img> del layout.
 */
export async function waitForTokenFaceImages(
  root: HTMLElement,
  expectedCount: number,
  timeoutMs = 15000,
): Promise<void> {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const tokenImgs = Array.from(root.querySelectorAll('.pitch-token-face img')) as HTMLImageElement[];
    const loaded = tokenImgs.filter((img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0).length;
    if (loaded >= expectedCount) return;
    await sleep(80);
  }
}
