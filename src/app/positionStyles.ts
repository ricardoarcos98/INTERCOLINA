import type { Position } from './types';

/** Línea de juego (4 colores: arquero, defensa, medios, delanteros). */
export type PositionLine = 'arq' | 'def' | 'mid' | 'fwd';

/** Orden estable para selects (posiciones concretas). */
export const POSITION_DISPLAY_ORDER: Position[] = [
  'ARQ', 'DFC', 'LI', 'LD', 'MCD', 'MC', 'MCO', 'ED', 'EI', 'DC',
];

export function positionLine(pos: Position): PositionLine {
  switch (pos) {
    case 'ARQ':
      return 'arq';
    case 'DFC':
    case 'LI':
    case 'LD':
      return 'def';
    case 'MCD':
    case 'MC':
    case 'MCO':
      return 'mid';
    case 'ED':
    case 'EI':
    case 'DC':
      return 'fwd';
    default:
      return 'def';
  }
}

const LINE_BADGE: Record<PositionLine, string> = {
  arq: 'bg-orange-500/20 text-orange-400',
  def: 'bg-blue-500/20 text-blue-400',
  mid: 'bg-emerald-500/20 text-emerald-400',
  fwd: 'bg-red-500/20 text-red-400',
};

const LINE_DOT: Record<PositionLine, { color: string; shadow: string }> = {
  arq: { color: 'bg-orange-500', shadow: 'rgba(249,115,22,0.5)' },
  def: { color: 'bg-blue-500', shadow: 'rgba(59,130,246,0.5)' },
  mid: { color: 'bg-emerald-500', shadow: 'rgba(16,185,129,0.5)' },
  fwd: { color: 'bg-red-500', shadow: 'rgba(239,68,68,0.5)' },
};

const LINE_BORDER: Record<PositionLine, string> = {
  arq: 'border-orange-400 border-[2.5px] md:border-[3px]',
  def: 'border-blue-400 border-[2.5px] md:border-[3px]',
  mid: 'border-emerald-400 border-[2.5px] md:border-[3px]',
  fwd: 'border-red-400 border-[2.5px] md:border-[3px]',
};

/** Badge en sidebar / listas (mismo criterio que borde en cancha). */
export function positionBadgeClasses(pos: Position): string {
  return LINE_BADGE[positionLine(pos)] ?? 'bg-gray-500/20 text-gray-400';
}

/** Punto sólido + glow (por posición → misma línea). */
export function positionLegendSwatch(pos: Position): { color: string; shadow: string } {
  return LINE_DOT[positionLine(pos)] ?? LINE_DOT.def;
}

/** Borde del token en cancha (sin ring selección / cambio). */
export function positionTokenBorderClasses(pos: Position): string {
  return LINE_BORDER[positionLine(pos)] ?? 'border-white/80 border-[2.5px] md:border-[3px]';
}

/** Filas de leyenda: 4 colores alineados con cancha y sidebar. */
export const LINE_LEGEND: readonly { line: PositionLine; title: string; roles: string }[] = [
  { line: 'arq', title: 'Arquero', roles: 'ARQ' },
  { line: 'def', title: 'Defensa', roles: 'DFC · LI · LD' },
  { line: 'mid', title: 'Medios', roles: 'MCD · MC · MCO' },
  { line: 'fwd', title: 'Delanteros', roles: 'EI · ED · DC' },
] as const;

export function lineLegendSwatch(line: PositionLine): { color: string; shadow: string } {
  return LINE_DOT[line];
}
