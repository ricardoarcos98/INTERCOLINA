import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toPng } from 'html-to-image';
import html2canvas from 'html2canvas-pro';
import { Player, Position, Formation, TacticalArrow, OpponentMarker, TacticSnapshot, LaserStroke } from './types';
import { Pitch, PitchTool } from './components/Pitch';
import { Sidebar } from './components/Sidebar';
import { SavedTacticsPanel } from './components/SavedTacticsPanel';
import { CoachCard } from './components/CoachCard';
import { ThemeProvider, useTheme, GRASS_COLORS, GRASS_CUT_OPTIONS } from './components/ThemeContext';
import { Toaster, toast } from 'sonner';
import {
  Sun, Moon, Palette, Download, Pencil, PenLine, Trash2, Minus, Spline, CornerDownRight,
  Menu, Move, Circle, Plus, X, ChevronDown, ChevronUp, Save, Cloud, Loader2,
  Sparkles, ScanEye, Lock, Unlock, ChevronsLeft, ChevronsRight, LogIn,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import {
  paintTokenFacesToCanvasForCapture,
  preparePitchDomForCapture,
  waitForTokenFaceImages,
} from '../utils/pitchExportCapture';
import { LINE_LEGEND, POSITION_DISPLAY_ORDER, lineLegendSwatch } from './positionStyles';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-f6cf3a30`;
const TACTIC_KEY = 'tactic-main';
const EDIT_PIN = '131298';
const EDIT_UNLOCK_SESSION_KEY = 'intercolina-edit-unlock';
const COACH_STORAGE_KEY = 'intercolina-coach-v1';
const CAPTAIN_STORAGE_KEY = 'intercolina-captain-v1';

const INITIAL_PLAYERS: Player[] = [
  // --- 11 Titulares (4-3-3) ---
  { id:'1',name:'Mateo Osorio Correa',number:1,position:'ARQ',photoUrl:'',pitchX:50,pitchY:90,isOnPitch:true },
  { id:'2',name:'Andrés Alvarado López',number:23,position:'LD',photoUrl:'',pitchX:85,pitchY:70,isOnPitch:true },
  { id:'3',name:'Felipe Espinosa Z.',number:21,position:'DFC',photoUrl:'',pitchX:62,pitchY:75,isOnPitch:true },
  { id:'4',name:'Orlando Alvarado Cruz',number:2,position:'DFC',photoUrl:'',pitchX:38,pitchY:75,isOnPitch:true },
  { id:'5',name:'Daniel Hurtado',number:24,position:'LI',photoUrl:'',pitchX:15,pitchY:70,isOnPitch:true },
  { id:'6',name:'Andres Malagon Oñate',number:10,position:'MC',photoUrl:'',pitchX:30,pitchY:50,isOnPitch:true },
  { id:'7',name:'Ricardo Arcos Lucero',number:13,position:'MC',photoUrl:'',pitchX:70,pitchY:50,isOnPitch:true },
  { id:'8',name:'Juan Pablo Morales V.',number:6,position:'MCD',photoUrl:'',pitchX:50,pitchY:60,isOnPitch:true },
  { id:'9',name:'David Vasquez Tirado',number:9,position:'ED',photoUrl:'',pitchX:80,pitchY:25,isOnPitch:true },
  { id:'10',name:'Darío González P.',number:7,position:'DC',photoUrl:'',pitchX:50,pitchY:18,isOnPitch:true },
  { id:'11',name:'Andres Medina Chapeta',number:77,position:'EI',photoUrl:'',pitchX:20,pitchY:25,isOnPitch:true },
  // --- Suplentes ---
  { id:'12',name:'Juan Camilo Valverde T.',number:11,position:'MC',photoUrl:'',pitchX:50,pitchY:50,isOnPitch:false },
  { id:'13',name:'Álvaro Melo Muñoz',number:12,position:'DFC',photoUrl:'',pitchX:50,pitchY:50,isOnPitch:false },
  { id:'14',name:'Javier Prieto Castro',number:100,position:'MC',photoUrl:'',pitchX:50,pitchY:50,isOnPitch:false },
  { id:'15',name:'Marcelo Curico Noriega',number:3,position:'DC',photoUrl:'',pitchX:50,pitchY:50,isOnPitch:false },
  { id:'16',name:'Daniel Caicedo Narváez',number:5,position:'MC',photoUrl:'',pitchX:50,pitchY:50,isOnPitch:false },
  { id:'17',name:'Yordan Caicedo García',number:16,position:'MC',photoUrl:'',pitchX:50,pitchY:50,isOnPitch:false },
  { id:'18',name:'Juan S. Cuéllar G.',number:8,position:'DC',photoUrl:'',pitchX:50,pitchY:50,isOnPitch:false },
  { id:'19',name:'Joshua Medina',number:79,position:'ED',photoUrl:'',pitchX:50,pitchY:50,isOnPitch:false },
  { id:'20',name:'Camilo Castillejo',number:30,position:'MC',photoUrl:'',pitchX:50,pitchY:50,isOnPitch:false },
  { id:'21',name:'Álvaro Moreno',number:26,position:'DC',photoUrl:'',pitchX:50,pitchY:50,isOnPitch:false },
  { id:'22',name:'Jhon Eider Leudo',number:19,position:'DC',photoUrl:'',pitchX:50,pitchY:50,isOnPitch:false },
  { id:'23',name:'Miguel Cubillos Ayala',number:32,position:'DFC',photoUrl:'',pitchX:50,pitchY:50,isOnPitch:false },
  { id:'24',name:'Oscar Rodríguez Plaza',number:27,position:'MC',photoUrl:'',pitchX:50,pitchY:50,isOnPitch:false },
];

export const POSITION_LABELS: Record<Position, string> = {
  ARQ: 'Arquero', DFC: 'Defensa Central', LI: 'Lateral Izq.', LD: 'Lateral Der.',
  MCD: 'Medio Centro Def.', MC: 'Medio Centro', MCO: 'Medio Centro Of.',
  ED: 'Extremo Der.', EI: 'Extremo Izq.', DC: 'Delantero Centro',
};

const shortPlayerName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[1][0]}.`;
};

/** Expulsado no puede estar en cancha; normaliza datos de API / copias. */
function normalizePlayersFromApi(list: Player[]): Player[] {
  return list.map((p) => {
    const isSentOff = !!(p as Player & { isSentOff?: boolean }).isSentOff;
    return {
      ...p,
      isSentOff,
      isOnPitch: isSentOff ? false : p.isOnPitch,
      isCalledUp: p.isCalledUp ?? (!p.isOnPitch && !isSentOff),
    };
  });
}

// Helpers
const F = (name: string, p: Formation['positions']): Formation => ({ name, positions: [{ x: 50, y: 90, pos: 'ARQ' as Position }, ...p] });
const LI_ = (x: number, y: number): { x: number; y: number; pos: Position } => ({ x, y, pos: 'LI' });
const LD_ = (x: number, y: number): { x: number; y: number; pos: Position } => ({ x, y, pos: 'LD' });
const DFC_ = (x: number, y: number): { x: number; y: number; pos: Position } => ({ x, y, pos: 'DFC' });
const MCD_ = (x: number, y: number): { x: number; y: number; pos: Position } => ({ x, y, pos: 'MCD' });
const MC_ = (x: number, y: number): { x: number; y: number; pos: Position } => ({ x, y, pos: 'MC' });
const MCO_ = (x: number, y: number): { x: number; y: number; pos: Position } => ({ x, y, pos: 'MCO' });
const EI_ = (x: number, y: number): { x: number; y: number; pos: Position } => ({ x, y, pos: 'EI' });
const ED_ = (x: number, y: number): { x: number; y: number; pos: Position } => ({ x, y, pos: 'ED' });
const DC_ = (x: number, y: number): { x: number; y: number; pos: Position } => ({ x, y, pos: 'DC' });

