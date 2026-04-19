import React, { useState, useCallback, useRef } from 'react';
import { motion, useMotionValue } from 'motion/react';
import { Player, TacticalArrow, OpponentMarker, LaserStroke, Position } from '../types';
import { useTheme } from './ThemeContext';

export type PitchTool = 'move' | 'draw' | 'opponent' | 'laser' | 'pen' | 'swap';

type EphemeralLaserStroke = { id: string; points: { x: number; y: number }[]; color: string };

interface PitchProps {
  players: Player[];
  onPlayerMove: (id: string, x: number, y: number) => void;
  selectedPlayerId: string | null;
  onSelectPlayer: (id: string) => void;
  arrows: TacticalArrow[];
  onAddArrow: (arrow: TacticalArrow) => void;
  activeTool: PitchTool;
  arrowColor: string;
  arrowStyle: 'solid' | 'dashed' | 'curved';
  pitchRef: React.RefObject<HTMLDivElement>;
  opponents: OpponentMarker[];
  onAddOpponent: (m: OpponentMarker) => void;
  onMoveOpponent: (id: string, x: number, y: number) => void;
  onRemoveOpponent: (id: string) => void;
  laserStrokes: LaserStroke[];
  onAddLaserStroke: (stroke: LaserStroke) => void;
  onSwapTitularPick: (id: string) => void;
  swapPendingId: string | null;
  /** Solo campo + titulares (sin flechas, rivales ni lápiz); vista pasiva */
  lineupOnly?: boolean;
  captainPlayerId?: string | null;
  /** Bloqueo por candado: misma interacción que lineupOnly en campo y fichas, pero se siguen viendo flechas/lápiz/rivales. */
  editLocked?: boolean;
}

