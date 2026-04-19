export type Position = 'ARQ' | 'DFC' | 'LI' | 'LD' | 'MCD' | 'MC' | 'MCO' | 'ED' | 'EI' | 'DC';

export interface Player {
  id: string;
  name: string;
  number: number;
  position: Position;
  photoUrl: string;
  pitchX: number;
  pitchY: number;
  isOnPitch: boolean;
}

export interface Formation {
  name: string;
  positions: { x: number; y: number; pos: Position }[];
  isCustom?: boolean;
}

export interface TacticalArrow {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  style: 'solid' | 'dashed' | 'curved';
}

export interface OpponentMarker {
  id: string;
  x: number;
  y: number;
}

/** Copia nombrada en la nube (lista en panel "Tácticas guardadas"). */
export interface SavedTacticMeta {
  id: string;
  name: string;
  savedAt: string;
}

/** Estado completo de una táctica (pizarra + formación). */
export interface TacticSnapshot {
  players: Player[];
  arrows: TacticalArrow[];
  opponents: OpponentMarker[];
  formation: string;
  customFormations: Formation[];
}