export const FORMATIONS: Formation[] = [
  // 4 defensas
  F('4-4-2', [LI_(15,70),DFC_(38,75),DFC_(62,75),LD_(85,70), EI_(15,48),MC_(38,52),MC_(62,52),ED_(85,48), DC_(35,22),DC_(65,22)]),
  F('4-3-3', [LI_(15,70),DFC_(38,75),DFC_(62,75),LD_(85,70), MC_(30,50),MCD_(50,55),MC_(70,50), EI_(20,25),DC_(50,18),ED_(80,25)]),
  F('4-2-3-1', [LI_(15,72),DFC_(38,76),DFC_(62,76),LD_(85,72), MCD_(35,58),MCD_(65,58), EI_(20,38),MCO_(50,35),ED_(80,38), DC_(50,18)]),
  F('4-1-4-1', [LI_(15,72),DFC_(38,76),DFC_(62,76),LD_(85,72), MCD_(50,60), EI_(15,42),MC_(38,45),MC_(62,45),ED_(85,42), DC_(50,18)]),
  F('4-3-2-1', [LI_(15,72),DFC_(38,76),DFC_(62,76),LD_(85,72), MC_(30,58),MCD_(50,62),MC_(70,58), MCO_(35,38),MCO_(65,38), DC_(50,18)]),
  F('4-4-1-1', [LI_(15,70),DFC_(38,75),DFC_(62,75),LD_(85,70), EI_(15,50),MC_(38,54),MC_(62,54),ED_(85,50), MCO_(50,32),DC_(50,18)]),
  F('4-1-2-1-2', [LI_(15,72),DFC_(38,76),DFC_(62,76),LD_(85,72), MCD_(50,62), MC_(30,48),MC_(70,48), MCO_(50,35), DC_(35,20),DC_(65,20)]),
  F('4-2-4', [LI_(15,72),DFC_(38,76),DFC_(62,76),LD_(85,72), MCD_(35,55),MCD_(65,55), EI_(15,28),DC_(40,22),DC_(60,22),ED_(85,28)]),
  F('4-5-1', [LI_(15,70),DFC_(38,75),DFC_(62,75),LD_(85,70), EI_(10,48),MC_(30,52),MCD_(50,48),MC_(70,52),ED_(90,48), DC_(50,18)]),
  // 3 defensas
  F('3-5-2', [DFC_(25,75),DFC_(50,78),DFC_(75,75), EI_(10,50),MC_(30,55),MCD_(50,48),MC_(70,55),ED_(90,50), DC_(35,22),DC_(65,22)]),
  F('3-4-3', [DFC_(25,75),DFC_(50,78),DFC_(75,75), EI_(15,50),MC_(40,55),MC_(60,55),ED_(85,50), EI_(20,25),DC_(50,18),ED_(80,25)]),
  F('3-4-2-1', [DFC_(25,75),DFC_(50,78),DFC_(75,75), EI_(15,55),MC_(40,58),MC_(60,58),ED_(85,55), MCO_(35,38),MCO_(65,38), DC_(50,18)]),
  F('3-4-1-2', [DFC_(25,75),DFC_(50,78),DFC_(75,75), EI_(15,55),MC_(40,58),MC_(60,58),ED_(85,55), MCO_(50,38), DC_(35,20),DC_(65,20)]),
  F('3-3-4', [DFC_(25,75),DFC_(50,78),DFC_(75,75), MC_(25,52),MCD_(50,48),MC_(75,52), EI_(15,28),DC_(40,22),DC_(60,22),ED_(85,28)]),
  F('3-1-4-2', [DFC_(25,75),DFC_(50,78),DFC_(75,75), MCD_(50,62), EI_(15,45),MC_(38,48),MC_(62,48),ED_(85,45), DC_(35,22),DC_(65,22)]),
  // 5 defensas
  F('5-3-2', [LI_(10,68),DFC_(30,75),DFC_(50,78),DFC_(70,75),LD_(90,68), MC_(30,50),MCD_(50,48),MC_(70,50), DC_(35,22),DC_(65,22)]),
  F('5-4-1', [LI_(10,68),DFC_(30,75),DFC_(50,78),DFC_(70,75),LD_(90,68), EI_(20,48),MC_(40,52),MC_(60,52),ED_(80,48), DC_(50,18)]),
  F('5-2-3', [LI_(10,68),DFC_(30,75),DFC_(50,78),DFC_(70,75),LD_(90,68), MCD_(35,50),MCD_(65,50), EI_(20,25),DC_(50,18),ED_(80,25)]),
  F('5-2-1-2', [LI_(10,68),DFC_(30,75),DFC_(50,78),DFC_(70,75),LD_(90,68), MCD_(35,52),MCD_(65,52), MCO_(50,38), DC_(35,20),DC_(65,20)]),
];

const ARROW_COLORS = ['#facc15', '#ef4444', '#3b82f6', '#10b981', '#f97316', '#ffffff'];

type TacticalToolbarProps = {
  variant: 'rail' | 'mobile' | 'dock';
  btn: (active?: boolean) => string;
  isDark: boolean;
  activeTool: PitchTool;
  setActiveTool: (t: PitchTool) => void;
  arrowStyle: 'solid' | 'dashed' | 'curved';
  setArrowStyle: (s: 'solid' | 'dashed' | 'curved') => void;
  arrowColor: string;
  setArrowColor: (c: string) => void;
  setArrows: React.Dispatch<React.SetStateAction<TacticalArrow[]>>;
  setOpponents: React.Dispatch<React.SetStateAction<OpponentMarker[]>>;
  laserStrokes: LaserStroke[];
  setLaserStrokes: React.Dispatch<React.SetStateAction<LaserStroke[]>>;
  /** off = todas; full = candado en vista completa; laser-only = modo foco con candado (solo láser). */
  toolLock?: 'off' | 'full' | 'laser-only';
};

type BenchPreviewProps = {
  players: Player[];
  editablePlayers: Player[];
  isDark: boolean;
  mutedClass: string;
  selectedPlayerId: string | null;
  substitutionTargetId: string | null;
  substitutionTargetName?: string;
  substitutionTargetPosition?: Position;
  onSelectPlayer: (id: string) => void;
  onSendToPitch: (id: string) => void;
  onSubstitution: (onPitchId: string, benchId: string) => void;
  onToggleCalledUp: (id: string) => void;
  canSendToPitch: boolean;
  editLocked: boolean;
  compact?: boolean;
};

type MatchStaffBandProps = {
  isDark: boolean;
  mutedClass: string;
  coachPhotoUrl: string;
  coachName: string;
  players: Player[];
  editablePlayers: Player[];
  selectedPlayerId: string | null;
  substitutionTargetId: string | null;
  substitutionTargetName?: string;
  substitutionTargetPosition?: Position;
  onSelectPlayer: (id: string) => void;
  onSendToPitch: (id: string) => void;
  onSubstitution: (onPitchId: string, benchId: string) => void;
  onToggleCalledUp: (id: string) => void;
  canSendToPitch: boolean;
  editLocked: boolean;
  onClose?: () => void;
};

