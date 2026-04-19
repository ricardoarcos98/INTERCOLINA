import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { Player, Position, Formation, TacticalArrow, OpponentMarker } from './types';
import { Pitch, PitchTool } from './components/Pitch';
import { Sidebar } from './components/Sidebar';
import { ThemeProvider, useTheme, GRASS_COLORS } from './components/ThemeContext';
import { Toaster, toast } from 'sonner';
import {
  Sun, Moon, Palette, Download, Pencil, Trash2, Minus, Spline, CornerDownRight,
  Menu, Move, Circle, Plus, X, ChevronDown, ChevronUp, Save, CloudOff, Cloud, Loader2
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-f6cf3a30`;
const TACTIC_KEY = 'tactic-main';

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
  variant: 'rail' | 'mobile';
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
};

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
}: TacticalToolbarProps) {
  const rail = variant === 'rail';
  const sep = (
    <div
      className={`shrink-0 ${rail ? `h-px w-6 ${isDark ? 'bg-white/10' : 'bg-gray-200'}` : `w-px h-7 self-center ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}`}
      aria-hidden
    />
  );

  const tools = (
    <>
      <button type="button" onClick={() => setActiveTool('move')} className={btn(activeTool === 'move')} title="Mover">
        <Move className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => setActiveTool('draw')} className={btn(activeTool === 'draw')} title="Flechas">
        <Pencil className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => setActiveTool('opponent')} className={btn(activeTool === 'opponent')} title="Rivales">
        <Circle className="w-4 h-4" />
      </button>
      {sep}
      <button type="button" onClick={() => setArrowStyle('solid')} className={btn(arrowStyle === 'solid')} title="Solida">
        <Minus className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => setArrowStyle('dashed')} className={btn(arrowStyle === 'dashed')} title="Punteada">
        <span className="text-[10px] font-bold tracking-widest">--</span>
      </button>
      <button type="button" onClick={() => setArrowStyle('curved')} className={btn(arrowStyle === 'curved')} title="Curva">
        <Spline className="w-4 h-4" />
      </button>
      {sep}
      {ARROW_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setArrowColor(c)}
          className={`w-5 h-5 shrink-0 rounded-full border-2 hover:scale-110 transition-transform ${arrowColor === c ? 'border-white scale-110' : 'border-white/20'}`}
          style={{ backgroundColor: c }}
          title={c}
          aria-label={`Color de flecha ${c}`}
        />
      ))}
      {sep}
      <button type="button" onClick={() => setArrows((p) => p.slice(0, -1))} className={btn()} title="Deshacer flecha">
        <CornerDownRight className="w-4 h-4 rotate-180" />
      </button>
      <button
        type="button"
        onClick={() => {
          setArrows([]);
          setOpponents([]);
          toast('Limpiado');
        }}
        className={btn()}
        title="Limpiar todo"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </>
  );

  if (rail) {
    return (
      <div
        className={`hidden md:flex absolute -left-12 md:-left-14 top-0 flex-col items-center gap-1 md:gap-1.5 p-1 md:p-1.5 rounded-xl border z-10 ${
          isDark ? 'bg-slate-900/80 border-white/10' : 'bg-white/90 border-gray-200'
        } backdrop-blur-sm`}
      >
        {tools}
      </div>
    );
  }

  return (
    <div
      className={`md:hidden w-full mb-2 flex flex-row flex-wrap items-center justify-center gap-1.5 p-2 rounded-xl border z-10 touch-manipulation ${
        isDark ? 'bg-slate-900/85 border-white/10' : 'bg-white/95 border-gray-200'
      } shadow-sm`}
    >
      {tools}
    </div>
  );
}

