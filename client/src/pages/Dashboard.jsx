import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, Droplet, Target, Award, RefreshCw } from 'lucide-react';
import KPICard from '../components/KPICard.jsx';
import { api } from '../api.js';

const CASE_COLORS = { 'Low / Conservative': '#f59e0b', 'Base / Most Defensible': '#00d4ff', 'High / Upside': '#00e676' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-800 border border-slate-600/50 rounded-xl p-3 shadow-card text-xs">
      <p className="text-slate-300 font-semibold mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill }}>{p.name}: <span className="text-white font-bold">{Number(p.value).toFixed(2)}</span> MMSTB</p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [scenario, setScenario] = useState([]);
  const [ranked, setRanked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [noData, setNoData] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [sc, tables] = await Promise.all([api.scenario(), api.tables()]);
      setScenario(sc);
      const partTable = tables.find(t => t.startsWith('vol_partition_horc_base')) || tables.find(t => t.startsWith('vol_partition_'));
      if (partTable) {
        const r = await api.rankedSegments(partTable);
        setRanked(r);
      }
      setNoData(!tables.length);
    } finally {
      setLoading(false);
    }
  }

  async function seedData() {
    setSeeding(true);
    try { await api.seed(); await load(); } finally { setSeeding(false); }
  }

  useEffect(() => { load(); }, []);

  const base = scenario.find(r => String(r.Case).includes('Base')) || scenario[1];
  const chartData = scenario.map(r => ({
    name: String(r.Case).split('/')[0].trim(),
    STOIIP: +Number(r['STOIIP (MMSTB)']).toFixed(2),
    Recoverable: +Number(r['Recoverable Oil (MMSTB)']).toFixed(2),
    fullCase: r.Case,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Executive Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">Penobscot Digital Field Optimization — Decision Support</p>
        </div>
        {noData ? (
          <button onClick={seedData} disabled={seeding} className="btn-primary flex items-center gap-2">
            {seeding ? <RefreshCw size={14} className="animate-spin" /> : <Droplet size={14} />}
            {seeding ? 'Loading…' : 'Load Sample Data'}
          </button>
        ) : (
          <button onClick={load} disabled={loading} className="btn-secondary flex items-center gap-2">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      </div>

      {noData && (
        <div className="warn-box">
          <strong className="text-amber-300">Database is empty.</strong> Click "Load Sample Data" to populate with Penobscot demo data.
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard title="Base STOIIP" value={base ? `${Number(base['STOIIP (MMSTB)']).toFixed(2)} MMSTB` : '—'} note="Hor_C OWC / development basis" accent="cyan" icon={Droplet} />
        <KPICard title="Base Recoverable" value={base ? `${Number(base['Recoverable Oil (MMSTB)']).toFixed(2)} MMSTB` : '—'} note="RF 30% scenario" accent="green" icon={TrendingUp} />
        <KPICard title="Dominant Zone" value="Zone_1" note="Hor_C base supported by Zone_1" accent="violet" icon={Award} />
        <KPICard title="Priority Segment" value={ranked[0]?.Segment || '—'} note={ranked[0] ? `Score: ${ranked[0].Priority_Score.toFixed(0)}` : 'Initial development target'} accent="amber" icon={Target} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-5 gap-4">
        {/* Bar chart */}
        <div className="col-span-3 card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Low – Base – High Volumetric Range</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => v.toLocaleString()} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Bar dataKey="STOIIP" name="STOIIP (MMSTB)" radius={[6, 6, 0, 0]} fill="#00d4ff">
                {chartData.map((d, i) => <Cell key={i} fill={CASE_COLORS[d.fullCase] || '#00d4ff'} fillOpacity={0.9} />)}
              </Bar>
              <Bar dataKey="Recoverable" name="Recoverable (MMSTB)" radius={[6, 6, 0, 0]} fill="#00e676" fillOpacity={0.6} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Decision panel */}
        <div className="col-span-2 card flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-slate-300">Decision Panel</h2>
          <div className="info-box text-xs">
            <strong className="text-cyan">Concept:</strong> Integrated subsurface dashboard combining well-log interpretation, static model outputs, volumetric uncertainty, segment ranking, and variogram QC.
          </div>
          {ranked.length > 0 && (
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Zone', 'Segment', 'STOIIP', 'Score', 'Action'].map(h => (
                      <th key={h} className="text-left pb-2 text-slate-400 font-medium pr-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ranked.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-b border-slate-800">
                      <td className="py-1.5 pr-2 text-slate-300">{r.Zone}</td>
                      <td className="pr-2 text-slate-300">{r.Segment}</td>
                      <td className="pr-2 text-cyan font-mono">{r.STOIIP_MMSTB?.toFixed(2)}</td>
                      <td className="pr-2">
                        <span className={r.Priority_Score >= 70 ? 'badge-high' : r.Priority_Score >= 40 ? 'badge-med' : 'badge-low'}>
                          {r.Priority_Score?.toFixed(0)}
                        </span>
                      </td>
                      <td className="text-slate-400 text-[10px]">{r.Recommended_Action?.split(' ')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="text-xs text-slate-400 space-y-1 mt-auto">
            <p><span className="text-cyan font-semibold">1.</span> Develop Hor_C / Zone_1 / Segment 3 first.</p>
            <p><span className="text-cyan font-semibold">2.</span> Expand to Segments 1–2 after appraisal.</p>
            <p><span className="text-amber-400 font-semibold">3.</span> Hor_D as high-side appraisal case.</p>
          </div>
        </div>
      </div>

      {/* Scenario table */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Scenario Summary Table</h2>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                {['Case', 'Contact', 'Sw', 'So', 'Bo', 'RF', 'STOIIP (MMSTB)', 'Recoverable (MMSTB)', 'Interpretation'].map(h => (
                  <th key={h} className="text-left pb-2.5 pr-4 text-slate-400 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenario.map((r, i) => (
                <tr key={i} className={`border-b border-slate-800/50 ${i === 1 ? 'bg-cyan/3' : ''}`}>
                  <td className={`py-2.5 pr-4 font-semibold whitespace-nowrap ${i === 1 ? 'text-cyan' : 'text-slate-200'}`}>{r.Case}</td>
                  <td className="pr-4 text-slate-400 whitespace-nowrap">{r.Contact}</td>
                  <td className="pr-4 text-slate-300 font-mono">{Number(r.Sw).toFixed(2)}</td>
                  <td className="pr-4 text-slate-300 font-mono">{Number(r.So).toFixed(2)}</td>
                  <td className="pr-4 text-slate-300 font-mono">{Number(r['Bo (rm³/sm³)']).toFixed(2)}</td>
                  <td className="pr-4 text-slate-300 font-mono">{Number(r.RF).toFixed(2)}</td>
                  <td className="pr-4 text-cyan font-bold font-mono">{Number(r['STOIIP (MMSTB)']).toFixed(2)}</td>
                  <td className="pr-4 text-emerald-400 font-bold font-mono">{Number(r['Recoverable Oil (MMSTB)']).toFixed(2)}</td>
                  <td className="text-slate-400">{r.Interpretation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
