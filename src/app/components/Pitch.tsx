import React, { useState, useCallback } from 'react';
import { motion, useMotionValue } from 'motion/react';
import { Player, TacticalArrow, OpponentMarker } from '../types';
import { useTheme } from './ThemeContext';

export type PitchTool = 'move' | 'draw' | 'opponent';

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
}

export const Pitch: React.FC<PitchProps> = ({
  players, onPlayerMove, selectedPlayerId, onSelectPlayer,
  arrows, onAddArrow, activeTool, arrowColor, arrowStyle, pitchRef,
  opponents, onAddOpponent, onMoveOpponent, onRemoveOpponent,
}) => {
  const { grassColor } = useTheme();
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null);

  const toPercent = useCallback((clientX: number, clientY: number) => {
    if (!pitchRef.current) return { x: 0, y: 0 };
    const rect = pitchRef.current.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }, [pitchRef]);

  const handlePointerDown = (e: React.PointerEvent) => {
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
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drawing || activeTool !== 'draw') return;
    setDrawEnd(toPercent(e.clientX, e.clientY));
  };

  const handlePointerUp = () => {
    if (!drawing || !drawStart || !drawEnd) { setDrawing(false); return; }
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
    setDrawing(false);
    setDrawStart(null);
    setDrawEnd(null);
  };

  const stripeCount = 14;
  const stripes = Array.from({ length: stripeCount }, (_, i) => ({
    top: `${(i / stripeCount) * 100}%`,
    height: `${100 / stripeCount}%`,
    lightness: i % 2 === 0 ? 0 : -10,
  }));

  const cursorClass = activeTool === 'draw' ? 'cursor-crosshair' : activeTool === 'opponent' ? 'cursor-cell' : '';

  return (
    <div
      ref={pitchRef}
      className={`relative border-[4px] md:border-[5px] border-white/90 aspect-[2/3] w-full mx-auto overflow-hidden select-none rounded-xl ${cursorClass}`}
      style={{
        backgroundColor: grassColor,
        boxShadow: '0 0 60px rgba(0,0,0,0.5), inset 0 0 80px rgba(0,0,0,0.15)',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => { if (drawing) handlePointerUp(); }}
    >
      {/* Grass stripes */}
      {stripes.map((s, i) => (
        <div key={i} className="absolute left-0 w-full pointer-events-none" style={{
          top: s.top, height: s.height,
          backgroundColor: `color-mix(in srgb, ${grassColor} 100%, ${s.lightness < 0 ? 'black' : 'white'} ${Math.abs(s.lightness)}%)`,
          opacity: 0.55,
        }} />
      ))}

      {/* Texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.06]" style={{
        backgroundImage: `radial-gradient(circle at 20% 30%, rgba(255,255,255,0.3) 0%, transparent 2%), radial-gradient(circle at 60% 70%, rgba(255,255,255,0.2) 0%, transparent 1.5%), linear-gradient(0deg, rgba(0,0,0,0.05) 1px, transparent 1px)`,
        backgroundSize: '60px 60px, 40px 40px, 14px 14px',
      }} />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.2) 100%)' }} />

      {/* PITCH LINES */}
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

      {/* SVG ARROWS */}
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

      {/* OPPONENT MARKERS */}
      {opponents.map(m => (
        <OpponentToken key={m.id} marker={m} pitchRef={pitchRef} onMove={onMoveOpponent} onRemove={onRemoveOpponent} activeTool={activeTool} />
      ))}

      {/* PLAYERS */}
      {players.map(player => (
        <PlayerToken key={player.id} player={player} pitchRef={pitchRef}
          onDragEnd={(nx, ny) => onPlayerMove(player.id, nx, ny)}
          isSelected={selectedPlayerId === player.id}
          onClick={() => onSelectPlayer(player.id)}
          activeTool={activeTool} />
      ))}
    </div>
  );
};