function AppContent() {
  const { isDark, toggleTheme, grassColor, setGrassColor } = useTheme();
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [currentFormation, setCurrentFormation] = useState('4-3-3');
  const [showGrassMenu, setShowGrassMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [arrows, setArrows] = useState<TacticalArrow[]>([]);
  const [activeTool, setActiveTool] = useState<PitchTool>('move');
  const [arrowColor, setArrowColor] = useState('#facc15');
  const [arrowStyle, setArrowStyle] = useState<'solid' | 'dashed' | 'curved'>('solid');

  const [opponents, setOpponents] = useState<OpponentMarker[]>([]);

  // Custom formation
  const [allFormations, setAllFormations] = useState<Formation[]>(FORMATIONS);
  const [showCreateFormation, setShowCreateFormation] = useState(false);
  const [customName, setCustomName] = useState('');

  const [showFormations, setShowFormations] = useState(false);

  const pitchRef = useRef<HTMLDivElement>(null!);

  // Save/Load state
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const initialLoadDone = useRef(false);

  const pitchPlayers = players.filter(p => p.isOnPitch);

  const tacticSnapshot = useRef({
    players,
    arrows,
    opponents,
    currentFormation,
    allFormations,
  });
  tacticSnapshot.current = { players, arrows, opponents, currentFormation, allFormations };

  const saveLockRef = useRef(false);

  // Mark unsaved when data changes (after initial load)
  useEffect(() => {
    if (initialLoadDone.current) {
      setHasUnsaved(true);
    }
  }, [players, arrows, opponents, currentFormation, allFormations]);

  // Load tactic from Supabase on mount
  useEffect(() => {
    const loadTactic = async () => {
      try {
        const res = await fetch(`${API_BASE}/load-tactic/${TACTIC_KEY}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.players) setPlayers(data.players);
          if (data.arrows) setArrows(data.arrows);
          if (data.opponents) setOpponents(data.opponents);
          if (data.formation) setCurrentFormation(data.formation);
          if (data.customFormations) {
            setAllFormations([...FORMATIONS, ...data.customFormations]);
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

  // Save tactic to Supabase (lee siempre tacticSnapshot para no perder fotos al guardar justo después de subir URL)
  const handleSaveToCloud = useCallback(async (silent = false) => {
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    setSaving(true);
    try {
      const { players: p, arrows: a, opponents: o, currentFormation: f, allFormations: af } = tacticSnapshot.current;
      const customFormations = af.filter((fm) => fm.isCustom);
      const body = {
        id: TACTIC_KEY,
        players: p,
        arrows: a,
        opponents: o,
        formation: f,
        customFormations,
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
        const err = await res.text();
        console.log('Error saving tactic:', err);
        if (!silent) toast.error('Error al guardar');
        return;
      }
      setLastSaved(new Date());
      setHasUnsaved(false);
      if (!silent) toast.success('Guardado en la nube!');
    } catch (err) {
      console.log('Error saving tactic:', err);
      if (!silent) toast.error('Error de conexion');
    } finally {
      saveLockRef.current = false;
      setSaving(false);
    }
  }, []);

  // Autosave con debounce (tras foto/URL ya se fuerza guardado desde Sidebar)
  useEffect(() => {
    if (!hasUnsaved || !initialLoadDone.current) return;
    const timer = setTimeout(() => {
      handleSaveToCloud(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [hasUnsaved, players, arrows, opponents, currentFormation, allFormations, handleSaveToCloud]);

  const handlePlayerMove = (id: string, x: number, y: number) => setPlayers(prev => prev.map(p => p.id === id ? { ...p, pitchX: x, pitchY: y } : p));

  const handleAddPlayer = (np: Omit<Player, 'id'>) => {
    const p: Player = { ...np, id: Math.random().toString(36).substr(2, 9) };
    setPlayers(prev => [...prev, p]);
    setSelectedPlayerId(p.id);
    toast.success(`${p.name} agregado`);
  };

  const handleUpdatePlayer = (id: string, u: Partial<Player>) => setPlayers(prev => prev.map(p => p.id === id ? { ...p, ...u } : p));

  const handleRemoveFromPitch = (id: string) => {
    const p = players.find(pl => pl.id === id);
    if (!p) return;
    if (p.isOnPitch) {
      setPlayers(prev => prev.map(pl => pl.id === id ? { ...pl, isOnPitch: false } : pl));
      toast('📋 ' + p.name + ' al banquillo');
    } else {
      setPlayers(prev => prev.filter(pl => pl.id !== id));
      toast.error(`${p.name} eliminado`);
    }
    if (selectedPlayerId === id) setSelectedPlayerId(null);
  };

  const handleSendToPitch = (id: string) => {
    const p = players.find(pl => pl.id === id);
    if (!p) return;
    if (pitchPlayers.length >= 11) { toast.error('Ya hay 11 en el campo'); return; }
    setPlayers(prev => prev.map(pl => pl.id === id ? { ...pl, isOnPitch: true, pitchX: 50, pitchY: 50 } : pl));
    toast.success(`${p.name} al campo`);
  };

  const handleSubstitution = (onPitchId: string, benchId: string) => {
    const onP = players.find(p => p.id === onPitchId);
    const bench = players.find(p => p.id === benchId);
    if (!onP || !bench) return;
    setPlayers(prev => prev.map(p => {
      if (p.id === onPitchId) return { ...p, isOnPitch: false };
      if (p.id === benchId) return { ...p, isOnPitch: true, pitchX: onP.pitchX, pitchY: onP.pitchY };
      return p;
    }));
    toast.success(`${bench.name} entra por ${onP.name}`);
    setSelectedPlayerId(benchId);
  };

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
    try { return await toPng(pitchRef.current, { cacheBust: true, pixelRatio: 2 }); }
    catch { toast.error('Error'); return null; }
  };

  const handleDownload = async () => {
    const d = await captureImage();
    if (!d) return;
    const a = document.createElement('a');
    a.download = `tactica-${currentFormation}.png`;
    a.href = d;
    a.click();
    toast.success('Descargada!');
  };

  const bg = isDark ? 'bg-slate-950 text-slate-100' : 'bg-gray-100 text-gray-900';
  const btn = (active = false) => `p-2 rounded-lg transition-all border shrink-0 ${active ? 'bg-emerald-500 text-white border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : isDark ? 'bg-white/10 hover:bg-white/20 border-white/10 text-slate-300' : 'bg-white hover:bg-gray-200 border-gray-200 text-gray-600'}`;
  const mut = isDark ? 'text-slate-400' : 'text-gray-500';

  const LEGEND = [
    { pos: 'ARQ' as Position, color: 'bg-orange-500', shadow: 'rgba(249,115,22,0.5)' },
    { pos: 'DFC' as Position, color: 'bg-blue-500', shadow: 'rgba(59,130,246,0.5)', label: 'Defensas' },
    { pos: 'MC' as Position, color: 'bg-emerald-500', shadow: 'rgba(16,185,129,0.5)', label: 'Mediocampo' },
    { pos: 'EI' as Position, color: 'bg-violet-500', shadow: 'rgba(139,92,246,0.5)', label: 'Extremos' },
    { pos: 'DC' as Position, color: 'bg-red-500', shadow: 'rgba(239,68,68,0.5)' },
  ];

  return (
    <div className={`flex h-screen h-[100dvh] w-full overflow-hidden font-sans transition-colors duration-300 ${bg}`}
      style={isDark ? {
        backgroundImage: 'linear-gradient(to bottom right, rgba(2,6,23,0.92), rgba(15,23,42,0.92)), url("https://images.unsplash.com/photo-1590502178797-a7ed0833a02f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080")',
        backgroundSize: 'cover', backgroundPosition: 'center',
      } : {}}>
      <Toaster position="top-center" theme={isDark ? 'dark' : 'light'} />

      <Sidebar players={players} onAddPlayer={handleAddPlayer} onUpdatePlayer={handleUpdatePlayer}
        onRemovePlayer={handleRemoveFromPitch} onSendToPitch={handleSendToPitch}
        selectedPlayerId={selectedPlayerId} onSelectPlayer={setSelectedPlayerId}
        onSubstitution={handleSubstitution} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
        onRequestPersist={() => handleSaveToCloud(true)} />

      {/* CENTER */}
      <div className="flex-1 flex flex-col items-center p-3 md:p-4 relative overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <header className="w-full max-w-[520px] flex justify-between items-center mb-2 md:mb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className={`md:hidden ${btn()}`}><Menu className="w-5 h-5" /></button>
            <div>
              <h1 className="text-xl md:text-3xl font-black tracking-tighter drop-shadow-md">
                PIZARRA<span className="text-emerald-500">TACTICA</span>
              </h1>
              <p className={`text-[10px] md:text-xs font-medium ${mut} hidden sm:block`}>
                {activeTool === 'draw' ? 'Dibuja flechas' : activeTool === 'opponent' ? 'Toca para colocar rival' : 'Arrastra jugadores'}
              </p>
            </div>
          </div>
          <div className="flex gap-1 md:gap-1.5">
            <button onClick={toggleTheme} className={btn()} title={isDark ? 'Claro' : 'Oscuro'}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="relative">
              <button onClick={() => setShowGrassMenu(!showGrassMenu)} className={btn()}><Palette className="w-4 h-4" /></button>
              {showGrassMenu && (
                <div className={`absolute right-0 top-11 z-50 p-3 rounded-xl shadow-2xl border ${isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-gray-200'}`}>
                  <p className={`text-[10px] font-bold mb-2 ${mut}`}>Cesped</p>
                  <div className="flex gap-1.5">
                    {GRASS_COLORS.map(c => (
                      <button key={c} onClick={() => { setGrassColor(c); setShowGrassMenu(false); }}
                        className={`w-6 h-6 rounded-full border-2 hover:scale-110 transition-transform ${grassColor === c ? 'border-yellow-400 scale-110' : 'border-white/30'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={handleDownload} className={btn()} title="Descargar imagen"><Download className="w-4 h-4" /></button>
            <button onClick={handleSaveToCloud} disabled={saving} 
              className={`${btn()} relative ${hasUnsaved ? 'animate-pulse' : ''}`}
              title={saving ? 'Guardando...' : hasUnsaved ? 'Guardar cambios' : 'Guardado'}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : hasUnsaved ? <Save className="w-4 h-4 text-yellow-400" /> : <Cloud className="w-4 h-4 text-emerald-400" />}
            </button>
          </div>
        </header>

        {/* Formation selector */}
        <div className="w-full max-w-[520px] mb-2">
          <button onClick={() => setShowFormations(!showFormations)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-bold ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-800'}`}>
            <span>Formacion: <span className="text-emerald-500">{currentFormation}</span></span>
            {showFormations ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showFormations && (
            <div className={`mt-1 p-3 rounded-xl border max-h-[200px] overflow-y-auto ${isDark ? 'bg-slate-900/90 border-white/10' : 'bg-white border-gray-200'}`}>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {allFormations.map((f, idx) => (
                  <div key={`${f.name}-${idx}`} className="flex items-center gap-0.5">
                    <button onClick={() => handleApplyFormation(f.name)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all border ${
                        currentFormation === f.name
                          ? 'bg-emerald-500 text-white border-emerald-400'
                          : isDark ? 'bg-white/10 text-slate-300 border-white/10 hover:bg-white/20' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-emerald-50'
                      }`}>
                      {f.name}
                    </button>
                    {f.isCustom && (
                      <button onClick={() => handleDeleteFormation(f.name)} className="text-red-400 hover:text-red-300 p-0.5"><X className="w-3 h-3" /></button>
                    )}
                  </div>
                ))}
              </div>
              {/* Create custom */}
              {!showCreateFormation ? (
                <button onClick={() => setShowCreateFormation(true)}
                  className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg border w-full justify-center ${isDark ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'}`}>
                  <Plus className="w-3.5 h-3.5" /> Crear formacion personalizada
                </button>
              ) : (
                <div className="flex gap-2 items-center">
                  <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Nombre (ej: Mi 4-3-3)"
                    className={`flex-1 px-3 py-2 rounded-lg text-xs border ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-gray-50 border-gray-300'} focus:outline-none focus:border-emerald-500`} />
                  <button onClick={handleSaveCustomFormation} className="px-3 py-2 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600">Guardar</button>
                  <button onClick={() => setShowCreateFormation(false)} className={`p-2 ${mut}`}><X className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pitch: herramientas en barra horizontal (móvil) o rail izquierdo (md+) */}
        <div className="w-full max-w-[520px] relative">
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
          />

          <div className="w-full relative">
            <Pitch players={pitchPlayers} onPlayerMove={handlePlayerMove}
              selectedPlayerId={selectedPlayerId} onSelectPlayer={setSelectedPlayerId}
              arrows={arrows} onAddArrow={a => setArrows(p => [...p, a])}
              activeTool={activeTool} arrowColor={arrowColor} arrowStyle={arrowStyle} pitchRef={pitchRef}
              opponents={opponents} onAddOpponent={m => setOpponents(p => [...p, m])}
              onMoveOpponent={(id, x, y) => setOpponents(p => p.map(m => m.id === id ? { ...m, x, y } : m))}
              onRemoveOpponent={id => setOpponents(p => p.filter(m => m.id !== id))} />
          </div>
        </div>

        {/* Mobile info bar */}
        <div className={`mt-3 md:hidden flex items-center justify-between w-full max-w-[520px] px-4 py-2 rounded-xl border ${isDark ? 'bg-slate-900/60 border-white/10' : 'bg-white/80 border-gray-200'}`}>
          <span className="text-emerald-500 font-black text-lg">{currentFormation}</span>
          <span className={`text-xs ${mut}`}>{pitchPlayers.length}/11</span>
          <div className="flex gap-2">
            {LEGEND.map(l => (
              <span key={l.pos} className={`w-3 h-3 rounded-full ${l.color}`} style={{ boxShadow: `0 0 6px ${l.shadow}` }} />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: Legend (desktop) */}
      <div className={`hidden lg:flex flex-col justify-center gap-4 px-5 py-8 border-l ${isDark ? 'border-white/10 bg-slate-900/40' : 'border-gray-200 bg-white/60'} backdrop-blur-md min-w-[160px]`}>
        <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${mut}`}>Leyenda</h3>
        {LEGEND.map(({ pos, color, shadow, label }) => (
          <div key={pos} className="flex items-center gap-3">
            <span className={`w-4 h-4 rounded-full ${color} shrink-0`} style={{ boxShadow: `0 0 10px ${shadow}` }} />
            <div>
              <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>{pos}</span>
              <span className={`text-[10px] block ${mut}`}>{label || POSITION_LABELS[pos]}</span>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3 mt-2">
          <span className="w-4 h-4 rounded-full bg-red-600 border-2 border-red-300 shrink-0" />
          <div>
            <span className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>Rival</span>
            <span className={`text-[10px] block ${mut}`}>Doble-clic elimina</span>
          </div>
        </div>

        <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${mut}`}>Formacion</h3>
          <span className="text-2xl font-black text-emerald-500">{currentFormation}</span>
          <p className={`text-[10px] mt-1 ${mut}`}>{pitchPlayers.length}/11 jugadores</p>
        </div>
        <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${mut}`}>Tacticas</h3>
          <p className={`text-[10px] ${mut}`}>{arrows.length} flechas &middot; {opponents.length} rivales</p>
        </div>
      </div>
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