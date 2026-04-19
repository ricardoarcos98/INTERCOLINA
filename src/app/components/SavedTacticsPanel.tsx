import React, { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Save, Trash2, Loader2, ChevronDown, ChevronUp, Pencil, X } from 'lucide-react';
import { SavedTacticMeta, TacticSnapshot } from '../types';
import { useTheme } from './ThemeContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from 'sonner';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-f6cf3a30`;

type Props = {
  getPayload: () => TacticSnapshot;
  onApplySnapshot: (data: TacticSnapshot) => void;
  /** Tras cargar una copia: guardar en la táctica principal con estos datos. */
  onAfterApply?: (snap: TacticSnapshot) => void;
  hasUnsaved: boolean;
};

export const SavedTacticsPanel: React.FC<Props> = ({
  getPayload,
  onApplySnapshot,
  onAfterApply,
  hasUnsaved,
}) => {
  const { isDark } = useTheme();
  const [open, setOpen] = useState(true);
  const [name, setName] = useState('');
  const [list, setList] = useState<SavedTacticMeta[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const muted = isDark ? 'text-slate-400' : 'text-gray-500';
  const card = isDark ? 'bg-slate-800/90 border-white/10' : 'bg-gray-50 border-gray-200';
  const inputCls = isDark
    ? 'bg-slate-900 border-slate-600 text-white placeholder:text-slate-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder:text-gray-400';

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${API_BASE}/saved-tactics`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) {
        const t = await res.text();
        console.error('saved-tactics', res.status, t);
        toast.error(res.status === 404 ? 'Función no desplegada (404)' : `Error ${res.status}`);
        return;
      }
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch {
      toast.error('No se pudo cargar la lista');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const handleSave = async () => {
    const n = name.trim();
    if (!n) {
      toast.error('Escribe un nombre');
      return;
    }
    setSaving(true);
    try {
      const p = getPayload();
      const res = await fetch(`${API_BASE}/save-snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ name: n, ...p }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || `Error al guardar (${res.status})`);
        return;
      }
      setName('');
      toast.success(`Copia "${n}" guardada`);
      await refreshList();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async (id: string) => {
    if (hasUnsaved && !window.confirm('Hay cambios sin guardar en la nube. ¿Cargar esta táctica de todos modos?')) {
      return;
    }
    setLoadingId(id);
    try {
      const res = await fetch(`${API_BASE}/saved-tactic/${id}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || `No se pudo cargar (${res.status})`);
        return;
      }
      const snap: TacticSnapshot = {
        players: data.players || [],
        arrows: data.arrows || [],
        opponents: data.opponents || [],
        formation: data.formation || '4-3-3',
        customFormations: data.customFormations || [],
        laserStrokes: data.laserStrokes || [],
        captainPlayerId: data.captainPlayerId ?? null,
      };
      onApplySnapshot(snap);
      onAfterApply?.(snap);
      toast.success('Táctica cargada');
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoadingId(null);
    }
  };

  const startEditRow = (item: SavedTacticMeta) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const cancelEditRow = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleUpdateSaved = async (id: string) => {
    const n = editName.trim();
    if (!n) {
      toast.error('Escribe un nombre');
      return;
    }
    setUpdatingId(id);
    try {
      const p = getPayload();
      const res = await fetch(`${API_BASE}/saved-tactic/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ name: n, ...p }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || `Error al actualizar (${res.status})`);
        return;
      }
      toast.success(`Copia "${n}" actualizada`);
      cancelEditRow();
      await refreshList();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string, label: string) => {
    if (!window.confirm(`¿Eliminar la copia "${label}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/saved-tactic/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) {
        toast.error(`No se pudo eliminar (${res.status})`);
        return;
      }
      toast.success('Eliminada');
      await refreshList();
    } catch {
      toast.error('Error de conexión');
    }
  };

  const fmt = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  return (
    <div className={`border-b shrink-0 ${isDark ? 'border-white/10 bg-slate-900/40' : 'border-gray-200 bg-gray-50/80'}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-2.5 text-left ${muted} hover:opacity-90`}
      >
        <span className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-amber-500">
          <FolderOpen className="w-4 h-4" />
          Tácticas guardadas
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div className={`flex gap-1.5 p-2 rounded-lg border ${card}`}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la copia…"
              className={`flex-1 min-w-0 text-xs rounded-md border px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 ${inputCls}`}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar
            </button>
          </div>
          <div className={`max-h-[min(40vh,220px)] overflow-y-auto rounded-lg border ${card}`}>
            {loadingList ? (
              <div className={`flex justify-center py-6 ${muted}`}>
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : list.length === 0 ? (
              <p className={`text-[10px] px-3 py-4 text-center ${muted}`}>Aún no hay copias. Guarda una con un nombre.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {list.map((item) => (
                  <li
                    key={item.id}
                    className={`px-2 py-2 ${isDark ? 'hover:bg-white/5' : 'hover:bg-white/80'}`}
                  >
                    {editingId === item.id ? (
                      <div className="flex flex-col gap-2">
                        <p className={`text-[9px] font-bold uppercase tracking-wide ${muted}`}>
                          Guarda la pizarra actual en esta copia (carga la copia antes si quieres partir de ella)
                        </p>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className={`w-full text-xs rounded-md border px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 ${inputCls}`}
                          placeholder="Nombre…"
                        />
                        <div className="flex gap-1.5 justify-end">
                          <button
                            type="button"
                            onClick={cancelEditRow}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border ${isDark ? 'border-white/15 text-slate-300' : 'border-gray-300 text-gray-600'}`}
                          >
                            <X className="w-3 h-3" />
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={updatingId === item.id}
                            onClick={() => void handleUpdateSaved(item.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black disabled:opacity-50"
                          >
                            {updatingId === item.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                            Guardar cambios
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={loadingId === item.id}
                          onClick={() => void handleLoad(item.id)}
                          className="flex-1 min-w-0 text-left text-xs font-bold truncate text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                          title="Cargar en la pizarra"
                        >
                          {loadingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />
                          ) : null}
                          {item.name}
                          <span className={`block text-[9px] font-normal ${muted} truncate`}>{fmt(item.savedAt)}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditRow(item)}
                          className="p-1.5 rounded-md text-amber-400 hover:bg-amber-500/10 shrink-0"
                          title="Editar esta copia (nombre y contenido desde la pizarra)"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item.id, item.name)}
                          className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10 shrink-0"
                          title="Eliminar copia"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
