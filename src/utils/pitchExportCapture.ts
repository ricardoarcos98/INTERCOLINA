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

  let undone = false;
  return () => {
    if (undone) return;
    undone = true;
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

  let undone = false;
  return () => {
    if (undone) return;
    undone = true;
    undo.reverse().forEach((fn) => fn());
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function guessImageMimeFromUrl(url: string): string {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
}

async function normalizeBlobToImage(blob: Blob, sourceUrl: string): Promise<Blob> {
  if (blob.type.startsWith('image/')) return blob;
  const bytes = await blob.arrayBuffer();
  return new Blob([bytes], { type: guessImageMimeFromUrl(sourceUrl) });
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

  let undone = false;
  return () => {
    if (undone) return;
    undone = true;
    undo.reverse().forEach((fn) => fn());
  };
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
      if (!res.ok) {
        console.warn('[inline-token] fetch non-ok', res.status, url.slice(0, 120));
        return null;
      }
      const blob = await res.blob();
      if (blob.size === 0) {
        console.warn('[inline-token] empty blob', url.slice(0, 120));
        return null;
      }
      return blob;
    } catch (err) {
      console.warn('[inline-token] fetch threw', url.slice(0, 120), err);
      return null;
    }
  };

  for (const img of imgs) {
    const src = img.currentSrc || img.src;
    if (!src) continue;
    if (src.startsWith('data:')) {
      inlinedCount += 1;
      continue;
    }
    const prev = { src: img.src, srcset: img.srcset };
    let blob = await fetchAsBlob(src);
    if (!blob && opts?.proxyBase && /^https?:\/\//i.test(src)) {
      const proxied = `${opts.proxyBase.replace(/\/$/, '')}/image-proxy?url=${encodeURIComponent(src)}`;
      if (proxied !== src) {
        blob = await fetchAsBlob(proxied);
      }
    }
    if (!blob) {
      console.warn('[inline-token] giving up on', src.slice(0, 120));
      continue;
    }
    const imageBlob = await normalizeBlobToImage(blob, src);
    const dataUrl = await blobToDataUrl(imageBlob);
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

  let undone = false;
  const run = () => {
    if (undone) return;
    undone = true;
    undo.reverse().forEach((fn) => fn());
  };
  return { undo: run, inlinedCount };
}

/**
 * Fallback fuerte para Safari: "hornea" la cara del token como background data URL
 * y oculta el <img>. Evita pérdidas al rasterizar máscaras redondas + overflow-hidden.
 */
export async function bakeTokenFacesAsDataUrlForCapture(
  root: HTMLElement,
  opts?: { proxyBase?: string },
): Promise<{ undo: () => void; bakedCount: number }> {
  const imgs = Array.from(root.querySelectorAll('.pitch-token-face img')) as HTMLImageElement[];
  const undo: Array<() => void> = [];
  let bakedCount = 0;

  const fetchAsBlob = async (url: string): Promise<Blob | null> => {
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (blob.size === 0) return null;
      return blob;
    } catch {
      return null;
    }
  };

  for (const img of imgs) {
    const face = img.parentElement as HTMLElement | null;
    const src = img.currentSrc || img.src;
    if (!face || !src) continue;

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

    let blob = await fetchAsBlob(src);
    if (!blob && opts?.proxyBase && /^https?:\/\//i.test(src)) {
      const proxied = `${opts.proxyBase.replace(/\/$/, '')}/image-proxy?url=${encodeURIComponent(src)}`;
      if (proxied !== src) blob = await fetchAsBlob(proxied);
    }
    if (!blob) continue;

    const imageBlob = await normalizeBlobToImage(blob, src);
    const dataUrl = await blobToDataUrl(imageBlob);
    face.style.backgroundImage = `url("${dataUrl.replace(/"/g, '\\"')}")`;
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
    bakedCount += 1;
  }

  let undone = false;
  return {
    undo: () => {
      if (undone) return;
      undone = true;
      undo.reverse().forEach((fn) => fn());
    },
    bakedCount,
  };
}

/**
 * Reemplaza temporalmente cada <img> de los tokens por un <canvas> con la foto ya pintada
 * como círculo. html2canvas nunca falla con <canvas> (ya son píxeles), y así evitamos el
 * bug de Safari con overflow-hidden + rounded-full + <img>.
 */
export async function paintTokenFacesToCanvasForCapture(
  root: HTMLElement,
  opts?: { proxyBase?: string },
): Promise<{ undo: () => void; paintedCount: number }> {
  const imgs = Array.from(root.querySelectorAll('.pitch-token-face img')) as HTMLImageElement[];
  const undo: Array<() => void> = [];
  let paintedCount = 0;

  const fetchAsBlob = async (url: string): Promise<Blob | null> => {
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (blob.size === 0) return null;
      return blob;
    } catch {
      return null;
    }
  };

  const loadImage = (src: string): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const im = new Image();
      im.decoding = 'sync';
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });

  for (const img of imgs) {
    const face = img.parentElement as HTMLElement | null;
    const src = img.currentSrc || img.src;
    if (!face || !src) continue;

    let blob = await fetchAsBlob(src);
    if (!blob && opts?.proxyBase && /^https?:\/\//i.test(src)) {
      const proxied = `${opts.proxyBase.replace(/\/$/, '')}/image-proxy?url=${encodeURIComponent(src)}`;
      if (proxied !== src) blob = await fetchAsBlob(proxied);
    }
    if (!blob) continue;

    const imageBlob = await normalizeBlobToImage(blob, src);
    const dataUrl = await blobToDataUrl(imageBlob);
    const loaded = await loadImage(dataUrl);
    if (!loaded) continue;

    const rect = img.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    // Canvas por foto en 4x: html2canvas luego multiplica otra vez por su propia
    // escala, pero tenerlo nativo evita reescalado con pérdida si html2canvas decide
    // samplearlo a 1:1. Suficiente para cualquier export hasta 3x sin pixelado.
    const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const baseScale = Math.max(window.devicePixelRatio || 1, isMobileUA ? 3 : 4);

    const canvas = document.createElement('canvas');
    canvas.width = w * baseScale;
    canvas.height = h * baseScale;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';
    canvas.className = img.className;
    canvas.setAttribute('data-baked-token-face', '1');

    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(baseScale, baseScale);

    const iw = loaded.naturalWidth || loaded.width;
    const ih = loaded.naturalHeight || loaded.height;
    if (iw > 0 && ih > 0) {
      const scaleCover = Math.max(w / iw, h / ih);
      const drawW = iw * scaleCover;
      const drawH = ih * scaleCover;
      const dx = (w - drawW) / 2;
      const dy = 0;
      ctx.drawImage(loaded, dx, dy, drawW, drawH);
    }

    const prevImgStyle = {
      display: img.style.display,
      visibility: img.style.visibility,
      opacity: img.style.opacity,
    };
    img.style.display = 'none';
    img.style.visibility = 'hidden';
    img.style.opacity = '0';
    face.insertBefore(canvas, img);

    undo.push(() => {
      if (canvas.parentElement === face) face.removeChild(canvas);
      img.style.display = prevImgStyle.display;
      img.style.visibility = prevImgStyle.visibility;
      img.style.opacity = prevImgStyle.opacity;
    });
    paintedCount += 1;
  }

  let undone = false;
  return {
    undo: () => {
      if (undone) return;
      undone = true;
      undo.reverse().forEach((fn) => fn());
    },
    paintedCount,
  };
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
