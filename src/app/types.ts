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
  /** Curva: lado del arco (+1/-1). Omitido = fórmula antigua (compat. tácticas guardadas). */
  curveBend?: 1 | -1;
}

export interface OpponentMarker {
  id: string;
  x: number;
  y: number;
}

/** Trazo libre tipo láser en la pizarra. */
export interface LaserStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
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
  laserStrokes?: LaserStroke[];
  /** Dorsal en campo; debe ser id de un jugador con isOnPitch */
  captainPlayerId?: string | null;
}