function BenchPreview({
  players,
  editablePlayers,
  isDark,
  mutedClass,
  selectedPlayerId,
  substitutionTargetId,
  substitutionTargetName,
  substitutionTargetPosition,
  onSelectPlayer,
  onSendToPitch,
  onSubstitution,
  onToggleCalledUp,
  canSendToPitch,
  editLocked,
  compact = false,
}: BenchPreviewProps) {
  const [editing, setEditing] = useState(false);
  const panel = isDark ? 'border-white/10 bg-slate-900/55' : 'border-gray-200 bg-white/85';
  const chip = isDark ? 'border-white/10 bg-slate-950/50 hover:bg-white/10' : 'border-gray-200 bg-white hover:bg-emerald-50';
  const source = [...(editing ? editablePlayers : players)].sort((a, b) => {
    const aRecommended = substitutionTargetPosition && a.position === substitutionTargetPosition ? 0 : 1;
    const bRecommended = substitutionTargetPosition && b.position === substitutionTargetPosition ? 0 : 1;
    if (aRecommended !== bRecommended) return aRecommended - bRecommended;
    const byPosition = POSITION_DISPLAY_ORDER.indexOf(a.position) - POSITION_DISPLAY_ORDER.indexOf(b.position);
    if (byPosition !== 0) return byPosition;
    return a.name.localeCompare(b.name, 'es');
  });
  const matchingCount = substitutionTargetPosition
    ? players.filter((p) => p.position === substitutionTargetPosition).length
    : 0;
  const emptyMessage = editing
    ? 'No hay jugadores disponibles fuera del campo.'
    : 'Sin convocados. Pulsa el lápiz para elegirlos.';

  return (
    <section className={`w-full rounded-lg border p-3 backdrop-blur-md ${panel}`}>
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className={`truncate text-[10px] font-black uppercase tracking-widest ${mutedClass}`}>Convocados</h3>
          {!editing && substitutionTargetName && (
            <p className="mt-1 max-w-full truncate text-[10px] font-black text-amber-400">
              Sale {shortPlayerName(substitutionTargetName)}
              {substitutionTargetPosition ? ` · ${matchingCount} para ${substitutionTargetPosition}` : ''}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black text-emerald-400">
            {editing ? editablePlayers.length : players.length}
          </span>
          <button
            type="button"
            disabled={editLocked}
            onClick={() => setEditing((v) => !v)}
            className={`rounded-md p-1.5 transition-colors ${editLocked ? 'cursor-not-allowed opacity-35' : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/25'}`}
            title={editLocked ? 'Desbloquea para editar convocados' : editing ? 'Terminar edición' : 'Editar convocados'}
          >
            {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      {source.length === 0 ? (
        <p className={`text-[10px] ${mutedClass}`}>{emptyMessage}</p>
      ) : (
        <div className={`grid grid-cols-3 gap-2 overflow-y-auto pr-1 ${compact ? 'max-h-[34dvh]' : 'max-h-[min(54dvh,500px)]'}`}>
          {source.map((p) => {
            const selected = selectedPlayerId === p.id;
            const calledUp = p.isCalledUp ?? (!p.isOnPitch && !p.isSentOff);
            const recommended = !!substitutionTargetPosition && p.position === substitutionTargetPosition;
            const canSubstitute = !!substitutionTargetId;
            const canDirectSend = canSendToPitch && !canSubstitute;
            const canUseBenchPlayer = !editLocked && (canDirectSend || canSubstitute);
            const actionTitle = editLocked
              ? 'Desbloquea para cambiar convocados'
              : canDirectSend
                ? 'Enviar al campo'
                : canSubstitute
                  ? `Entra por ${substitutionTargetName || 'titular seleccionado'}`
                  : 'Toca un titular en la cancha para ver recomendaciones';
            return (
              <div
                key={p.id}
                className={`min-w-0 rounded-xl border p-1.5 text-center transition-colors ${chip} ${
                  selected ? 'ring-1 ring-amber-400/80' : recommended ? 'border-emerald-400/70 bg-emerald-500/10' : ''
                }`}
              >
                <button type="button" onClick={() => onSelectPlayer(p.id)} className="flex w-full min-w-0 flex-col items-center gap-1" title={p.name}>
                  <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 text-[10px] font-black text-slate-100">
                    {p.photoUrl ? <img src={p.photoUrl} alt="" className="h-full w-full object-cover" draggable={false} /> : p.number}
                    {recommended && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-slate-900" />}
                  </span>
                  <span
                    className={`min-h-[1.65rem] w-full overflow-hidden break-words text-[10px] font-bold leading-[0.82rem] ${isDark ? 'text-slate-100' : 'text-gray-800'}`}
                    style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                  >
                    {shortPlayerName(p.name)}
                  </span>
                  <span className={`max-w-full truncate rounded-full px-1.5 py-0.5 text-[9px] font-black ${recommended ? 'bg-emerald-500/20 text-emerald-400' : mutedClass}`}>
                    {p.position}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={editing ? editLocked : !canUseBenchPlayer}
                  onClick={() => {
                    if (editing) {
                      onToggleCalledUp(p.id);
                      return;
                    }
                    if (canSubstitute && substitutionTargetId) {
                      onSubstitution(substitutionTargetId, p.id);
                      return;
                    }
                    if (canDirectSend) onSendToPitch(p.id);
                  }}
                  className={`mt-1 flex w-full items-center justify-center rounded-lg px-1.5 py-1 text-[9px] font-black transition-colors ${
                    editing
                      ? calledUp
                        ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                        : 'bg-slate-500/15 text-slate-400 hover:bg-slate-500/25'
                      : canUseBenchPlayer
                        ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                        : 'cursor-not-allowed bg-slate-500/10 text-slate-400 opacity-55'
                  }`}
                  title={editing ? (calledUp ? 'Quitar de convocados' : 'Agregar a convocados') : actionTitle}
                >
                  {editing ? (calledUp ? 'Conv.' : 'Fuera') : <LogIn className="h-3.5 w-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MatchStaffBand({
  isDark,
  mutedClass,
  coachPhotoUrl,
  coachName,
  players,
  editablePlayers,
  selectedPlayerId,
  substitutionTargetId,
  substitutionTargetName,
  substitutionTargetPosition,
  onSelectPlayer,
  onSendToPitch,
  onSubstitution,
  onToggleCalledUp,
  canSendToPitch,
  editLocked,
  onClose,
}: MatchStaffBandProps) {
  return (
    <aside className={`flex h-full min-h-0 w-full flex-col border-l ${isDark ? 'border-white/10 bg-slate-900/80' : 'border-gray-200 bg-white/88'} backdrop-blur-md`}>
      <div className={`flex items-center justify-between gap-2 border-b px-3 py-3 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <div className="min-w-0">
          <h2 className="text-xs font-black uppercase tracking-widest text-emerald-500">Banca</h2>
          <p className={`truncate text-[10px] ${mutedClass}`}>DT y convocados</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-500/10" title="Cerrar banda derecha">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mb-3">
          <CoachCard photoUrl={coachPhotoUrl} name={coachName} isDark={isDark} size="compact" layout="row" />
        </div>
        <BenchPreview
          players={players}
          editablePlayers={editablePlayers}
          isDark={isDark}
          mutedClass={mutedClass}
          selectedPlayerId={selectedPlayerId}
          substitutionTargetId={substitutionTargetId}
          substitutionTargetName={substitutionTargetName}
          substitutionTargetPosition={substitutionTargetPosition}
          onSelectPlayer={onSelectPlayer}
          onSendToPitch={onSendToPitch}
          onSubstitution={onSubstitution}
          onToggleCalledUp={onToggleCalledUp}
          canSendToPitch={canSendToPitch}
          editLocked={editLocked}
        />
      </div>
    </aside>
  );
}

function TacticalToolbar({
  variant,
  btn,
  isDark,
  activeTool,
  setActiveTool,
  arrowStyle,
  setArrowStyle,
  arrowColor,
  setArrowColor,
  setArrows,
  setOpponents,
  laserStrokes,
  setLaserStrokes,
  toolLock = 'off',
}: TacticalToolbarProps) {
  const lockFull = toolLock === 'full';
  const lockLaserOnly = toolLock === 'laser-only';
  const toolDisabled = (t: PitchTool) => lockFull || (lockLaserOnly && t !== 'laser');
  const verticalToolLayout = variant === 'rail' || variant === 'dock';
  const sep = (
    <div
      className={`shrink-0 ${verticalToolLayout ? `h-px w-6 ${isDark ? 'bg-white/10' : 'bg-gray-200'}` : `w-px h-7 self-center ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}`}
      aria-hidden
    />
  );

  const tools = (
    <>
      <button type="button" disabled={toolDisabled('move')} onClick={() => setActiveTool('move')} className={btn(activeTool === 'move')} title="Mover">
        <Move className="w-4 h-4" />
      </button>
      <button type="button" disabled={toolDisabled('draw')} onClick={() => setActiveTool('draw')} className={btn(activeTool === 'draw')} title="Flechas tácticas">
        <PenLine className="w-4 h-4" />
      </button>
      <button type="button" disabled={toolDisabled('opponent')} onClick={() => setActiveTool('opponent')} className={btn(activeTool === 'opponent')} title="Rivales">
        <Circle className="w-4 h-4" />
      </button>
      <button type="button" disabled={toolDisabled('laser')} onClick={() => setActiveTool('laser')} className={btn(activeTool === 'laser')} title="Láser (se borra solo, estilo Excalidraw)">
        <Sparkles className="w-4 h-4" />
      </button>
      <button type="button" disabled={toolDisabled('pen')} onClick={() => setActiveTool('pen')} className={btn(activeTool === 'pen')} title="Lápiz (marca fija en la planilla)">
        <Pencil className="w-4 h-4" />
      </button>
      <button type="button" disabled={toolDisabled('swap')} onClick={() => setActiveTool('swap')} className={btn(activeTool === 'swap')} title="Cambio por convocado">
        <LogIn className="w-4 h-4" />
      </button>
      {sep}
      <button type="button" disabled={lockFull || lockLaserOnly} onClick={() => setArrowStyle('solid')} className={btn(arrowStyle === 'solid')} title="Solida">
        <Minus className="w-4 h-4" />
      </button>
      <button type="button" disabled={lockFull || lockLaserOnly} onClick={() => setArrowStyle('dashed')} className={btn(arrowStyle === 'dashed')} title="Punteada">
        <span className="text-[10px] font-bold tracking-widest">--</span>
      </button>
      <button type="button" disabled={lockFull || lockLaserOnly} onClick={() => setArrowStyle('curved')} className={btn(arrowStyle === 'curved')} title="Curva">
        <Spline className="w-4 h-4" />
      </button>
      {sep}
      {ARROW_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          disabled={lockFull}
          onClick={() => setArrowColor(c)}
          className={`w-5 h-5 shrink-0 rounded-full border-2 hover:scale-110 transition-transform ${arrowColor === c ? 'border-white scale-110' : 'border-white/20'}`}
          style={{ backgroundColor: c }}
          title={c}
          aria-label={`Color de flecha ${c}`}
        />
      ))}
      {sep}
      <button
        type="button"
        disabled={lockFull || (lockLaserOnly && laserStrokes.length === 0)}
        onClick={() => {
          if (lockLaserOnly) {
            if (laserStrokes.length > 0) setLaserStrokes((ls) => ls.slice(0, -1));
            return;
          }
          if (laserStrokes.length > 0) setLaserStrokes((ls) => ls.slice(0, -1));
          else setArrows((p) => p.slice(0, -1));
        }}
        className={btn()}
        title="Deshacer último trazo de lápiz o flecha"
      >
        <CornerDownRight className="w-4 h-4 rotate-180" />
      </button>
      <button
        type="button"
        disabled={lockFull || (lockLaserOnly && laserStrokes.length === 0)}
        onClick={() => {
          if (lockLaserOnly) {
            setLaserStrokes([]);
            toast('Láser borrado');
            return;
          }
          setArrows([]);
          setOpponents([]);
          setLaserStrokes([]);
          toast('Limpiado');
        }}
        className={btn()}
        title="Limpiar todo"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </>
  );

  if (variant === 'dock') {
    return (
      <div
        className={`hidden md:flex shrink-0 flex-col items-center gap-1 md:gap-1.5 p-1 md:p-1.5 rounded-xl border z-20 self-start sticky top-2 touch-manipulation ${
          isDark ? 'bg-slate-900/90 border-white/10' : 'bg-white/95 border-gray-200'
        } shadow-lg backdrop-blur-sm ${lockFull ? 'opacity-50' : ''}`}
        role="toolbar"
        aria-label="Toolkit del entrenador"
      >
        {tools}
      </div>
    );
  }

  if (variant === 'rail') {
    return (
      <div
        className={`hidden md:flex absolute -left-12 md:-left-14 top-0 flex-col items-center gap-1 md:gap-1.5 p-1 md:p-1.5 rounded-xl border z-10 ${
          isDark ? 'bg-slate-900/80 border-white/10' : 'bg-white/90 border-gray-200'
        } backdrop-blur-sm ${lockFull ? 'opacity-50' : ''}`}
      >
        {tools}
      </div>
    );
  }

  return (
    <div
      className={`md:hidden w-full mb-2 flex flex-row flex-wrap items-center justify-center gap-1.5 p-2 rounded-xl border z-10 touch-manipulation ${
        isDark ? 'bg-slate-900/85 border-white/10' : 'bg-white/95 border-gray-200'
      } shadow-sm ${lockFull ? 'opacity-50' : ''}`}
    >
      {tools}
    </div>
  );
}

function AppContent() {
  const { isDark, toggleTheme, grassColor, setGrassColor, grassCut, setGrassCut } = useTheme();
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [currentFormation, setCurrentFormation] = useState('4-3-3');
  const [showGrassMenu, setShowGrassMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leftBandVisible, setLeftBandVisible] = useState(false);
  const [rightBandVisible, setRightBandVisible] = useState(false);

  const [arrows, setArrows] = useState<TacticalArrow[]>([]);
  const [activeTool, setActiveTool] = useState<PitchTool>('move');
  const [arrowColor, setArrowColor] = useState('#facc15');
  const [arrowStyle, setArrowStyle] = useState<'solid' | 'dashed' | 'curved'>('solid');

  const [opponents, setOpponents] = useState<OpponentMarker[]>([]);
  const [laserStrokes, setLaserStrokes] = useState<LaserStroke[]>([]);
  const [swapPendingId, setSwapPendingId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [coachPhotoUrl, setCoachPhotoUrl] = useState('');
  const [coachName, setCoachName] = useState('D.T.');
  const [editUnlocked, setEditUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(EDIT_UNLOCK_SESSION_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [captainPlayerId, setCaptainPlayerId] = useState<string | null>(null);
  // Custom formation
  const [allFormations, setAllFormations] = useState<Formation[]>(FORMATIONS);
  const [showCreateFormation, setShowCreateFormation] = useState(false);
  const [customName, setCustomName] = useState('');

  const [showFormations, setShowFormations] = useState(false);

  const pitchRef = useRef<HTMLDivElement>(null!);

  // Save/Load state
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportImagesReady, setExportImagesReady] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const initialLoadDone = useRef(false);

  const sentOffCount = players.filter((p) => p.isSentOff).length;
  const maxPlayersOnPitch = Math.max(0, 11 - sentOffCount);
  const pitchPlayers = players.filter((p) => p.isOnPitch);
  const benchPlayers = players.filter((p) => !p.isOnPitch && !p.isSentOff);
  const calledUpPlayers = benchPlayers.filter((p) => p.isCalledUp ?? true);
  const selectedPitchPlayer = selectedPlayerId ? pitchPlayers.find((p) => p.id === selectedPlayerId) ?? null : null;
  const canSendBenchToPitch = pitchPlayers.length < maxPlayersOnPitch;
  const expectedPitchPhotos = pitchPlayers.filter((p) => !!p.photoUrl).length;
  const pitchPhotosSignature = pitchPlayers
  .map((p) => `${p.id}:${p.photoUrl || ''}`)
  .join('|');

  useEffect(() => {
  if (loading) {
    setExportImagesReady((r) => (r ? false : r));
    return;
  }
  if (expectedPitchPhotos === 0) {
    setExportImagesReady(true);
    return;
  }
  const root = pitchRef.current;
  if (!root) return;

  setExportImagesReady((r) => (r ? false : r));

  let cancelled = false;
  let stableTicks = 0;
  let timerId: number | undefined;

  const tick = () => {
    if (cancelled) return;
    const imgs = Array.from(root.querySelectorAll('.pitch-token-face img')) as HTMLImageElement[];
    const loaded = imgs.filter((img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0).length;
    if (loaded >= expectedPitchPhotos) {
      stableTicks += 1;
      if (stableTicks >= 3) {
        setExportImagesReady(true);
        return;
      }
    } else {
      stableTicks = 0;
    }
    timerId = window.setTimeout(tick, 120);
  };
  tick();

  return () => {
    cancelled = true;
    if (timerId !== undefined) window.clearTimeout(timerId);
  };
}, [loading, expectedPitchPhotos, pitchPhotosSignature]);

  const tacticSnapshot = useRef({
    players,
    arrows,
    opponents,
    currentFormation,
    allFormations,
    laserStrokes,
  });
  tacticSnapshot.current = { players, arrows, opponents, currentFormation, allFormations, laserStrokes };

  const saveLockRef = useRef(false);

  useEffect(() => {
    if (activeTool !== 'swap') setSwapPendingId(null);
  }, [activeTool]);

  /** Modo foco + candado: solo láser en cancha; evita quedar en mover/flechas/etc. */
  useEffect(() => {
    if (!focusMode || editUnlocked) return;
    if (
      activeTool === 'move' ||
      activeTool === 'draw' ||
      activeTool === 'opponent' ||
      activeTool === 'pen' ||
      activeTool === 'swap'
    ) {
      setActiveTool('laser');
    }
  }, [focusMode, editUnlocked, activeTool]);

  /** iOS/Safari: sin esto el documento sigue haciendo scroll vertical al trazar flechas en el celular. */
  useEffect(() => {
    const editLockedNow = !editUnlocked;
    const pitchToolsLockedNow = editLockedNow && !focusMode;
    const sketching =
      !pitchToolsLockedNow &&
      (activeTool === 'draw' || activeTool === 'pen' || activeTool === 'laser');
    if (!sketching) return;
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 767px)').matches) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevTa = body.style.touchAction;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      body.style.touchAction = prevTa;
    };
  }, [activeTool, editUnlocked, focusMode]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COACH_STORAGE_KEY);
      if (!raw) return;
      const j = JSON.parse(raw) as { photoUrl?: string; name?: string };
      if (typeof j.photoUrl === 'string') setCoachPhotoUrl(j.photoUrl);
      if (typeof j.name === 'string') setCoachName(j.name);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CAPTAIN_STORAGE_KEY);
      if (!raw) return;
      const j = JSON.parse(raw) as { id?: string };
      if (typeof j.id === 'string' && j.id) setCaptainPlayerId(j.id);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COACH_STORAGE_KEY, JSON.stringify({ photoUrl: coachPhotoUrl, name: coachName }));
    } catch {
      /* ignore */
    }
  }, [coachPhotoUrl, coachName]);

  useEffect(() => {
    try {
      localStorage.setItem(CAPTAIN_STORAGE_KEY, JSON.stringify({ id: captainPlayerId ?? '' }));
    } catch {
      /* ignore */
    }
  }, [captainPlayerId]);

  useEffect(() => {
    if (focusMode) setSidebarOpen(false);
  }, [focusMode]);

  useEffect(() => {
    try {
      if (editUnlocked) sessionStorage.setItem(EDIT_UNLOCK_SESSION_KEY, '1');
      else sessionStorage.removeItem(EDIT_UNLOCK_SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, [editUnlocked]);

  useEffect(() => {
    if (pinModalOpen) setPinInput('');
  }, [pinModalOpen]);

  useEffect(() => {
    setCaptainPlayerId((cap) => {
      if (!cap) return cap;
      const ok = players.some((p) => p.id === cap && p.isOnPitch);
      return ok ? cap : null;
    });
  }, [players]);

  const getTacticPayload = useCallback((): TacticSnapshot => {
    const s = tacticSnapshot.current;
    return {
      players: s.players,
      arrows: s.arrows,
      opponents: s.opponents,
      formation: s.currentFormation,
      customFormations: s.allFormations.filter((f) => f.isCustom),
      laserStrokes: s.laserStrokes,
      captainPlayerId,
    };
  }, [captainPlayerId]);

  const handleApplySnapshot = useCallback((snap: TacticSnapshot) => {
    const list = normalizePlayersFromApi(snap.players);
    setPlayers(list);
    setArrows(snap.arrows);
    setOpponents(snap.opponents);
    setLaserStrokes(snap.laserStrokes ?? []);
    setCurrentFormation(snap.formation);
    setAllFormations([...FORMATIONS, ...snap.customFormations]);
    setSelectedPlayerId(null);
    const cap = snap.captainPlayerId;
    const ok = typeof cap === 'string' && cap && list.some((p) => p.id === cap && p.isOnPitch);
    setCaptainPlayerId(ok ? cap : null);
  }, []);

  const handleSwapTitularPick = useCallback(
    (id: string) => {
      const p = players.find((x) => x.id === id);
      if (!p?.isOnPitch) {
        toast.error('Solo titulares en el campo');
        return;
      }
      setSwapPendingId(null);
      setSelectedPlayerId(id);
      setRightBandVisible(true);
      toast.message(`Cambio: ${shortPlayerName(p.name)} (${p.position})`);
    },
    [players],
  );

  // Mark unsaved when data changes (after initial load)
  useEffect(() => {
    if (initialLoadDone.current) {
      setHasUnsaved(true);
    }
  }, [players, arrows, opponents, currentFormation, allFormations, laserStrokes, coachPhotoUrl, coachName, captainPlayerId]);

  // Load tactic from Supabase on mount
  useEffect(() => {
    const loadTactic = async () => {
      try {
        const res = await fetch(`${API_BASE}/load-tactic/${TACTIC_KEY}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        if (res.ok) {
          const data = await res.json();
          const plNorm = data.players ? normalizePlayersFromApi(data.players as Player[]) : [];
          if (data.players) setPlayers(plNorm);
          if (data.arrows) setArrows(data.arrows);
          if (data.opponents) setOpponents(data.opponents);
          if (data.formation) setCurrentFormation(data.formation);
          if (data.customFormations) {
            setAllFormations([...FORMATIONS, ...data.customFormations]);
          }
          if (Array.isArray(data.laserStrokes)) setLaserStrokes(data.laserStrokes);
          if (typeof data.coachPhotoUrl === 'string' && data.coachPhotoUrl) setCoachPhotoUrl(data.coachPhotoUrl);
          if (typeof data.coachName === 'string' && data.coachName.trim()) setCoachName(data.coachName.trim());
          if (Object.prototype.hasOwnProperty.call(data, 'captainPlayerId')) {
            const cap = data.captainPlayerId as string | null | undefined;
            if (typeof cap === 'string' && cap && plNorm.some((p) => p.id === cap && p.isOnPitch)) setCaptainPlayerId(cap);
            else setCaptainPlayerId(null);
          }
          console.log('Tactic loaded from Supabase');
        } else if (res.status !== 404) {
          console.log('Error loading tactic:', await res.text());
        }
      } catch (err) {
        console.log('Error loading tactic:', err);
      } finally {
        setLoading(false);
        setTimeout(() => { initialLoadDone.current = true; }, 100);
      }
    };
    loadTactic();
  }, []);

  // Save tactic to Supabase (lee tacticSnapshot; `override` si acabas de cargar una copia y el ref aún no actualizó)
  const handleSaveToCloud = useCallback(async (silent = false, override?: TacticSnapshot) => {
    if (!editUnlocked) {
      if (!silent) toast.error('Edición bloqueada. Usa el candado e introduce el PIN.');
      return;
    }
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setSaving(true);
    try {
      const src =
        override ??
        (() => {
          const { players: p, arrows: a, opponents: o, currentFormation: f, allFormations: af, laserStrokes: ls } =
            tacticSnapshot.current;
          return {
            players: p,
            arrows: a,
            opponents: o,
            formation: f,
            customFormations: af.filter((fm) => fm.isCustom),
            laserStrokes: ls,
          } satisfies TacticSnapshot;
        })();
      const body = {
        id: TACTIC_KEY,
        players: src.players,
        arrows: src.arrows,
        opponents: src.opponents,
        formation: src.formation,
        customFormations: src.customFormations,
        laserStrokes: src.laserStrokes ?? [],
        coachPhotoUrl,
        coachName,
        captainPlayerId,
        savedAt: new Date().toISOString(),
      };
      const res = await fetch(`${API_BASE}/save-tactic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const raw = await res.text();
        let detail = raw.slice(0, 160);
        try {
          const j = JSON.parse(raw) as { error?: string };
          if (typeof j.error === 'string' && j.error) detail = j.error.slice(0, 200);
        } catch {
          /* keep raw */
        }
        console.warn('Error saving tactic:', res.status, detail);
        if (!silent) {
          toast.error(
            res.status === 413
              ? 'Datos demasiado grandes para guardar (reduce trazos lápiz o fotos).'
              : res.status === 401 || res.status === 403
                ? 'Sin permiso para guardar (revisa la app).'
                : `Error al guardar (${res.status})${detail ? `: ${detail}` : ''}`,
          );
        }
        return;
      }
      setLastSaved(new Date());
      setHasUnsaved(false);
      if (!silent) toast.success('Guardado en la nube!');
    } catch (err) {
      console.log('Error saving tactic:', err);
      if (!silent) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(
          msg.includes('Failed to fetch') || msg.includes('NetworkError')
            ? 'Sin conexión o bloqueo de red (revisa VPN/firewall)'
            : `Error de conexión: ${msg}`,
        );
      }
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  }, [coachPhotoUrl, coachName, captainPlayerId, editUnlocked]);

  // Autosave con debounce (tras subir foto del DT se fuerza guardado desde Sidebar)
  useEffect(() => {
    if (!hasUnsaved || !initialLoadDone.current || !editUnlocked) return;
    const timer = setTimeout(() => {
      handleSaveToCloud(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [hasUnsaved, players, arrows, opponents, currentFormation, allFormations, laserStrokes, coachPhotoUrl, coachName, captainPlayerId, editUnlocked, handleSaveToCloud]);

  const handlePlayerMove = (id: string, x: number, y: number) => setPlayers(prev => prev.map(p => p.id === id ? { ...p, pitchX: x, pitchY: y } : p));

  const handleAddPlayer = (np: Omit<Player, 'id'>) => {
    const p: Player = { ...np, id: Math.random().toString(36).substr(2, 9), isSentOff: false, isCalledUp: false };
    setPlayers(prev => [...prev, p]);
    setSelectedPlayerId(p.id);
    toast.success(`${p.name} agregado`);
  };

  const handleUpdatePlayer = (id: string, u: Partial<Player>) => setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...u } : p));

  const handleRemoveFromPitch = (id: string) => {
    const p = players.find(pl => pl.id === id);
    if (!p) return;
    if (p.isOnPitch) {
      toast.error('Debe haber 11 en campo salvo expulsados. Usa el cambio (↔) o marca expulsión en editar jugador.');
      return;
    }
    setPlayers(prev => prev.filter(pl => pl.id !== id));
    toast.error(`${p.name} eliminado`);
    if (selectedPlayerId === id) setSelectedPlayerId(null);
    setCaptainPlayerId((prev) => (prev === id ? null : prev));
  };

  const handleMarkSentOff = (id: string) => {
    const p = players.find((pl) => pl.id === id);
    if (!p?.isOnPitch || p.isSentOff) return;
    const nextOnField = Math.max(0, 11 - sentOffCount - 1);
    if (!window.confirm(`¿Expulsar a ${p.name}? Quedarán ${nextOnField} jugadores en cancha (máx. permitido con esta expulsión).`)) return;
    setPlayers((prev) =>
      prev.map((pl) => (pl.id === id ? { ...pl, isOnPitch: false, isSentOff: true } : pl)),
    );
    setCaptainPlayerId((prev) => (prev === id ? null : prev));
    toast.message(`Expulsado: ${p.name}`);
  };

  const handleSendToPitch = (id: string) => {
    const p = players.find(pl => pl.id === id);
    if (!p || p.isSentOff) {
      if (p?.isSentOff) toast.error('Un expulsado no puede volver a entrar');
      return;
    }
    const exp = players.filter((x) => x.isSentOff).length;
    const max = Math.max(0, 11 - exp);
    if (pitchPlayers.length >= max) {
      toast.error(max < 11 ? `Con ${exp} expulsado(s), máximo ${max} jugadores en cancha` : 'Ya hay 11 en el campo');
      return;
    }
    setPlayers(prev => prev.map(pl => pl.id === id ? { ...pl, isOnPitch: true, pitchX: 50, pitchY: 50 } : pl));
    toast.success(`${p.name} al campo`);
  };

  const handleToggleCalledUp = useCallback((id: string) => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id !== id || p.isOnPitch || p.isSentOff) return p;
        return { ...p, isCalledUp: !(p.isCalledUp ?? true) };
      }),
    );
  }, []);

  const handleSubstitution = useCallback((onPitchId: string, benchId: string) => {
    const onP = players.find(p => p.id === onPitchId);
    const bench = players.find(p => p.id === benchId);
    if (!onP || !bench) return;
    if (bench.isSentOff) {
      toast.error('Un expulsado no puede entrar al campo');
      return;
    }
    setPlayers(prev => prev.map(p => {
      if (p.id === onPitchId) return { ...p, isOnPitch: false };
      if (p.id === benchId) return { ...p, isOnPitch: true, pitchX: onP.pitchX, pitchY: onP.pitchY };
      return p;
    }));
    setCaptainPlayerId((prev) => (prev === onPitchId ? benchId : prev));
    toast.success(`${bench.name} entra por ${onP.name}`);
    setSelectedPlayerId(benchId);
  }, [players]);

  const handleSetCaptain = useCallback(
    (playerId: string) => {
      const p = players.find((pl) => pl.id === playerId);
      if (!p?.isOnPitch) {
        toast.error('El capitán debe ser titular en el campo');
        return;
      }
      if (captainPlayerId !== playerId) toast.success('Capitán actualizado');
      setCaptainPlayerId(playerId);
    },
    [players, captainPlayerId],
  );

  const handleApplyFormation = (name: string) => {
    const f = allFormations.find(fm => fm.name === name);
    if (!f) return;
    setCurrentFormation(name);
    const onPitch = pitchPlayers.slice(0, f.positions.length);
    setPlayers(prev => prev.map(p => {
      const idx = onPitch.findIndex(op => op.id === p.id);
      if (idx !== -1 && idx < f.positions.length) return { ...p, pitchX: f.positions[idx].x, pitchY: f.positions[idx].y, isOnPitch: true };
      return p;
    }));
    toast.success(`${name} aplicada`);
    setShowFormations(false);
  };

  const handleSaveCustomFormation = () => {
    if (!customName.trim()) { toast.error('Escribe un nombre'); return; }
    if (allFormations.some(f => f.name === customName.trim())) { toast.error('Ya existe una formacion con ese nombre'); return; }
    const positions = pitchPlayers.map(p => ({ x: Math.round(p.pitchX), y: Math.round(p.pitchY), pos: p.position }));
    const newF: Formation = { name: customName, positions, isCustom: true };
    setAllFormations(prev => [...prev, newF]);
    setCurrentFormation(customName);
    setShowCreateFormation(false);
    setCustomName('');
    toast.success(`Formacion "${customName}" guardada!`);
  };

  const handleDeleteFormation = (name: string) => {
    setAllFormations(prev => prev.filter(f => f.name !== name));
    if (currentFormation === name) setCurrentFormation('4-3-3');
    toast('Formacion eliminada');
  };

  // Screenshot
  const captureImage = async () => {
    if (!pitchRef.current) return null;
    if (loading) {
      toast.message('Espera un momento: aún se están cargando los jugadores.');
      return null;
    }
    if (!exportImagesReady) {
      toast.message('Aun se estan preparando las fotos. Intenta en 1 segundo.');
      return null;
    }
    const root = pitchRef.current;
    const expectedPhotos = expectedPitchPhotos;
    root.setAttribute('data-exporting', 'true');
    try {
      await waitForTokenFaceImages(root, expectedPhotos, 15000);
      // Evita capturar el estado inicial: pedimos estabilidad de fotos cargadas.
      if (expectedPhotos > 0) {
        let stableTicks = 0;
        for (let i = 0; i < 12; i += 1) {
          const loaded = (Array.from(root.querySelectorAll('.pitch-token-face img')) as HTMLImageElement[]).filter(
            (img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0,
          ).length;
          if (loaded >= expectedPhotos) {
            stableTicks += 1;
            if (stableTicks >= 3) break;
          } else {
            stableTicks = 0;
          }
          await new Promise<void>((r) => setTimeout(r, 110));
        }
      }
      const { undo: undoPaintedFaces, paintedCount } = await paintTokenFacesToCanvasForCapture(root, { proxyBase: API_BASE });
      if (paintedCount < expectedPhotos) {
        undoPaintedFaces();
        toast.error(`No se pudieron preparar todas las fotos (${paintedCount}/${expectedPhotos}). Reintenta.`);
        return null;
      }
      if (expectedPhotos > 0) {
        await waitForTokenFaceImages(root, 0, 1000);
      }
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      await new Promise<void>((r) => setTimeout(r, 150));
      const undoPaint = preparePitchDomForCapture(root);
      // Resolución final: 3x en desktop, 2.5x en móvil para no reventar memoria iOS.
      const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const exportScale = isMobileUA ? 2.5 : 3;
      try {
        try {
          const canvas = await html2canvas(root, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            scale: exportScale,
            imageTimeout: 30000,
            logging: false,
          });
          return canvas.toDataURL('image/png');
        } catch (err) {
          console.warn('[export] html2canvas failed, trying toPng', err);
          try {
            return await toPng(root, {
              cacheBust: true,
              pixelRatio: exportScale,
              skipFonts: true,
              fetchRequestInit: { mode: 'cors', credentials: 'omit' },
            });
          } catch (err2) {
            console.warn('[export] toPng also failed', err2);
            return null;
          }
        }
      } finally {
        undoPaint();
        undoPaintedFaces();
      }
    } catch (err) {
      console.error(err);
      toast.error('No se pudo generar la imagen (revisa fotos o conexión).');
      return null;
    } finally {
      root.removeAttribute('data-exporting');
    }
  };

  const composeTacticExport = async (pitchDataUrl: string) => {
    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    const proxiedPhotoUrl = (url: string) => {
      if (!url) return '';
      if (/^https?:\/\//i.test(url)) return `${API_BASE}/image-proxy?url=${encodeURIComponent(url)}`;
      return url;
    };

    const drawRoundedRect = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
    ) => {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    const drawCoverImage = (
      ctx: CanvasRenderingContext2D,
      img: HTMLImageElement,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => {
      const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight);
      const sw = width / scale;
      const sh = height / scale;
      const sx = (img.naturalWidth - sw) / 2;
      const sy = (img.naturalHeight - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height);
    };

    const drawClampedText = (
      ctx: CanvasRenderingContext2D,
      text: string,
      x: number,
      y: number,
      maxWidth: number,
      lineHeight: number,
      maxLines: number,
    ) => {
      const words = text.split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width <= maxWidth || !line) {
          line = test;
          continue;
        }
        lines.push(line);
        line = word;
        if (lines.length === maxLines) break;
      }
      if (line && lines.length < maxLines) lines.push(line);
      lines.slice(0, maxLines).forEach((lineText, index) => {
        const finalText =
          index === maxLines - 1 && words.join(' ') !== lines.join(' ') && ctx.measureText(`${lineText}...`).width <= maxWidth
            ? `${lineText}...`
            : lineText;
        ctx.fillText(finalText, x, y + index * lineHeight);
      });
    };

    const pitchImg = await loadImage(pitchDataUrl);
    const sortedCalledUp = [...calledUpPlayers].sort((a, b) => {
      const byPosition = POSITION_DISPLAY_ORDER.indexOf(a.position) - POSITION_DISPLAY_ORDER.indexOf(b.position);
      if (byPosition !== 0) return byPosition;
      return a.name.localeCompare(b.name, 'es');
    });
    const cols = 3;
    const panelWidth = Math.max(390, Math.round(pitchImg.naturalWidth * 0.34));
    const panelPadding = 28;
    const gap = 14;
    const cardWidth = (panelWidth - panelPadding * 2 - gap * (cols - 1)) / cols;
    const cardHeight = 132;
    const rows = Math.max(1, Math.ceil(sortedCalledUp.length / cols));
    const panelNeededHeight = 150 + rows * cardHeight + (rows - 1) * gap + 36;
    const canvas = document.createElement('canvas');
    canvas.width = pitchImg.naturalWidth + panelWidth;
    canvas.height = Math.max(pitchImg.naturalHeight, panelNeededHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) return pitchDataUrl;

    ctx.fillStyle = '#eef3ea';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(pitchImg, 0, 0);

    const panelX = pitchImg.naturalWidth;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(panelX, 0, panelWidth, canvas.height);
    ctx.strokeStyle = '#d9e2ec';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(panelX + 1, 0);
    ctx.lineTo(panelX + 1, canvas.height);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 28px sans-serif';
    ctx.fillText('CONVOCADOS', panelX + panelPadding, 46);
    ctx.fillStyle = '#64748b';
    ctx.font = '800 15px sans-serif';
    ctx.fillText(`${currentFormation} · ${sortedCalledUp.length} jugadores`, panelX + panelPadding, 74);
    ctx.fillText(`DT: ${coachName || 'Intercolina'}`, panelX + panelPadding, 98);

    const photoResults = await Promise.allSettled(sortedCalledUp.map((p) => (p.photoUrl ? loadImage(proxiedPhotoUrl(p.photoUrl)) : Promise.reject())));
    let y = 126;
    sortedCalledUp.forEach((p, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = panelX + panelPadding + col * (cardWidth + gap);
      y = 126 + row * (cardHeight + gap);
      const photo = photoResults[index].status === 'fulfilled' ? photoResults[index].value : null;

      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 20);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const cx = x + cardWidth / 2;
      const cy = y + 42;
      const r = 30;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      if (photo) {
        drawCoverImage(ctx, photo, cx - r, cy - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '900 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(p.number), cx, cy);
      }
      ctx.restore();

      ctx.fillStyle = '#16a34a';
      drawRoundedRect(ctx, x + cardWidth / 2 - 22, y + 70, 44, 20, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(p.position, x + cardWidth / 2, y + 84);

      ctx.fillStyle = '#111827';
      ctx.font = '800 12px sans-serif';
      ctx.textAlign = 'left';
      drawClampedText(ctx, shortPlayerName(p.name), x + 8, y + 108, cardWidth - 16, 14, 2);
    });

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    return canvas.toDataURL('image/png');
  };

  const handleDownload = async () => {
    const t = toast.loading('Generando imagen con titular y convocados…');
    const d = await captureImage();
    toast.dismiss(t);
    if (!d) return;
    let href = d;
    try {
      href = await composeTacticExport(d);
    } catch (err) {
      console.warn('[export] roster composition failed, downloading pitch only', err);
      toast.message('No se pudo anexar convocados; descargo solo la cancha.');
    }
    const a = document.createElement('a');
    a.download = `tactica-${currentFormation}.png`;
    a.href = href;
    a.click();
    toast.success('Descargada');
  };

  const bg = isDark ? 'bg-slate-950 text-slate-100' : 'bg-gray-100 text-gray-900';
  const btn = (active = false) => `p-2 rounded-lg transition-all border shrink-0 ${active ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : isDark ? 'bg-white/10 hover:bg-white/20 border-white/10 text-slate-300' : 'bg-white hover:bg-gray-200 border-gray-200 text-gray-600'}`;
  const mut = isDark ? 'text-slate-400' : 'text-gray-500';
  const editLocked = !editUnlocked;
  /** Modo foco y césped siguen disponibles con el candado activo. */
  const pitchToolsLocked = editLocked && !focusMode;
  const focusLaserOnlyLock = focusMode && editLocked;
  const tacticalToolLock: 'off' | 'full' | 'laser-only' = pitchToolsLocked ? 'full' : focusLaserOnlyLock ? 'laser-only' : 'off';
  /** En pantallas chicas el panel central tiene scroll; al rayar flechas/lápiz/láser hay que congelarlo para que no se mueva la vista. */
  const sketchLocksCenterScroll =
    !pitchToolsLocked && (activeTool === 'draw' || activeTool === 'pen' || activeTool === 'laser');

  const LEGEND = LINE_LEGEND.map(({ line, title, roles }) => ({
    line,
    title,
    roles,
    ...lineLegendSwatch(line),
  }));

  return (
    <div className={`flex h-screen h-[100dvh] w-full overflow-hidden font-sans transition-colors duration-300 ${bg}`}
      style={isDark ? {
        backgroundImage: 'linear-gradient(to bottom right, rgba(2,6,23,0.92), rgba(15,23,42,0.92)), url("https://images.unsplash.com/photo-1590502178797-a7ed0833a02f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080")',
        backgroundSize: 'cover', backgroundPosition: 'center',
      } : {}}>
      <Toaster position="top-center" theme={isDark ? 'dark' : 'light'} />
      {!focusMode && (
        <>
          {!leftBandVisible && (
            <button
              type="button"
              onClick={() => setLeftBandVisible(true)}
              disabled={editLocked}
              className={`hidden lg:flex absolute left-3 top-3 z-30 ${btn()} text-emerald-400 ${editLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
              title={editLocked ? 'Desbloquea para usar laterales' : 'Mostrar banda izquierda'}
              aria-pressed={false}
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          )}
          {!rightBandVisible && (
            <button
              type="button"
              onClick={() => setRightBandVisible(true)}
              className={`hidden lg:flex absolute right-3 top-3 z-30 ${btn()} text-emerald-400`}
              title="Mostrar banca y convocados"
              aria-pressed={false}
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          )}
        </>
      )}

      {pinModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pin-modal-title"
          onClick={() => setPinModalOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${isDark ? 'border-white/10 bg-slate-900 text-white' : 'border-gray-200 bg-white text-gray-900'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pin-modal-title" className="text-lg font-black tracking-tight text-emerald-500">
              Desbloquear edición
            </h2>
            <p className={`mt-2 text-xs ${mut}`}>Introduce el PIN para modificar plantilla, cancha y táctica.</p>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (pinInput.trim() === EDIT_PIN) {
                    setEditUnlocked(true);
                    setPinModalOpen(false);
                    setPinInput('');
                    toast.success('Edición desbloqueada');
                  } else {
                    toast.error('PIN incorrecto');
                  }
                }
              }}
              className={`mt-4 w-full rounded-xl border px-3 py-2.5 text-sm font-mono tracking-widest focus:border-emerald-500 focus:outline-none ${isDark ? 'border-slate-600 bg-slate-950' : 'border-gray-300 bg-gray-50'}`}
              placeholder="PIN"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPinModalOpen(false)} className={btn()}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pinInput.trim() === EDIT_PIN) {
                    setEditUnlocked(true);
                    setPinModalOpen(false);
                    setPinInput('');
                    toast.success('Edición desbloqueada');
                  } else {
                    toast.error('PIN incorrecto');
                  }
                }}
                className={`${btn(true)} px-4`}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {!focusMode && (
      <Sidebar players={players} onAddPlayer={handleAddPlayer} onUpdatePlayer={handleUpdatePlayer}
        onRemovePlayer={handleRemoveFromPitch} onSendToPitch={handleSendToPitch} onMarkSentOff={handleMarkSentOff}
        selectedPlayerId={selectedPlayerId} onSelectPlayer={setSelectedPlayerId}
        onSubstitution={handleSubstitution} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
        showDesktop={leftBandVisible}
        onRequestPersist={() => handleSaveToCloud(true)}
        editLocked={editLocked}
        onRequestUnlock={() => setPinModalOpen(true)}
        captainPlayerId={captainPlayerId}
        onSetCaptain={handleSetCaptain}
        coachName={coachName}
        coachPhotoUrl={coachPhotoUrl}
        onCoachName={setCoachName}
        onCoachPhotoUrl={setCoachPhotoUrl}
        savedTacticsPanel={
          <SavedTacticsPanel
            getPayload={getTacticPayload}
            onApplySnapshot={handleApplySnapshot}
            onAfterApply={(snap) => void handleSaveToCloud(true, snap)}
            hasUnsaved={hasUnsaved}
            headerAction={
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLeftBandVisible(false);
                }}
                disabled={editLocked}
                className={`hidden lg:inline-flex ${btn()} p-1.5 ${editLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                title={editLocked ? 'Desbloquea para usar laterales' : 'Ocultar banda izquierda'}
                aria-label="Ocultar banda izquierda"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
            }
          />
        }
        formationsPanel={
          <div className={`border-b shrink-0 ${isDark ? 'border-white/10 bg-slate-900/40' : 'border-gray-200 bg-gray-50/80'}`}>
            <button
              type="button"
              onClick={() => setShowFormations((v) => !v)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-left ${mut} hover:opacity-90`}
            >
              <span className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-emerald-500">
                <Sparkles className="w-4 h-4" />
                Formación: <span className="text-emerald-400">{currentFormation}</span>
              </span>
              {showFormations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showFormations && (
              <div className={`px-3 pb-3 space-y-2 ${editLocked ? 'pointer-events-none opacity-50' : ''}`}>
                <div className={`p-2 rounded-lg border ${isDark ? 'border-white/10 bg-slate-900/50' : 'border-gray-200 bg-white'}`}>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {allFormations.map((f, idx) => (
                      <div key={`${f.name}-${idx}`} className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleApplyFormation(f.name)}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all border ${
                            currentFormation === f.name
                              ? 'bg-emerald-500 text-white border-emerald-400'
                              : isDark ? 'bg-white/10 text-slate-300 border-white/10 hover:bg-white/20' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-emerald-50'
                          }`}
                        >
                          {f.name}
                        </button>
                        {f.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteFormation(f.name)}
                            className="text-red-400 hover:text-red-300 p-0.5"
                            title="Eliminar"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {!showCreateFormation ? (
                    <button
                      type="button"
                      onClick={() => setShowCreateFormation(true)}
                      className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border w-full justify-center ${isDark ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'}`}
                    >
                      <Plus className="w-3 h-3" /> Crear personalizada
                    </button>
                  ) : (
                    <div className="flex gap-1.5 items-center">
                      <input
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="Mi 4-3-3"
                        className={`flex-1 min-w-0 px-2 py-1.5 rounded-md text-[10px] border ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300'} focus:outline-none focus:border-emerald-500`}
                      />
                      <button
                        type="button"
                        onClick={handleSaveCustomFormation}
                        className="shrink-0 px-2 py-1.5 bg-emerald-500 text-white text-[10px] font-black rounded-md hover:bg-emerald-600"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCreateFormation(false)}
                        className={`shrink-0 p-1 ${mut}`}
                        title="Cancelar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        }
        calledUpPanel={
          <div className={`border-b p-3 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
            <BenchPreview
              players={calledUpPlayers}
              editablePlayers={benchPlayers}
              isDark={isDark}
              mutedClass={mut}
              selectedPlayerId={selectedPlayerId}
              substitutionTargetId={selectedPitchPlayer?.id ?? null}
              substitutionTargetName={selectedPitchPlayer?.name}
              substitutionTargetPosition={selectedPitchPlayer?.position}
              onSelectPlayer={setSelectedPlayerId}
              onSendToPitch={handleSendToPitch}
              onSubstitution={handleSubstitution}
              onToggleCalledUp={handleToggleCalledUp}
              canSendToPitch={canSendBenchToPitch}
              editLocked={editLocked}
            />
          </div>
        } />
      )}

      {/* CENTER */}
      <div
        className={`flex-1 flex flex-col items-center p-2 sm:p-3 md:p-4 relative min-w-0 ${
          sketchLocksCenterScroll
            ? 'max-md:overflow-y-hidden max-md:touch-none max-md:overscroll-y-contain md:overflow-y-auto'
            : 'overflow-y-auto'
        } ${focusMode ? 'overflow-x-visible' : 'overflow-x-hidden'}`}
      >
        {/* Header */}
        {!focusMode && (
        <header className="w-full max-w-[520px] xl:max-w-[640px] 2xl:max-w-[760px] flex justify-between items-center mb-2 md:mb-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className={`md:hidden ${btn()}`}
              title="Plantilla"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl md:text-3xl font-black tracking-tighter drop-shadow-md">
                PIZARRA<span className="text-emerald-500">TACTICA</span>
              </h1>
              <p className={`text-[10px] md:text-xs font-medium ${mut} hidden sm:block`}>
                {editLocked
                  ? 'Edición bloqueada — PIN en el candado (modo foco y césped siempre disponibles)'
                  : activeTool === 'draw'
                  ? 'Dibuja flechas'
                  : activeTool === 'opponent'
                    ? 'Toca para colocar rival'
                    : activeTool === 'laser'
                      ? 'Láser: se desvanece al soltar (como Excalidraw)'
                      : activeTool === 'pen'
                        ? 'Lápiz: trazos que se guardan en la planilla'
                        : activeTool === 'swap'
                        ? 'Toca un titular para ver convocados recomendados'
                        : 'Arrastra jugadores'}
              </p>
            </div>
          </div>
          <div className="flex gap-1 md:gap-1.5">
            {editLocked ? (
              <button type="button" onClick={() => setPinModalOpen(true)} className={`${btn()} border-amber-500/50 text-amber-400`} title="Desbloquear edición (PIN)">
                <Lock className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditUnlocked(false);
                  toast.message('Edición bloqueada');
                }}
                className={`${btn()} text-emerald-400`}
                title="Bloquear edición"
              >
                <Unlock className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={() => setFocusMode(true)} className={btn()} title="Modo foco: solo titular en el campo">
              <ScanEye className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setRightBandVisible(true)} className={`${btn()} lg:hidden`} title="Banca y convocados">
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={toggleTheme} className={btn()} title={isDark ? 'Claro' : 'Oscuro'}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="relative">
              <button type="button" onClick={() => setShowGrassMenu(!showGrassMenu)} className={btn()} title="Color del césped"><Palette className="w-4 h-4" /></button>
              {showGrassMenu && (
                <div className={`absolute right-0 top-11 z-50 max-h-[min(70vh,420px)] w-[min(calc(100vw-2rem),280px)] overflow-y-auto rounded-xl border p-3 shadow-2xl ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-gray-200'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${mut}`}>Colores</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {GRASS_COLORS.map(c => (
                      <button key={c} type="button" onClick={() => { setGrassColor(c); setShowGrassMenu(false); }}
                        className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${grassColor === c ? 'border-yellow-400 scale-110' : 'border-white/30'}`}
                        style={{ backgroundColor: c }} title={c} />
                    ))}
                  </div>
                  <p className={`mt-3 text-[10px] font-bold uppercase tracking-wider ${mut}`}>Corte del césped</p>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {GRASS_CUT_OPTIONS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setGrassCut(p.id);
                          setShowGrassMenu(false);
                        }}
                        className={`rounded-lg border px-2.5 py-2 text-left text-[10px] font-bold transition-colors ${
                          grassCut === p.id
                            ? 'border-yellow-400 bg-yellow-500/10 text-yellow-500'
                            : isDark ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleDownload}
              className={btn()}
              title={loading ? 'Cargando plantilla...' : !exportImagesReady ? 'Preparando fotos...' : 'Descargar imagen'}
              disabled={loading || !exportImagesReady}
            >
              <Download className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => void handleSaveToCloud()} disabled={saving || editLocked}
              className={`${btn()} relative ${hasUnsaved ? 'animate-pulse' : ''}`}
              title={editLocked ? 'Desbloquea para guardar' : saving ? 'Guardando...' : hasUnsaved ? 'Guardar cambios' : 'Guardado'}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : hasUnsaved ? <Save className="w-4 h-4 text-yellow-400" /> : <Cloud className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </header>
        )}

        {!focusMode ? (
        <>
        {/* Cancha centrada: el apoyo vive en bandas laterales desplegables. */}
        <div className="w-full max-w-[1120px] xl:max-w-[1360px] 2xl:max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,680px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(0,780px)_minmax(0,1fr)] gap-3 items-start">
          <div className="hidden lg:block min-w-0" aria-hidden />
          <div className="w-full max-w-[520px] xl:max-w-[640px] 2xl:max-w-[760px] relative min-w-0 justify-self-center">
          <TacticalToolbar
            variant="mobile"
            btn={btn}
            isDark={isDark}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            arrowStyle={arrowStyle}
            setArrowStyle={setArrowStyle}
            arrowColor={arrowColor}
            setArrowColor={setArrowColor}
            setArrows={setArrows}
            setOpponents={setOpponents}
            laserStrokes={laserStrokes}
            setLaserStrokes={setLaserStrokes}
            toolLock={tacticalToolLock}
          />
          <TacticalToolbar
            variant="rail"
            btn={btn}
            isDark={isDark}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            arrowStyle={arrowStyle}
            setArrowStyle={setArrowStyle}
            arrowColor={arrowColor}
            setArrowColor={setArrowColor}
            setArrows={setArrows}
            setOpponents={setOpponents}
            laserStrokes={laserStrokes}
            setLaserStrokes={setLaserStrokes}
            toolLock={tacticalToolLock}
          />

          <div className="w-full relative">
            <Pitch players={pitchPlayers} onPlayerMove={handlePlayerMove}
              selectedPlayerId={selectedPlayerId} onSelectPlayer={setSelectedPlayerId}
              arrows={arrows} onAddArrow={a => setArrows(p => [...p, a])}
              activeTool={activeTool} arrowColor={arrowColor} arrowStyle={arrowStyle} pitchRef={pitchRef}
              opponents={opponents} onAddOpponent={m => setOpponents(p => [...p, m])}
              onMoveOpponent={(id, x, y) => setOpponents(p => p.map(m => m.id === id ? { ...m, x, y } : m))}
              onRemoveOpponent={id => setOpponents(p => p.filter(m => m.id !== id))}
              laserStrokes={laserStrokes}
              onAddLaserStroke={(s) => setLaserStrokes((p) => [...p, s])}
              onSwapTitularPick={handleSwapTitularPick}
              swapPendingId={swapPendingId}
              captainPlayerId={captainPlayerId}
              editLocked={pitchToolsLocked}
              laserOnlyLock={false} />
          </div>
          </div>
          <div className="hidden lg:block min-w-0" aria-hidden />
        </div>

        {/* Mobile info bar */}
        <div className={`mt-3 md:hidden flex items-center justify-between w-full max-w-[520px] xl:max-w-[640px] 2xl:max-w-[760px] px-4 py-2 rounded-xl border ${isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/80 border-gray-200'}`}>
          <span className="text-emerald-500 font-black text-lg">{currentFormation}</span>
          <span className={`text-xs ${mut}`}>{pitchPlayers.length}/{maxPlayersOnPitch}</span>
          <div className="flex max-w-[52%] flex-wrap justify-end gap-1.5" title={LEGEND.map((l) => `${l.title} (${l.roles})`).join(' · ')}>
            {LEGEND.map((l) => (
              <span key={l.line} className={`h-3 w-3 shrink-0 rounded-full ${l.color}`} style={{ boxShadow: `0 0 6px ${l.shadow}` }} />
            ))}
          </div>
        </div>
        </>
        ) : (
        <div className="flex flex-1 flex-col w-full min-h-0 max-w-[min(100%,1040px)] mx-auto px-1 sm:px-2">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 w-full px-1 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setFocusMode(false)} className={`${btn()} text-[10px] font-black px-2.5 py-1.5 flex items-center gap-1`} title="Volver a la pizarra completa">
                <X className="w-3.5 h-3.5" /> Salir foco
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className={`md:hidden ${btn()}`}
                title="Plantilla"
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>
            <span className="text-emerald-400 font-black text-sm md:text-lg">{currentFormation}</span>
            <span className={`text-xs font-bold ${mut}`}>{pitchPlayers.length}/{maxPlayersOnPitch} en cancha</span>
            {editLocked ? (
              <button type="button" onClick={() => setPinModalOpen(true)} className={`${btn()} border-amber-500/50 text-amber-400`} title="Desbloquear (PIN)">
                <Lock className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditUnlocked(false);
                  toast.message('Edición bloqueada');
                }}
                className={`${btn()} text-emerald-400`}
                title="Bloquear edición"
              >
                <Unlock className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex flex-1 min-h-0 w-full justify-center px-1 sm:px-2">
            <div className="flex min-h-0 w-full max-w-[min(720px,calc(100vw-1rem))] flex-row gap-2 sm:max-w-[min(760px,calc(100vw-1.5rem))] xl:max-w-[min(900px,calc(100vw-2rem))] 2xl:max-w-[min(1040px,calc(100vw-2rem))] sm:gap-3">
              <TacticalToolbar
                variant="dock"
                btn={btn}
                isDark={isDark}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                arrowStyle={arrowStyle}
                setArrowStyle={setArrowStyle}
                arrowColor={arrowColor}
                setArrowColor={setArrowColor}
                setArrows={setArrows}
                setOpponents={setOpponents}
                laserStrokes={laserStrokes}
                setLaserStrokes={setLaserStrokes}
                toolLock={tacticalToolLock}
              />
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <TacticalToolbar
                  variant="mobile"
                  btn={btn}
                  isDark={isDark}
                  activeTool={activeTool}
                  setActiveTool={setActiveTool}
                  arrowStyle={arrowStyle}
                  setArrowStyle={setArrowStyle}
                  arrowColor={arrowColor}
                  setArrowColor={setArrowColor}
                  setArrows={setArrows}
                  setOpponents={setOpponents}
                  laserStrokes={laserStrokes}
                  setLaserStrokes={setLaserStrokes}
                  toolLock={tacticalToolLock}
                />
                <div className="relative min-h-0 w-full min-w-0 flex-1">
                  <Pitch
                    players={pitchPlayers}
                    onPlayerMove={handlePlayerMove}
                    selectedPlayerId={selectedPlayerId}
                    onSelectPlayer={setSelectedPlayerId}
                    arrows={arrows}
                    onAddArrow={(a) => setArrows((p) => [...p, a])}
                    activeTool={activeTool}
                    arrowColor={arrowColor}
                    arrowStyle={arrowStyle}
                    pitchRef={pitchRef}
                    opponents={opponents}
                    onAddOpponent={(m) => setOpponents((p) => [...p, m])}
                    onMoveOpponent={(id, x, y) => setOpponents((p) => p.map((m) => (m.id === id ? { ...m, x, y } : m)))}
                    onRemoveOpponent={(id) => setOpponents((p) => p.filter((m) => m.id !== id))}
                    laserStrokes={laserStrokes}
                    onAddLaserStroke={(s) => setLaserStrokes((p) => [...p, s])}
                    onSwapTitularPick={handleSwapTitularPick}
                    swapPendingId={swapPendingId}
                    captainPlayerId={captainPlayerId}
                    editLocked={false}
                    laserOnlyLock={focusLaserOnlyLock}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {!focusMode && rightBandVisible && (
        <>
          <div className="fixed inset-0 z-40 bg-black/45 lg:hidden" onClick={() => setRightBandVisible(false)} />
          <div className="fixed bottom-0 right-0 top-0 z-50 w-[min(88vw,380px)] lg:static lg:z-auto lg:w-[300px] xl:w-[340px]">
            <MatchStaffBand
              isDark={isDark}
              mutedClass={mut}
              coachPhotoUrl={coachPhotoUrl}
              coachName={coachName}
              players={calledUpPlayers}
              editablePlayers={benchPlayers}
              selectedPlayerId={selectedPlayerId}
              substitutionTargetId={selectedPitchPlayer?.id ?? null}
              substitutionTargetName={selectedPitchPlayer?.name}
              substitutionTargetPosition={selectedPitchPlayer?.position}
              onSelectPlayer={setSelectedPlayerId}
              onSendToPitch={handleSendToPitch}
              onSubstitution={handleSubstitution}
              onToggleCalledUp={handleToggleCalledUp}
              canSendToPitch={canSendBenchToPitch}
              editLocked={editLocked}
              onClose={() => setRightBandVisible(false)}
            />
          </div>
        </>
      )}

    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