export const Pitch: React.FC<PitchProps> = ({
  players, onPlayerMove, selectedPlayerId, onSelectPlayer,
  arrows, onAddArrow, activeTool, arrowColor, arrowStyle, pitchRef,
  opponents, onAddOpponent, onMoveOpponent, onRemoveOpponent,
  laserStrokes, onAddLaserStroke, onSwapTitularPick, swapPendingId,
  lineupOnly = false,
  captainPlayerId = null,
  editLocked = false,
}) => {
  const { grassColor, grassCut } = useTheme();
  const blockField = lineupOnly || editLocked;
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null);

  const [laserDrawing, setLaserDrawing] = useState<{ x: number; y: number }[]>([]);
  const lastLaserPoint = useRef<{ x: number; y: number } | null>(null);
  const [ephemeralLaser, setEphemeralLaser] = useState<EphemeralLaserStroke[]>([]);

  const toPercent = useCallback((clientX: number, clientY: number) => {
    if (!pitchRef.current) return { x: 0, y: 0 };
    const rect = pitchRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }, [pitchRef]);

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (blockField) return;
    if (activeTool === 'draw') {
      e.preventDefault();
      const pt = toPercent(e.clientX, e.clientY);
      setDrawStart(pt);
      setDrawEnd(pt);
      setDrawing(true);
    } else if (activeTool === 'opponent') {
      e.preventDefault();
      const pt = toPercent(e.clientX, e.clientY);
      onAddOpponent({ id: Math.random().toString(36).substr(2, 9), x: pt.x, y: pt.y });
    } else if (activeTool === 'laser' || activeTool === 'pen') {
      e.preventDefault();
      const pt = toPercent(e.clientX, e.clientY);
      lastLaserPoint.current = pt;
      setLaserDrawing([pt]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (blockField) return;
    if (drawing && activeTool === 'draw') {
      setDrawEnd(toPercent(e.clientX, e.clientY));
      return;
    }
    if ((activeTool !== 'laser' && activeTool !== 'pen') || laserDrawing.length === 0) return;
    const pt = toPercent(e.clientX, e.clientY);
    const last = lastLaserPoint.current;
    if (last && dist(last, pt) > 0.35) {
      lastLaserPoint.current = pt;
      setLaserDrawing((prev) => [...prev, pt]);
    }
  };

  const handlePointerUp = () => {
    if (blockField) {
      setLaserDrawing([]);
      lastLaserPoint.current = null;
      setDrawing(false);
      setDrawStart(null);
      setDrawEnd(null);
      return;
    }
    if (drawing && drawStart && drawEnd) {
      const dx = drawEnd.x - drawStart.x;
      const dy = drawEnd.y - drawStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > 3) {
        onAddArrow({
          id: Math.random().toString(36).substr(2, 9),
          fromX: drawStart.x, fromY: drawStart.y,
          toX: drawEnd.x, toY: drawEnd.y,
          color: arrowColor, style: arrowStyle,
        });
      }
    }
    setDrawing(false);
    setDrawStart(null);
    setDrawEnd(null);

    if ((activeTool === 'pen' || activeTool === 'laser') && laserDrawing.length >= 2) {
      if (activeTool === 'pen') {
        onAddLaserStroke({
          id: Math.random().toString(36).substr(2, 9),
          points: laserDrawing,
          color: arrowColor,
        });
      } else {
        const id = Math.random().toString(36).substr(2, 9);
        setEphemeralLaser((prev) => [...prev, { id, points: [...laserDrawing], color: arrowColor }]);
      }
    }
    setLaserDrawing([]);
    lastLaserPoint.current = null;
  };

  const mixGrass = (toward: 'white' | 'black', pct: number) =>
    `color-mix(in srgb, ${grassColor} 100%, ${toward} ${pct}%)`;
  const stripeLight = mixGrass('white', 10);
  const stripeDark = mixGrass('black', 9);

  const renderGrassTurf = () => {
    const bandOpacity = 0.55;
    switch (grassCut) {
      case 'stripe_h': {
        const n = 14;
        return Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute left-0 w-full"
            style={{
              top: `${(i / n) * 100}%`,
              height: `${100 / n}%`,
              backgroundColor: i % 2 === 0 ? stripeLight : stripeDark,
              opacity: bandOpacity,
            }}
          />
        ));
      }
      case 'stripe_wide_h': {
        const n = 8;
        return Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute left-0 w-full"
            style={{
              top: `${(i / n) * 100}%`,
              height: `${100 / n}%`,
              backgroundColor: i % 2 === 0 ? stripeLight : stripeDark,
              opacity: bandOpacity,
            }}
          />
        ));
      }
      case 'stripe_v': {
        const n = 20;
        return Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute top-0 h-full"
            style={{
              left: `${(i / n) * 100}%`,
              width: `${100 / n}%`,
              backgroundColor: i % 2 === 0 ? stripeLight : stripeDark,
              opacity: bandOpacity,
            }}
          />
        ));
      }
      case 'stripe_wide_v': {
        const n = 12;
        return Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            className="pointer-events-none absolute top-0 h-full"
            style={{
              left: `${(i / n) * 100}%`,
              width: `${100 / n}%`,
              backgroundColor: i % 2 === 0 ? stripeLight : stripeDark,
              opacity: bandOpacity,
            }}
          />
        ));
      }
      case 'checker': {
        /**
         * Damero con pocas celdas grandes (~3×5 en cancha 2:3).
         * Cuadrícula en % del rectángulo: más fiable que SVG pattern + color-mix en fills.
         */
        const cols = 3;
        const rows = 5;
        const cells: React.ReactNode[] = [];
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const light = (row + col) % 2 === 0;
            cells.push(
              <div
                key={`chk-${row}-${col}`}
                className="pointer-events-none absolute box-border"
                style={{
                  left: `${(col / cols) * 100}%`,
                  top: `${(row / rows) * 100}%`,
                  width: `${100 / cols}%`,
                  height: `${100 / rows}%`,
                  backgroundColor: light ? stripeLight : stripeDark,
                  opacity: bandOpacity,
                }}
              />,
            );
          }
        }
        return cells;
      }
      case 'diagonal':
        return (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: bandOpacity,
              background: `repeating-linear-gradient(
                -45deg,
                ${stripeLight} 0px,
                ${stripeLight} 9px,
                ${stripeDark} 9px,
                ${stripeDark} 18px
              )`,
            }}
          />
        );
      default:
        return null;
    }
  };

  const cursorClass = blockField
    ? 'cursor-default'
    : activeTool === 'draw' ? 'cursor-crosshair'
      : activeTool === 'opponent' ? 'cursor-cell'
        : activeTool === 'laser' || activeTool === 'pen' ? 'cursor-crosshair'
          : activeTool === 'swap' ? 'cursor-alias'
            : '';

  const laserOverlay = !blockField && (activeTool === 'laser' || activeTool === 'pen');

  const removeEphemeral = useCallback((id: string) => {
    setEphemeralLaser((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return (
    <div
      ref={pitchRef}
      className={`pitch-capture-root relative border-[4px] md:border-[5px] border-white/90 aspect-[2/3] w-full mx-auto overflow-hidden select-none rounded-xl ${cursorClass}`}
      style={{
        backgroundColor: grassColor,
        boxShadow: '0 0 60px rgba(0,0,0,0.5), inset 0 0 80px rgba(0,0,0,0.15)',
      }}
      onPointerDown={blockField ? undefined : handlePointerDown}
      onPointerMove={blockField ? undefined : handlePointerMove}
      onPointerUp={blockField ? undefined : handlePointerUp}
      onPointerLeave={blockField ? undefined : () => { if (drawing || laserDrawing.length) handlePointerUp(); }}
    >
      {renderGrassTurf()}

      <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{
        backgroundImage: `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.3) 0%, transparent 2%), radial-gradient(circle at 60% 70%, rgba(255,255,255,0.2) 0%, transparent 1.5%), linear-gradient(0deg, rgba(0,0,0,0.05) 1px, transparent 1px)`,
        backgroundSize: '60px 60px, 40px 40px, 14px 14px',
      }} />

      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.2) 100%)' }} />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28%] aspect-square border-[2.5px] border-white/80 rounded-full pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-full h-[2.5px] bg-white/80 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white/90 rounded-full pointer-events-none" />

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[16%] border-[2.5px] border-t-0 border-white/80 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[30%] h-[6%] border-[2.5px] border-t-0 border-white/80 pointer-events-none" />
      <div className="absolute top-[16%] left-1/2 -translate-x-1/2 w-[18%] h-[6%] border-[2.5px] border-t-0 border-white/80 rounded-b-full pointer-events-none" />
      <div className="absolute top-[11%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/80 rounded-full pointer-events-none" />

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] h-[16%] border-[2.5px] border-b-0 border-white/80 pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[30%] h-[6%] border-[2.5px] border-b-0 border-white/80 pointer-events-none" />
      <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 w-[18%] h-[6%] border-[2.5px] border-b-0 border-white/80 rounded-t-full pointer-events-none" />
      <div className="absolute bottom-[11%] left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-white/80 rounded-full pointer-events-none" />

      <div className="absolute top-0 left-0 w-5 h-5 border-r-[2.5px] border-b-[2.5px] border-white/80 rounded-br-full pointer-events-none" />
      <div className="absolute top-0 right-0 w-5 h-5 border-l-[2.5px] border-b-[2.5px] border-white/80 rounded-bl-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-5 h-5 border-r-[2.5px] border-t-[2.5px] border-white/80 rounded-tr-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-5 h-5 border-l-[2.5px] border-t-[2.5px] border-white/80 rounded-tl-full pointer-events-none" />

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[12%] h-[1.8%] bg-white/15 border-[2px] border-t-0 border-white/60 rounded-b-sm pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[12%] h-[1.8%] bg-white/15 border-[2px] border-b-0 border-white/60 rounded-t-sm pointer-events-none" />

      {/* Láser (debajo de flechas, encima del césped) */}
      {!lineupOnly && (
      <svg
        className="pitch-laser-svg absolute inset-0 w-full h-full pointer-events-none z-[4]"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {laserStrokes.map((s) => {
          if (s.points.length < 2) return null;
          const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          return (
            <path
              key={s.id}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
        {(activeTool === 'laser' || activeTool === 'pen') && laserDrawing.length >= 2 && (
          <path
            d={laserDrawing.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
            fill="none"
            stroke={arrowColor}
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.95}
          />
        )}
        {ephemeralLaser.map((s) => {
          if (s.points.length < 2) return null;
          const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          return (
            <motion.g
              key={s.id}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              onAnimationComplete={() => removeEphemeral(s.id)}
            >
              <path
                d={d}
                fill="none"
                stroke={s.color}
                strokeWidth="1.35"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.g>
          );
        })}
      </svg>
      )}

      {!lineupOnly && (
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-[5]" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          {arrows.map(a => (
            <marker key={`m-${a.id}`} id={`ah-${a.id}`} markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto">
              <polygon points="0 0, 4 1.5, 0 3" fill={a.color} />
            </marker>
          ))}
          {drawing && drawStart && drawEnd && (
            <marker id="ah-preview" markerWidth="4" markerHeight="3" refX="3.5" refY="1.5" orient="auto">
              <polygon points="0 0, 4 1.5, 0 3" fill={arrowColor} />
            </marker>
          )}
        </defs>
        {arrows.map(a => {
          if (a.style === 'curved') {
            const mx = (a.fromX + a.toX) / 2;
            const my = (a.fromY + a.toY) / 2;
            const dx = a.toX - a.fromX;
            const dy = a.toY - a.fromY;
            return (
              <path key={a.id} d={`M ${a.fromX} ${a.fromY} Q ${mx - dy * 0.3} ${my + dx * 0.3} ${a.toX} ${a.toY}`}
                fill="none" stroke={a.color} strokeWidth="0.6" markerEnd={`url(#ah-${a.id})`} strokeLinecap="round" />
            );
          }
          return (
            <line key={a.id} x1={a.fromX} y1={a.fromY} x2={a.toX} y2={a.toY}
              stroke={a.color} strokeWidth="0.6" markerEnd={`url(#ah-${a.id})`}
              strokeDasharray={a.style === 'dashed' ? '1.5 1' : 'none'} strokeLinecap="round" />
          );
        })}
        {drawing && drawStart && drawEnd && (
          arrowStyle === 'curved' ? (
            <path d={`M ${drawStart.x} ${drawStart.y} Q ${(drawStart.x + drawEnd.x) / 2 - (drawEnd.y - drawStart.y) * 0.3} ${(drawStart.y + drawEnd.y) / 2 + (drawEnd.x - drawStart.x) * 0.3} ${drawEnd.x} ${drawEnd.y}`}
              fill="none" stroke={arrowColor} strokeWidth="0.6" markerEnd="url(#ah-preview)" strokeLinecap="round" opacity={0.7} />
          ) : (
            <line x1={drawStart.x} y1={drawStart.y} x2={drawEnd.x} y2={drawEnd.y}
              stroke={arrowColor} strokeWidth="0.6" markerEnd="url(#ah-preview)"
              strokeDasharray={arrowStyle === 'dashed' ? '1.5 1' : 'none'} strokeLinecap="round" opacity={0.7} />
          )
        )}
      </svg>
      )}

      {!lineupOnly && opponents.map(m => (
        <OpponentToken key={m.id} marker={m} pitchRef={pitchRef} onMove={onMoveOpponent} onRemove={onRemoveOpponent} activeTool={activeTool} laserOverlay={laserOverlay} readOnly={blockField} />
      ))}

      {players.map(player => (
        <PlayerToken key={player.id} player={player} pitchRef={pitchRef}
          onDragEnd={(nx, ny) => onPlayerMove(player.id, nx, ny)}
          isSelected={selectedPlayerId === player.id}
          swapHighlight={swapPendingId === player.id}
          isCaptain={captainPlayerId === player.id}
          onSelectPlayer={() => onSelectPlayer(player.id)}
          onSwapPick={() => onSwapTitularPick(player.id)}
          activeTool={activeTool}
          readOnly={blockField} />
      ))}
    </div>
  );
};

