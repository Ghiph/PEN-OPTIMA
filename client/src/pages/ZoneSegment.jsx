import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Legend, Cell
} from 'recharts';
import { api } from '../api.js';

const ZONE_COLORS = ['#00d4ff', '#00e676', '#f59e0b', '#ab47bc', '#ef5350', '#42a5f5'];

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-navy-800 border border-slate-600/50 rounded-xl p-3 text-xs shadow-card">
      <p className="text-white font-bold mb-1">{d.Zone} / {d.Segment}</p>
      <p className="text-cyan">Score: <strong>{d.Priority_Score?.toFixed(1)}</strong></p>
      <p className="text-slate-300">STOIIP: {d.STOIIP_MMSTB?.toFixed(3)} MMSTB</p>
      <p className="text-emerald-400">RecOil: {d.RecOil_MMSTB?.toFixed(3)} MMSTB</p>
      <p className="text-slate-400">{d.Recommended_Action}</p>
    </div>
  );
};

export default function ZoneSegment() {
  const [tables, setTables] = useState([]);
  const [selected, setSelected] = useState('');
  const [ranked, setRanked] = useState([]);
  const [raw, setRaw] = useState([]);
  const [topN, setTopN] = useState(10);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.tables('vol_partition_').then(t => {
      setTables(t);
      const def = t.find(x => x.includes('horc_base')) || t[0];
      if (def) setSelected(def);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    Promise.all([api.rankedSegments(selected), api.table(selected)])
      .then(([r, raw]) => { setRanked(r); setRaw(raw); })
      .finally(() => setLoading(false));
  }, [selected]);

  const total = raw.find(r => String(r.Zone).toLowerCase() === 'total' && String(r.Segment).toLowerCase() === 'total');
  const zones = [...new Set(ranked.map(r => r.Zone))];
  const colorMap = Object.fromEntries(zones.map((z, i) => [z, ZONE_COLORS[i % ZONE_COLORS.length]]));

  const barData = ranked.slice(0, topN).map(r => ({
    ...r,
    name: `${r.Zone}/${r.Segment}`,
    color: colorMap[r.Zone],
  }));

  const scatterData = ranked.slice(0, 30).map(r => ({ ...r, color: colorMap[r.Zone] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Zone–Segment Development Ranking</h1>
          <p className="text-sm text-slate-400 mt-0.5">Multi-criteria prioritisation of development targets</p>
        </div>
        <select className="select w-72" value={selected} onChange={e => setSelected(e.target.value)}>
          {tables.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* KPI row */}
      {total && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total STOIIP', value: `${Number(total.STOIIP_MMSTB).toFixed(2)} MMSTB`, color: 'text-cyan' },
            { label: 'Recoverable Oil', value: `${Number(total.RecOil_MMSTB).toFixed(2)} MMSTB`, color: 'text-emerald-400' },
            { label: 'Mean Thickness', value: `${Number(total.Mean_Thickness_m).toFixed(1)} m`, color: 'text-violet-400' },
            { label: 'Segments Ranked', value: ranked.length, color: 'text-amber-400' },
          ].map((k, i) => (
            <div key={i} className="card">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{k.label}</div>
              <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center h-48 text-slate-500">Calculating rankings…</div>
      ) : (
        <>
          {/* Bar chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-300">Development Priority Score</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                Top <input type="range" min={5} max={Math.min(ranked.length, 20)} value={topN} onChange={e => setTopN(+e.target.value)} className="w-24 accent-cyan" /> {topN}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} margin={{ bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Priority_Score" radius={[6, 6, 0, 0]}>
                  {barData.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Scatter + Table */}
          <div className="grid grid-cols-5 gap-4">
            <div className="col-span-2 card">
              <h2 className="text-sm font-semibold text-slate-300 mb-4">Risk / Reward Screen</h2>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="STOIIP_MMSTB" name="STOIIP" type="number" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'STOIIP (MMSTB)', position: 'insideBottom', fill: '#64748b', fontSize: 10, dy: 12 }} />
                  <YAxis dataKey="RecOil_MMSTB" name="RecOil" type="number" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'RecOil (MMSTB)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, dx: -5 }} />
                  <ZAxis dataKey="HCPV_rm3" range={[40, 400]} />
                  <Tooltip content={<CustomTooltip />} />
                  {zones.map(z => (
                    <Scatter
                      key={z}
                      name={z}
                      data={scatterData.filter(r => r.Zone === z)}
                      fill={colorMap[z]}
                      fillOpacity={0.7}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="col-span-3 card overflow-auto">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Ranked Segments</h2>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['#', 'Zone', 'Segment', 'STOIIP', 'RecOil', 'Score', 'Action'].map(h => (
                      <th key={h} className="text-left pb-2.5 pr-3 text-slate-400 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ranked.slice(0, topN).map((r, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-navy-700/20">
                      <td className="py-2 pr-3 text-slate-500">{i + 1}</td>
                      <td className="pr-3" style={{ color: colorMap[r.Zone] }}>{r.Zone}</td>
                      <td className="pr-3 text-slate-300 font-medium">{r.Segment}</td>
                      <td className="pr-3 text-cyan font-mono">{r.STOIIP_MMSTB?.toFixed(3)}</td>
                      <td className="pr-3 text-emerald-400 font-mono">{r.RecOil_MMSTB?.toFixed(3)}</td>
                      <td className="pr-3">
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1.5 bg-navy-900 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${r.Priority_Score}%`, background: colorMap[r.Zone] }} />
                          </div>
                          <span className="font-bold text-slate-200">{r.Priority_Score?.toFixed(0)}</span>
                        </div>
                      </td>
                      <td className={`text-[10px] ${r.Recommended_Action === 'Primary target' ? 'text-emerald-400' : r.Recommended_Action === 'Secondary target' ? 'text-amber-400' : 'text-slate-500'}`}>
                        {r.Recommended_Action}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
