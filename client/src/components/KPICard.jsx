export default function KPICard({ title, value, note, accent = 'cyan', icon: Icon }) {
  const accents = {
    cyan: 'from-cyan/10 to-transparent border-cyan/20 text-cyan',
    green: 'from-emerald-500/10 to-transparent border-emerald-500/20 text-emerald-400',
    amber: 'from-amber-500/10 to-transparent border-amber-500/20 text-amber-400',
    violet: 'from-violet-500/10 to-transparent border-violet-500/20 text-violet-400',
  };
  const cls = accents[accent] || accents.cyan;

  return (
    <div className={`card bg-gradient-to-br ${cls.split(' ').slice(0,2).join(' ')} border ${cls.split(' ')[2]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{title}</div>
          <div className={`text-2xl font-bold truncate ${cls.split(' ')[3]}`}>{value}</div>
          {note && <div className="text-xs text-slate-500 mt-1.5">{note}</div>}
        </div>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${cls.split(' ').slice(0,2).join(' ')} border ${cls.split(' ')[2]} flex items-center justify-center shrink-0`}>
            <Icon size={16} className={cls.split(' ')[3]} />
          </div>
        )}
      </div>
    </div>
  );
}