/* ---- OPPONENT TOKEN ---- */
const OpponentToken: React.FC<{
  marker: OpponentMarker;
  pitchRef: React.RefObject<HTMLDivElement>;
  onMove: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
  activeTool: PitchTool;
}> = ({ marker, pitchRef, onMove, onRemove, activeTool }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const canDrag = activeTool === 'move';

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
      className={`absolute -translate-x-1/2 -translate-y-1/2 z-[8] touch-none ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
      drag={canDrag}
      dragConstraints={pitchRef}
      dragElastic={0}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      onDoubleClick={() => onRemove(marker.id)}
    >
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-red-600 border-[2.5px] border-red-300 shadow-[0_0_12px_rgba(220,38,38,0.6)] flex items-center justify-center">
        <span className="text-[10px] md:text-xs font-black text-white">R</span>
      </div>
    </motion.div>
  );
};

/* ---- PLAYER TOKEN ---- */
const positionBorderColor = (pos: string, selected: boolean) => {
  if (selected) return 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.9)]';
  switch (pos) {
    case 'ARQ': return 'border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]';
    case 'DFC': case 'LI': case 'LD': return 'border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]';
    case 'MCD': case 'MC': case 'MCO': return 'border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
    case 'ED': case 'EI': return 'border-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.5)]';
    case 'DC': return 'border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    default: return 'border-white/80';
  }
};

const PlayerToken: React.FC<{
  player: Player;
  pitchRef: React.RefObject<HTMLDivElement>;
  onDragEnd: (x: number, y: number) => void;
  isSelected: boolean;
  onClick: () => void;
  activeTool: PitchTool;
}> = ({ player, pitchRef, onDragEnd, isSelected, onClick, activeTool }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const canDrag = activeTool === 'move';

  const handleDragEnd = (_: any, info: any) => {
    if (!pitchRef.current) return;
    const rect = pitchRef.current.getBoundingClientRect();
    const nX = ((player.pitchX / 100 * rect.width + info.offset.x) / rect.width) * 100;
    const nY = ((player.pitchY / 100 * rect.height + info.offset.y) / rect.height) * 100;
    x.set(0); y.set(0);
    onDragEnd(Math.max(4, Math.min(96, nX)), Math.max(4, Math.min(96, nY)));
  };

  return (
    <motion.div
      style={{ x, y, left: `${player.pitchX}%`, top: `${player.pitchY}%`, position: 'absolute' }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 touch-none flex flex-col items-center gap-0.5 group ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
      drag={canDrag}
      dragConstraints={pitchRef}
      dragElastic={0}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      onPointerDown={canDrag ? onClick : undefined}
    >
      <div className="absolute top-[55%] left-1/2 -translate-x-1/2 w-12 md:w-16 h-2 md:h-3 bg-black/25 rounded-full blur-sm pointer-events-none" />

      <div className="relative">
        <div className={`w-14 h-14 md:w-[72px] md:h-[72px] rounded-full border-[2.5px] md:border-[3px] ${positionBorderColor(player.position, isSelected)} overflow-hidden transition-all duration-200 bg-slate-800 flex items-center justify-center ${isSelected ? 'scale-110' : ''}`}>
          {player.photoUrl ? (
            <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover object-top pointer-events-none" draggable={false} />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center">
              <span className="text-white/70 font-black text-base md:text-lg pointer-events-none">{player.number}</span>
            </div>
          )}
        </div>
        <div className="absolute -bottom-1 -right-2 md:-bottom-1.5 md:-right-2.5 w-6 h-6 md:w-7 md:h-7 rounded-full bg-black/90 border-2 border-white/60 flex items-center justify-center pointer-events-none shadow-lg z-10">
          <span className="text-[10px] md:text-xs font-black text-white">{player.number}</span>
        </div>
      </div>
      <div className={`px-2 py-0.5 rounded-md text-[9px] md:text-[11px] font-bold whitespace-nowrap pointer-events-none ${isSelected ? 'bg-yellow-500 text-black' : 'bg-black/75 text-white backdrop-blur-sm'}`}>
        {player.name}
      </div>
    </motion.div>
  );
};