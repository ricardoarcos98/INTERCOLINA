import React from 'react';
import { User } from 'lucide-react';

type Props = {
  photoUrl: string;
  name: string;
  isDark: boolean;
  /** Vista compacta o más grande en foco */
  size: 'compact' | 'focus';
  /** stack = columna; corner = chip esquina sup. der. */
  layout?: 'stack' | 'corner';
};

export const CoachCard: React.FC<Props> = ({ photoUrl, name, isDark, size, layout = 'stack' }) => {
  const focus = size === 'focus';
  const ring = isDark ? 'border-white/20 bg-slate-900/90' : 'border-gray-300 bg-white/95';
  const w = focus ? 'w-[120px] md:w-[140px]' : 'w-[72px] md:w-[84px]';
  const imgH = focus ? 'h-[140px] md:h-[168px]' : 'h-[88px] md:h-[96px]';

  if (layout === 'corner') {
    const imgSz = focus ? 'w-[72px] h-[72px] md:w-20 md:h-20' : 'w-[52px] h-[52px] md:w-14 md:h-14';
    return (
      <div
        className={`flex flex-row-reverse items-center gap-2 rounded-2xl border-2 px-2.5 py-1.5 shadow-lg backdrop-blur-sm shrink-0 max-w-[200px] md:max-w-[240px] ${ring}`}
      >
        <div className={`rounded-full border-2 border-amber-500/60 overflow-hidden bg-slate-800 flex items-center justify-center shrink-0 ${imgSz}`}>
          {photoUrl ? (
            <img src={photoUrl} alt="" className="w-full h-full object-cover object-top" draggable={false} />
          ) : (
            <User className={`${focus ? 'w-9 h-9 md:w-10 md:h-10' : 'w-7 h-7'} opacity-50`} />
          )}
        </div>
        <div className="min-w-0 flex-1 text-right pr-0.5">
          <div className={`font-black uppercase tracking-wider text-[8px] md:text-[9px] ${isDark ? 'text-amber-400/90' : 'text-amber-600'}`}>D.T.</div>
          <div className={`text-[10px] md:text-xs font-bold leading-tight line-clamp-2 ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>
            {name || 'Director técnico'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center gap-2 shrink-0 ${w}`}>
      <span
        className={`font-black uppercase tracking-wider ${focus ? 'text-xs md:text-sm' : 'text-[9px]'} ${
          isDark ? 'text-amber-400/90' : 'text-amber-600'
        }`}
      >
        D.T.
      </span>
      <div
        className={`w-full rounded-2xl border-2 overflow-hidden shadow-lg ${ring} ${imgH} flex items-center justify-center`}
      >
        {photoUrl ? (
          <img src={photoUrl} alt={name} className="w-full h-full object-cover object-top" draggable={false} />
        ) : (
          <div className={`flex flex-col items-center justify-center gap-1 p-2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            <User className={focus ? 'w-12 h-12' : 'w-8 h-8'} />
            <span className="text-[9px] text-center font-bold leading-tight">Sin foto</span>
          </div>
        )}
      </div>
      <p
        className={`text-center font-bold leading-tight line-clamp-3 ${
          focus ? 'text-xs md:text-sm' : 'text-[10px]'
        } ${isDark ? 'text-slate-200' : 'text-gray-800'}`}
      >
        {name || 'Director técnico'}
      </p>
    </div>
  );
};
