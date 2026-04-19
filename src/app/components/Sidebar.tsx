import React, { useState, useRef, useEffect } from 'react';
import { Player, Position } from '../types';
import { POSITION_LABELS } from '../App';
import { POSITION_DISPLAY_ORDER, positionBadgeClasses } from '../positionStyles';
import { useTheme } from './ThemeContext';
import { Camera, Trash2, User, UserPlus, ArrowLeftRight, ChevronDown, ChevronUp, LogIn, Star, X, Upload, Loader2, Pencil, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from 'sonner';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-f6cf3a30`;

interface SidebarProps {
  players: Player[];
  onAddPlayer: (player: Omit<Player, 'id'>) => void;
  onUpdatePlayer: (id: string, updates: Partial<Player>) => void;
  onRemovePlayer: (id: string) => void;
  onSendToPitch: (id: string) => void;
  selectedPlayerId: string | null;
  onSelectPlayer: (id: string) => void;
  onSubstitution: (onPitchId: string, benchId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  /** Guarda en Supabase justo después de foto/URL (el autosave va con debounce y se pierde al recargar). */
  onRequestPersist?: () => void;
  /** Panel opcional arriba (ej. tácticas guardadas). */
  savedTacticsPanel?: React.ReactNode;
  /** Bloqueo global: cubre plantilla hasta introducir PIN en la pizarra. */
  editLocked: boolean;
  onRequestUnlock: () => void;
  captainPlayerId: string | null;
  onSetCaptain: (playerId: string) => void;
  coachName: string;
  coachPhotoUrl: string;
  onCoachName: (v: string) => void;
  onCoachPhotoUrl: (v: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  players, onAddPlayer, onUpdatePlayer, onRemovePlayer, onSendToPitch,
  selectedPlayerId, onSelectPlayer, onSubstitution, isOpen, onClose,
  onRequestPersist,
  savedTacticsPanel,
  editLocked,
  onRequestUnlock,
  captainPlayerId,
  onSetCaptain,
  coachName,
  coachPhotoUrl,
  onCoachName,
  onCoachPhotoUrl,
}) => {
  const { isDark } = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [subMode, setSubMode] = useState<string | null>(null);
  const [showBench, setShowBench] = useState(true);
  /** Solo al pulsar el lápiz se abre el panel "Editar jugador". */
  const [editOpen, setEditOpen] = useState(false);
  /** Misma idea que jugadores: fila compacta + lápiz → panel de edición. */
  const [coachEditOpen, setCoachEditOpen] = useState(false);
  /** Capitán: replegado por defecto; al desplegar se elige entre titulares. */
  const [captainSectionExpanded, setCaptainSectionExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [coachUploading, setCoachUploading] = useState(false);
  const [coachFileKey, setCoachFileKey] = useState(0);
  const coachFileInputRef = useRef<HTMLInputElement>(null);
  const selectedPlayer = players.find(p => p.id === selectedPlayerId);

  useEffect(() => {
    setEditOpen(false);
    setCoachEditOpen(false);
  }, [selectedPlayerId]);

  const pitchPlayers = players.filter(p => p.isOnPitch);
  const benchPlayers = players.filter(p => !p.isOnPitch);

  const subOutPlayer = subMode ? players.find(p => p.id === subMode) : null;
  const sortedBench = subOutPlayer
    ? [...benchPlayers].sort((a, b) => (a.position === subOutPlayer.position ? 0 : 1) - (b.position === subOutPlayer.position ? 0 : 1))
    : benchPlayers;

  const handleAddNew = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get('name') as string;
    const number = parseInt(fd.get('number') as string, 10);
    const position = fd.get('position') as Position;
    if (!name || isNaN(number)) return;
    onAddPlayer({ name, number, position, photoUrl: '', pitchX: 50, pitchY: 50, isOnPitch: false });
    setIsAdding(false);
  };

  const handleSubSelect = (benchId: string) => {
    if (subMode) { onSubstitution(subMode, benchId); setSubMode(null); }
  };

  const handleUploadPhoto = async (file: File) => {
    if (!selectedPlayer) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('playerId', selectedPlayer.id);
      const res = await fetch(`${API_BASE}/upload-photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Upload error:', data);
        toast.error(data.error || 'Error al subir foto');
        return;
      }
      onUpdatePlayer(selectedPlayer.id, { photoUrl: data.url });
      toast.success('Foto actualizada!');
      // Guardar en la nube en el siguiente tick para que React aplique ya el nuevo photoUrl
      setTimeout(() => onRequestPersist?.(), 0);
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Error de conexión al subir foto');
    } finally {
      setUploading(false);
      setFileInputKey(k => k + 1);
    }
  };

  const handleUploadCoachPhoto = async (file: File) => {
    setCoachUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('playerId', 'dt-coach');
      const res = await fetch(`${API_BASE}/upload-photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Coach upload error:', data);
        toast.error(data.error || 'Error al subir foto del DT');
        return;
      }
      onCoachPhotoUrl(data.url);
      toast.success('Foto del DT subida a la nube');
      setTimeout(() => onRequestPersist?.(), 0);
    } catch (err) {
      console.error('Coach upload failed:', err);
      toast.error('Error de conexión al subir foto');
    } finally {
      setCoachUploading(false);
      setCoachFileKey((k) => k + 1);
    }
  };

  const sidebarBg = isDark ? 'bg-slate-900/95 text-white border-white/10' : 'bg-white/95 text-gray-900 border-gray-200';
  const cardBg = isDark ? 'bg-slate-800' : 'bg-gray-100';
  const inputBg = isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-gray-300 text-gray-900';
  const mutedText = isDark ? 'text-slate-400' : 'text-gray-500';
  const hoverCard = isDark ? 'hover:bg-slate-800 hover:border-slate-700' : 'hover:bg-gray-100 hover:border-gray-300';

  const content = (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {editLocked && (
        <div className="absolute inset-0 z-[25] flex flex-col items-center justify-center gap-3 bg-slate-950/45 px-5 text-center backdrop-blur-[3px]">
          <Lock className="h-9 w-9 text-amber-400/95" aria-hidden />
          <p className="text-sm font-bold text-white">Plantilla bloqueada</p>
          <p className={`max-w-[220px] text-[11px] leading-snug ${mutedText} text-slate-300`}>
            Desbloquea con el candado y el PIN. Modo foco y color de césped siguen disponibles arriba.
          </p>
          <button
            type="button"
            onClick={onRequestUnlock}
            className="rounded-lg border border-amber-400/60 bg-amber-500/15 px-4 py-2 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500/25"
          >
            Introducir PIN
          </button>
        </div>
      )}
      {savedTacticsPanel}
      <div className={`p-4 md:p-5 border-b flex justify-between items-center ${isDark ? 'border-white/10 bg-slate-900/50' : 'border-gray-200 bg-gray-50/80'}`}>
        <div>
          <h2 className="text-lg md:text-xl font-black uppercase tracking-wider text-emerald-500">Plantilla</h2>
          <p className={`text-xs mt-1 ${mutedText}`}>{pitchPlayers.length} titulares &middot; {benchPlayers.length} suplentes</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsAdding(!isAdding)}
            className="p-2 bg-emerald-500 hover:bg-emerald-600 rounded-full transition-colors text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]">
            {isAdding ? <User className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
          </button>
          <button onClick={onClose} className="md:hidden p-2 rounded-lg bg-white/10 hover:bg-white/20">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
        <div
          className={`rounded-xl border p-3 ${cardBg} ${isDark ? 'border-amber-500/25 bg-amber-500/[0.06]' : 'border-amber-200 bg-amber-50/40'}`}
        >
          <button
            type="button"
            disabled={pitchPlayers.length === 0}
            onClick={() => pitchPlayers.length > 0 && setCaptainSectionExpanded((v) => !v)}
            aria-expanded={captainSectionExpanded}
            className={`flex w-full items-start gap-3 rounded-lg text-left transition-colors ${
              pitchPlayers.length === 0 ? 'cursor-default opacity-80' : `${isDark ? 'hover:bg-white/5' : 'hover:bg-black/[0.03]'} -m-0.5 p-0.5`
            }`}
          >
            <div className="min-w-0 flex-1">
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>Capitán</h3>
              <p className={`text-[10px] leading-snug ${mutedText}`}>
                {pitchPlayers.length === 0
                  ? 'Aún no hay titulares.'
                  : captainSectionExpanded
                    ? 'Toca un titular para asignarlo. El elegido lleva el borde dorado.'
                    : 'Solo titulares. Despliega para cambiar al capitán.'}
              </p>
            </div>
            {pitchPlayers.length > 0 && (
              <div className="flex shrink-0 items-center gap-1.5">
                {(() => {
                  const cap = captainPlayerId ? pitchPlayers.find((p) => p.id === captainPlayerId) : null;
                  if (cap) {
                    return (
                      <div
                        className="pointer-events-none relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-amber-400 ring-2 ring-amber-400/70 ring-offset-2 ring-offset-transparent sm:h-11 sm:w-11"
                        aria-hidden
                      >
                        {cap.photoUrl ? (
                          <img src={cap.photoUrl} alt="" className="h-full w-full object-cover object-top" draggable={false} />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center bg-slate-800 text-[10px] font-black text-white">
                            {cap.number}
                          </span>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div
                      className={`pointer-events-none flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed sm:h-11 sm:w-11 ${
                        isDark ? 'border-slate-500 text-slate-500' : 'border-gray-400 text-gray-400'
                      }`}
                      aria-hidden
                    >
                      <span className="text-[10px] font-bold">—</span>
                    </div>
                  );
                })()}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${mutedText} ${captainSectionExpanded ? '-rotate-180' : ''}`}
                  aria-hidden
                />
              </div>
            )}
          </button>
          {captainSectionExpanded && pitchPlayers.length > 0 && (
            <div className={`mt-3 flex flex-wrap gap-2 border-t pt-3 ${isDark ? 'border-amber-500/20' : 'border-amber-200/80'}`}>
              {pitchPlayers.map((p) => {
                const active = captainPlayerId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    title={p.name}
                    onClick={() => {
                      onSetCaptain(p.id);
                      setCaptainSectionExpanded(false);
                    }}
                    className={`relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 transition-transform sm:h-11 sm:w-11 ${
                      active
                        ? 'border-amber-400 ring-2 ring-amber-400/70 ring-offset-2 ring-offset-transparent scale-105'
                        : 'border-slate-600 hover:border-amber-400/60'
                    }`}
                  >
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt="" className="h-full w-full object-cover object-top" draggable={false} />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-slate-800 text-[10px] font-black text-white">
                        {p.number}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {isAdding && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className={`${cardBg} rounded-lg p-4 border border-emerald-500/30`}>
            <h3 className="text-sm font-bold mb-3 text-emerald-400">Agregar Jugador</h3>
            <form onSubmit={handleAddNew} className="space-y-3">
              <input name="name" placeholder="Nombre del jugador" required className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 ${inputBg}`} />
              <div className="flex gap-2">
                <input name="number" type="number" placeholder="N°" required className={`w-1/3 border rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 ${inputBg}`} />
                <select name="position" className={`w-2/3 border rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 ${inputBg}`}>
                  {POSITION_DISPLAY_ORDER.map(pos => <option key={pos} value={pos}>{POSITION_LABELS[pos]}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded text-sm transition-colors">Agregar al plantel</button>
            </form>
          </motion.div>
        )}

        {selectedPlayer && !isAdding && !editOpen && (
          <div className={`${cardBg} rounded-xl p-3 border border-white/10 flex items-center gap-3`}>
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 border border-slate-600 shrink-0">
              {selectedPlayer.photoUrl ? <img src={selectedPlayer.photoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-500 font-black">{selectedPlayer.number}</div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">{selectedPlayer.name}</div>
              <div className={`text-[10px] ${mutedText}`}>#{selectedPlayer.number} · {POSITION_LABELS[selectedPlayer.position]}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setCoachEditOpen(false);
                setEditOpen(true);
              }}
              className="shrink-0 p-2.5 rounded-lg bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border border-yellow-500/40"
              title="Editar jugador"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        )}

        {selectedPlayer && !isAdding && editOpen && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className={`${cardBg} rounded-xl p-4 md:p-5 border border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)] relative overflow-hidden`}>
            <div className="absolute top-0 right-0 p-3 opacity-10"><span className="text-5xl md:text-6xl font-black">{selectedPlayer.number}</span></div>
            <div className="flex justify-between items-start mb-3 relative z-10">
              <h3 className="text-base md:text-lg font-bold text-yellow-500">Editar jugador</h3>
              <div className="flex gap-1">
                <button type="button" onClick={() => setEditOpen(false)} className={`p-1 rounded-md ${mutedText} hover:text-white`} title="Cerrar edición"><X className="w-4 h-4" /></button>
                {!selectedPlayer.isOnPitch && pitchPlayers.length < 11 && (
                  <button onClick={() => onSendToPitch(selectedPlayer.id)} className="text-emerald-400 hover:text-emerald-300 p-1 bg-emerald-400/10 rounded-md"><LogIn className="w-4 h-4" /></button>
                )}
                <button onClick={() => onRemovePlayer(selectedPlayer.id)} className="text-red-400 hover:text-red-300 p-1 bg-red-400/10 rounded-md"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="space-y-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden bg-slate-900 border-2 border-slate-700 shrink-0 group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}>
                  {selectedPlayer.photoUrl ? <img src={selectedPlayer.photoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-500"><Camera className="w-6 h-6" /></div>}
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Upload className="w-5 h-5 text-white" />}
                  </div>
                </div>
                <input key={fileInputKey} ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadPhoto(f); }} />
                <div className="flex-1 flex items-center">
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isDark ? 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10' : 'border-yellow-400 text-yellow-600 hover:bg-yellow-5'} ${uploading ? 'opacity-50' : ''}`}>
                    {uploading ? <><Loader2 className="w-3 h-3 animate-spin" /> Subiendo...</> : <><Upload className="w-3 h-3" /> Subir foto</>}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={`text-xs mb-1 block ${mutedText}`}>Nombre</label><input value={selectedPlayer.name} onChange={e => onUpdatePlayer(selectedPlayer.id, { name: e.target.value })} className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 ${inputBg}`} /></div>
                <div><label className={`text-xs mb-1 block ${mutedText}`}>Dorsal</label><input type="number" value={selectedPlayer.number} onChange={e => onUpdatePlayer(selectedPlayer.id, { number: parseInt(e.target.value) || 0 })} className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 ${inputBg}`} /></div>
              </div>
              <div>
                <label className={`text-xs mb-2 block ${mutedText}`}>Posicion</label>
                <div className={`flex flex-wrap rounded-lg p-1 gap-1 border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-gray-200 border-gray-300'}`}>
                  {POSITION_DISPLAY_ORDER.map(pos => (
                    <button key={pos} onClick={() => onUpdatePlayer(selectedPlayer.id, { position: pos })}
                      className={`px-2 py-1.5 rounded-md text-[10px] font-bold transition-all ${selectedPlayer.position === pos ? 'bg-yellow-500 text-black shadow-md' : `${mutedText} hover:text-current`}`}>
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {subMode && subOutPlayer && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-3 text-center">
            <p className="text-xs text-amber-400 font-bold mb-1">Cambio: {subOutPlayer.name} ({POSITION_LABELS[subOutPlayer.position]})</p>
            <p className="text-[10px] text-amber-300/70">Misma posicion primero</p>
            <button onClick={() => setSubMode(null)} className={`text-xs mt-2 ${mutedText}`}>Cancelar</button>
          </motion.div>
        )}

        {/* Titulares */}
        <div className="space-y-1.5">
          <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${mutedText}`}>Titulares ({pitchPlayers.length}/11)</h3>
          {pitchPlayers.map(p => (
            <PlayerRow key={p.id} player={p} isSelected={selectedPlayerId === p.id} isDark={isDark}
              cardBg={cardBg} hoverCard={hoverCard} mutedText={mutedText}
              onClick={() => {
                if (!subMode) {
                  setCoachEditOpen(false);
                  onSelectPlayer(p.id);
                }
              }}
              actionBtn={(
                <div className="flex items-center gap-0.5 shrink-0">
                  <button type="button" title="Intercambio / suplente" onClick={e => { e.stopPropagation(); setSubMode(p.id); }} className="p-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/30 text-amber-400"><ArrowLeftRight className="w-3.5 h-3.5" /></button>
                </div>
              )} />
          ))}
        </div>

        {/* Suplentes */}
        <div className="space-y-1.5 mt-3">
          <button onClick={() => setShowBench(!showBench)} className="flex items-center gap-2 w-full px-1">
            <h3 className={`text-xs font-bold uppercase tracking-widest ${mutedText}`}>Suplentes ({benchPlayers.length})</h3>
            {showBench ? <ChevronUp className={`w-3 h-3 ${mutedText}`} /> : <ChevronDown className={`w-3 h-3 ${mutedText}`} />}
          </button>
          <AnimatePresence>
            {showBench && sortedBench.map(p => {
              const rec = subOutPlayer && p.position === subOutPlayer.position;
              return (
                <motion.div key={p.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                  <div onClick={() => {
                    if (subMode) handleSubSelect(p.id);
                    else {
                      setCoachEditOpen(false);
                      onSelectPlayer(p.id);
                    }
                  }}
                    className={`flex items-center gap-3 p-2 md:p-2.5 rounded-lg cursor-pointer transition-all border ${
                      subMode ? (rec ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-amber-500/20 hover:bg-amber-500/10')
                      : selectedPlayerId === p.id ? `${cardBg} border-yellow-500/50 shadow-md`
                      : `${isDark ? 'bg-slate-900/50' : 'bg-white/50'} border-transparent ${hoverCard}`}`}>
                    <div className="w-10 h-10 md:w-11 md:h-11 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                      {p.photoUrl ? <img src={p.photoUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-slate-400">{p.number}</span>}
                    </div>
                    <div className="flex-1 truncate">
                      <div className={`font-bold text-sm truncate ${subMode ? (rec ? 'text-emerald-400' : 'text-amber-300') : selectedPlayerId === p.id ? 'text-yellow-500' : mutedText}`}>{p.name}</div>
                      <div className={`text-xs flex items-center gap-2 ${mutedText}`}>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider ${positionBadgeClasses(p.position)}`}>{POSITION_LABELS[p.position]}</span>
                        #{p.number}
                      </div>
                    </div>
                    {subMode && rec && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded"><Star className="w-3 h-3" /> REC</span>}
                    {subMode && !rec && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-1 rounded">ENTRAR</span>}
                    {!subMode && pitchPlayers.length < 11 && (
                      <button onClick={e => { e.stopPropagation(); onSendToPitch(p.id); }} className="p-1.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/30 text-emerald-400"><LogIn className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${mutedText}`}>Director técnico</h3>

          {!coachEditOpen && (
            <div className={`${cardBg} rounded-xl p-3 border flex items-center gap-3 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-800 border border-slate-600 shrink-0 flex items-center justify-center">
                {coachPhotoUrl ? (
                  <img src={coachPhotoUrl} alt="" className="w-full h-full object-cover object-top" draggable={false} />
                ) : (
                  <span className="text-sm font-black text-amber-400">DT</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{coachName.trim() || 'D.T.'}</div>
                <div className={`text-xs flex items-center gap-2 flex-wrap ${mutedText}`}>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider bg-amber-500/20 text-amber-400">
                    Director técnico
                  </span>
                  <span className="text-[9px] font-bold text-slate-500">—</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditOpen(false);
                  setCoachEditOpen(true);
                }}
                className="shrink-0 p-2.5 rounded-lg bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border border-yellow-500/40"
                title="Editar director técnico"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          )}

          {coachEditOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`${cardBg} rounded-xl p-4 md:p-5 border border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)] relative overflow-hidden`}
            >
              <div className="flex justify-between items-start mb-3 relative z-10">
                <h3 className="text-base md:text-lg font-bold text-yellow-500">Editar director técnico</h3>
                <button
                  type="button"
                  onClick={() => setCoachEditOpen(false)}
                  className={`p-1 rounded-md ${mutedText} hover:text-white`}
                  title="Cerrar edición"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3 relative z-10">
                <div className="flex items-center gap-3">
                  <div
                    className="relative w-16 h-16 md:h-20 md:w-20 rounded-xl overflow-hidden bg-slate-900 border-2 border-slate-700 shrink-0 group cursor-pointer"
                    onClick={() => coachFileInputRef.current?.click()}
                  >
                    {coachPhotoUrl ? (
                      <img src={coachPhotoUrl} alt="" className="w-full h-full object-cover object-top" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <Camera className="w-6 h-6" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {coachUploading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Upload className="w-5 h-5 text-white" />}
                    </div>
                  </div>
                  <input
                    key={coachFileKey}
                    ref={coachFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUploadCoachPhoto(f);
                    }}
                  />
                  <div className="flex-1 flex items-center">
                    <button
                      type="button"
                      onClick={() => coachFileInputRef.current?.click()}
                      disabled={coachUploading}
                      className={`w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        isDark ? 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10' : 'border-yellow-400 text-yellow-600 hover:bg-yellow-50'
                      } ${coachUploading ? 'opacity-50' : ''}`}
                    >
                      {coachUploading ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" /> Subiendo…
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3" /> Subir foto (nube)
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={`text-xs mb-1 block ${mutedText}`}>Nombre</label>
                  <input
                    value={coachName}
                    onChange={(e) => onCoachName(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 ${inputBg}`}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className={`hidden md:flex flex-col h-full w-full max-w-[340px] lg:max-w-[360px] backdrop-blur-md border-r overflow-hidden shadow-2xl transition-colors duration-300 ${sidebarBg}`}>
        {content}
      </div>

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onClose} />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`fixed top-0 left-0 bottom-0 w-[85vw] max-w-[360px] z-50 md:hidden flex flex-col ${sidebarBg} backdrop-blur-md shadow-2xl`}>
              {content}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

/* Reusable player row */
const PlayerRow: React.FC<{
  player: Player; isSelected: boolean; isDark: boolean;
  cardBg: string; hoverCard: string; mutedText: string;
  onClick: () => void; actionBtn: React.ReactNode;
}> = ({ player, isSelected, isDark, cardBg, hoverCard, mutedText, onClick, actionBtn }) => (
  <div onClick={onClick}
    className={`flex items-center gap-3 p-2 md:p-2.5 rounded-lg cursor-pointer transition-all border ${
      isSelected ? `${cardBg} border-yellow-500/50 shadow-md` : `${isDark ? 'bg-slate-900/50' : 'bg-white/50'} border-transparent ${hoverCard}`}`}>
    <div className="w-10 h-10 md:w-11 md:h-11 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
      {player.photoUrl ? <img src={player.photoUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-slate-400">{player.number}</span>}
    </div>
    <div className="flex-1 truncate">
      <div className={`font-bold text-sm truncate ${isSelected ? 'text-yellow-500' : ''}`}>{player.name}</div>
      <div className={`text-xs flex items-center gap-2 ${mutedText}`}>
        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider ${positionBadgeClasses(player.position)}`}>{POSITION_LABELS[player.position]}</span>
        #{player.number}
      </div>
    </div>
    {actionBtn}
  </div>
);