const OpponentToken: React.FC<{
  marker: OpponentMarker;
  pitchRef: React.RefObject<HTMLDivElement>;
  onMove: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
  activeTool: PitchTool;
  laserOverlay: boolean;
  readOnly?: boolean;
}> = ({ marker, pitchRef, onMove, onRemove, activeTool, laserOverlay, readOnly = false }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const canDrag = !readOnly && activeTool === 'move';

  const handleDragEnd = (_: any, info: any) => {
    if (!pitchRef.current) return;
    const rect = pitchRef.current.getBoundingClientRect();
    const nX = ((marker.x / 100 * rect.width + info.offset.x) / rect.width) * 100;
    const nY = ((marker.y / 100 * rect.height + info.offset.y) / rect.height) * 100;
    x.set(0); y.set(0);
    onMove(marker.id, Math.max(3, Math.min(97, nX)), Math.max(3, Math.min(97, nY)));
  };

  return (
    <motion.div
      style={{ x, y, left: `${marker.x}%`, top: `${marker.y}%`, position: 'absolute' }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 z-[8] touch-none ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''} ${laserOverlay ? 'pointer-events-none' : ''}`}
      drag={canDrag}
      dragConstraints={pitchRef}
      dragElastic={0}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      onDoubleClick={() => { if (!readOnly) onRemove(marker.id); }}
    >
      <div
        data-clean-capture
        className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-red-600 border-[2.5px] border-red-300 flex items-center justify-center"
      >
        <span className="text-[10px] md:text-xs font-black text-white">R</span>
      </div>
    </motion.div>
  );
};

/** Solo borde (sin sombra ni ring): html-to-image rasteriza mal box-shadow en PNG. */
const positionBorderColor = (pos: Position, selected: boolean, swapHi: boolean) => {
  if (swapHi) return 'border-amber-300 border-[3px] md:border-[3.5px]';
  if (selected) return 'border-yellow-400 border-[3px] md:border-[3.5px]';
  switch (pos) {
    case 'ARQ': return 'border-orange-400 border-[2.5px] md:border-[3px]';
    case 'DFC': case 'LI': case 'LD': return 'border-blue-400 border-[2.5px] md:border-[3px]';
    case 'MCD': case 'MC': case 'MCO': return 'border-emerald-400 border-[2.5px] md:border-[3px]';
    case 'ED': case 'EI': return 'border-violet-400 border-[2.5px] md:border-[3px]';
    case 'DC': return 'border-red-400 border-[2.5px] md:border-[3px]';
    default: return 'border-white/80 border-[2.5px] md:border-[3px]';
  }
};

const PlayerToken: React.FC<{
  player: Player;
  pitchRef: React.RefObject<HTMLDivElement>;
  onDragEnd: (x: number, y: number) => void;
  isSelected: boolean;
  swapHighlight: boolean;
  isCaptain: boolean;
  onSelectPlayer: () => void;
  onSwapPick: () => void;
  activeTool: PitchTool;
  readOnly?: boolean;
}> = ({ player, pitchRef, onDragEnd, isSelected, swapHighlight, isCaptain, onSelectPlayer, onSwapPick, activeTool, readOnly = false }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const canDrag = !readOnly && activeTool === 'move';
  const laserPassthrough = !readOnly && (activeTool === 'laser' || activeTool === 'pen');
  const swapMode = !readOnly && activeTool === 'swap';

  const handleDragEnd = (_: any, info: any) => {
    if (!pitchRef.current) return;
    const rect = pitchRef.current.getBoundingClientRect();
    const nX = ((player.pitchX / 100 * rect.width + info.offset.x) / rect.width) * 100;
    const nY = ((player.pitchY / 100 * rect.height + info.offset.y) / rect.height) * 100;
    x.set(0); y.set(0);
    onDragEnd(Math.max(4, Math.min(96, nX)), Math.max(4, Math.min(96, nY)));
  };

  const pointerClass = readOnly ? 'pointer-events-none' : laserPassthrough ? 'pointer-events-none' : 'pointer-events-auto';

  return (
    <motion.div
      style={{ x, y, left: `${player.pitchX}%`, top: `${player.pitchY}%`, position: 'absolute' }}
      className={`pitch-player-token absolute -translate-x-1/2 -translate-y-1/2 z-10 touch-none flex flex-col items-center gap-0.5 group ${readOnly ? '' : canDrag ? 'cursor-grab active:cursor-grabbing' : swapMode ? 'cursor-pointer' : ''} ${pointerClass}`}
      drag={canDrag}
      dragConstraints={pitchRef}
      dragElastic={0}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      onPointerDown={(e) => {
        if (swapMode) {
          e.stopPropagation();
          e.preventDefault();
          onSelectPlayer();
          onSwapPick();
        } else if (canDrag) {
          onSelectPlayer();
        }
      }}
    >
      <div
        className="pitch-token-ground absolute top-[55%] left-1/2 w-12 -translate-x-1/2 rounded-full bg-black/25 md:w-16 h-2 md:h-3 blur-sm pointer-events-none"
        aria-hidden
      />

      <div className="relative">
        {isCaptain && (
          <span
            data-clean-capture
            className="absolute -top-0.5 -left-0.5 z-20 w-5 h-5 md:w-6 md:h-6 rounded-full bg-amber-500 text-[8px] md:text-[9px] font-black text-black flex items-center justify-center border-2 border-black/50 pointer-events-none"
            title="Capitán"
          >
            C
          </span>
        )}
        <div
          data-clean-capture
          className={`pitch-token-face w-14 h-14 md:w-[72px] md:h-[72px] rounded-full ${positionBorderColor(player.position, isSelected, swapHighlight)} overflow-hidden transition-all duration-200 bg-slate-800 flex items-center justify-center ${isSelected ? 'scale-110' : ''}`}
        >
          {player.photoUrl ? (
            <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover object-top pointer-events-none" draggable={false} />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center">
              <span className="text-white/70 font-black text-base md:text-lg pointer-events-none">{player.number}</span>
            </div>
          )}
        </div>
        <div
          data-clean-capture
          className="absolute -bottom-1 -right-2 md:-bottom-1.5 md:-right-2.5 w-6 h-6 md:w-7 md:h-7 rounded-full bg-black/90 border-2 border-white/60 flex items-center justify-center pointer-events-none z-10"
        >
          <span className="text-[10px] md:text-xs font-black text-white">{player.number}</span>
        </div>
      </div>
      <div
        data-clean-capture
        className={`px-2 py-0.5 rounded-md text-[9px] md:text-[11px] font-bold whitespace-nowrap pointer-events-none ${isSelected ? 'bg-yellow-500 text-black' : 'bg-black/75 text-white backdrop-blur-sm'}`}
      >
        {player.name}
      </div>
    </motion.div>
  );
};
