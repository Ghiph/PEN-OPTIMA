import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Database, Activity, BarChart3,
  Map, Layers, Sigma, Rocket, Droplet
} from 'lucide-react';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Executive Dashboard' },
  { to: '/data-center', icon: Database, label: 'Data Center' },
  { to: '/well-logs', icon: Activity, label: 'Well Logs' },
  { to: '/volumetrics', icon: BarChart3, label: 'Volumetrics' },
  { to: '/zone-segment', icon: Layers, label: 'Zone–Segment Ranking' },
  { to: '/variogram', icon: Sigma, label: 'Variogram Assistant' },
  { to: '/field-map', icon: Map, label: 'Field Map' },
  { to: '/development-plan', icon: Rocket, label: 'Development Plan' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-navy-900 border-r border-slate-700/40 flex flex-col h-screen sticky top-0 shrink-0">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-slate-700/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan/15 border border-cyan/30 flex items-center justify-center shadow-glow">
            <Droplet size={18} className="text-cyan" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-wider">PEN-OPTIMA</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest">Penobscot Field</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? 'bg-cyan/10 text-cyan border border-cyan/20 shadow-glow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-navy-700/60'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={16} className={isActive ? 'text-cyan' : 'text-slate-500 group-hover:text-slate-300'} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-700/40">
        <div className="text-[10px] text-slate-600 text-center uppercase tracking-widest">
          Digital Field Optimization
        </div>
      </div>
    </aside>
  );
}
