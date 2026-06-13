import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { api } from '../api.js';

const COLORS = ['#f59e0b', '#00d4ff', '#00e676'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-800 border border-slate-600/50 rounded-xl p-3 shadow-card text-xs">
      <p className="text-slate-300 font-semibold mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill || p.stroke }}>
          {p.name}: <span className="text-white font-bold">{Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span> MMSTB
        </p>
      ))}
    </div>
  );
};

export default function Volumetrics() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.scenario().then(d => setData(d)).finally(() => setLoading(false));
  }, []);

  const chartData = data.map((r, i) => ({
    name: String(r.Case).split('/')[0].trim(),
    STOIIP: +Number(r['STOIIP (MMSTB)']).toFixed(2),
    Recoverable: +Number(r['Recoverable Oil (MMSTB)']).toFixed(2),
    color: COLORS[i] || '#00d4ff',
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Volumetric Scenario Cockpit</h1>
        <p className="text-sm text-slate-400 mt-0.5">Low–Base–High uncertainty range across OWC contact scenarios</p>
      </div>

      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">STOIIP & Recoverable Oil by Scenario</h2>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} barCategoryGap="30%" barGap={6}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 13 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => v.toLocaleString()} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 13, color: '#94a3b8' }} />
            <Bar dataKey="STOIIP" name="STOIIP (MMSTB)" radius={[8, 8, 0, 0]}>
              {chartData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
            </Bar>
            <Bar dataKey="Recoverable" name="Recoverable (MMSTB)" radius={[8, 8, 0, 0]}>
              {chartData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.45} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="green-box">
        <strong className="text-emerald-400">Base-case decision:</strong> Hor_C is retained as the most defensible development basis. Hor_D remains an upside appraisal case because its volume is strongly controlled by deeper contact and reservoir-quality uncertainty.
      </div>

      <div className="card overflow-auto">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Full Scenario Parameters</h2>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700">
              {['Case', 'Contact', 'Sw', 'So', 'Bo (rm³/sm³)', 'RF', 'STOIIP (MMSTB)', 'Recoverable (MMSTB)', 'Interpretation'].map(h => (
                <th key={h} className="text-left pb-2.5 pr-4 text-slate-400 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i} className={`border-b border-slate-800/50 ${i === 1 ? 'bg-cyan/3' : ''}`}>
                <td className={`py-3 pr-4 font-semibold whitespace-nowrap ${i === 1 ? 'text-cyan' : 'text-slate-200'}`}>{r.Case}</td>
                <td className="pr-4 text-slate-400">{r.Contact}</td>
                <td className="pr-4 font-mono text-slate-300">{Number(r.Sw).toFixed(2)}</td>
                <td className="pr-4 font-mono text-slate-300">{Number(r.So).toFixed(2)}</td>
                <td className="pr-4 font-mono text-slate-300">{Number(r['Bo (rm³/sm³)']).toFixed(2)}</td>
                <td className="pr-4 font-mono text-slate-300">{Number(r.RF).toFixed(2)}</td>
                <td className="pr-4 font-bold font-mono text-cyan">{Number(r['STOIIP (MMSTB)']).toFixed(2)}</td>
                <td className="pr-4 font-bold font-mono text-emerald-400">{Number(r['Recoverable Oil (MMSTB)']).toFixed(2)}</td>
                <td className="text-slate-400">{r.Interpretation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
