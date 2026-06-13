import { useState, useEffect, useMemo } from 'react';
import { ComposedChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { api } from '../api.js';

const TRACKS = [
  { title: 'GR / VCL', curves: [{ key: 'GR', color: '#00d4ff', domain: [0, 150] }, { key: 'VCL', color: '#f59e0b', scale: 150, domain: [0, 150] }] },
  { title: 'Resistivity', curves: [{ key: 'RESM', color: '#00e676', domain: [0.1, 1000] }] },
  { title: 'Density / Neutron', curves: [{ key: 'RHOB', color: '#a78bfa', domain: [1.95, 2.95] }, { key: 'NPHI', color: '#38bdf8', domain: [-0.15, 0.45] }] },
  { title: 'PHIE / NTG', curves: [{ key: 'PHIE', color: '#34d399', domain: [0, 0.4] }, { key: 'NTG', color: '#f472b6', domain: [0, 1.2] }] },
];

function WellTrack({ trackDef, data, depthDomain, markerDepths, showYAxis }) {
  return (
    <div className="flex flex-col border-r border-slate-700/50 last:border-r-0" style={{ minWidth: 0, flex: 1 }}>
      <div className="text-center text-[10px] text-slate-400 py-1.5 border-b border-slate-700/50 font-medium tracking-wide bg-navy-900/50">
        {trackDef.title}
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 px-1 py-1 border-b border-slate-700/30 bg-navy-900/20">
        {trackDef.curves.map(c => (
          <span key={c.key} className="text-[10px] flex items-center gap-1">
            <span style={{ background: c.color }} className="inline-block w-3 h-0.5 rounded" />
            <span style={{ color: c.color }}>{c.key}</span>
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={520}>
        <ComposedChart data={data} layout="vertical" margin={{ left: showYAxis ? 40 : 2, right: 4, top: 5, bottom: 5 }}>
          {showYAxis ? (
            <YAxis dataKey="Depth" type="number" reversed domain={depthDomain} tick={{ fill: '#64748b', fontSize: 9 }} width={38} tickCount={12} />
          ) : (
            <YAxis dataKey="Depth" type="number" reversed domain={depthDomain} hide width={0} />
          )}
          <XAxis type="number" domain={trackDef.curves[0]?.domain || ['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 9 }} tickCount={4} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const depth = payload[0]?.payload?.Depth;
              return (
                <div className="bg-navy-800 border border-slate-600/50 rounded-lg p-2 text-[10px] shadow-card">
                  <p className="text-slate-400 mb-0.5">Depth: <strong className="text-white">{depth?.toFixed(1)}m</strong></p>
                  {payload.map(p => p.value != null && (
                    <p key={p.dataKey} style={{ color: p.stroke }}>{p.dataKey}: <strong>{Number(p.value).toFixed(3)}</strong></p>
                  ))}
                </div>
              );
            }}
          />
          {markerDepths.map((md, i) => (
            <ReferenceLine key={i} y={md.y} stroke="rgba(248,113,113,0.4)" strokeDasharray="5 3" />
          ))}
          {trackDef.curves.map(c => (
            <Line
              key={c.key}
              dataKey={c.key}
              stroke={c.color}
              dot={false}
              strokeWidth={1.5}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function WellLogs() {
  const [tables, setTables] = useState([]);
  const [selected, setSelected] = useState('');
  const [raw, setRaw] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [depthRange, setDepthRange] = useState([0, 1]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(4);

  useEffect(() => {
    Promise.all([api.tables('welllog_'), api.tables('markers_')]).then(([wt, mt]) => {
      setTables(wt);
      if (wt.length) setSelected(wt[0]);
      if (mt.length) api.table(mt[0]).then(setMarkers);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.table(selected).then(rows => {
      const data = rows.map(r => {
        const o = {};
        for (const [k, v] of Object.entries(r)) o[k] = v === null || v === '' ? null : Number(v);
        return o;
      }).filter(r => r.Depth != null && isFinite(r.Depth)).sort((a, b) => a.Depth - b.Depth);
      setRaw(data);
      if (data.length) {
        const mn = data[0].Depth, mx = data[data.length - 1].Depth;
        setDepthRange([mn, mx]);
      }
    }).finally(() => setLoading(false));
  }, [selected]);

  const wellName = raw[0]?.Well || selected;

  const data = useMemo(() => {
    const filtered = raw.filter(r => r.Depth >= depthRange[0] && r.Depth <= depthRange[1]);
    if (filtered.length <= 600) return filtered;
    // Decimate for performance
    const s = Math.ceil(filtered.length / 600);
    return filtered.filter((_, i) => i % s === 0);
  }, [raw, depthRange]);

  const minD = raw.length ? raw[0].Depth : 0;
  const maxD = raw.length ? raw[raw.length - 1].Depth : 1;

  const markerLines = markers
    .filter(m => m.Well && String(m.Well).replace('_', '-').toLowerCase().includes(String(wellName).replace('_', '-').toLowerCase()) && m.MD)
    .map(m => ({ y: Number(m.MD) }))
    .filter(m => isFinite(m.y));

  const kpis = [
    { label: 'Avg PHIE', key: 'PHIE', color: 'text-emerald-400', fmt: v => v.toFixed(3) },
    { label: 'Avg VCL', key: 'VCL', color: 'text-amber-400', fmt: v => v.toFixed(3) },
    { label: 'Avg NTG', key: 'NTG', color: 'text-violet-400', fmt: v => v.toFixed(3) },
    { label: 'Median RESM', key: 'RESM', color: 'text-cyan', fmt: v => v.toFixed(2) },
  ];

  function colMean(key) {
    const vals = data.map(r => r[key]).filter(v => v != null && isFinite(v));
    if (!vals.length) return null;
    const sorted = [...vals].sort((a, b) => a - b);
    if (key === 'RESM') return sorted[Math.floor(sorted.length / 2)];
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Well Log & Reservoir Panel</h1>
          <p className="text-sm text-slate-400 mt-0.5">Integrated multi-track petrophysical visualization</p>
        </div>
        <select className="select w-64" value={selected} onChange={e => setSelected(e.target.value)}>
          {tables.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {!tables.length && <div className="warn-box">No well log table. Upload LAS files or load sample data.</div>}

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(k => {
          const v = colMean(k.key);
          return (
            <div key={k.key} className="card py-3">
              <div className="text-xs text-slate-400 mb-1">{k.label}</div>
              <div className={`text-xl font-bold font-mono ${k.color}`}>{v != null ? k.fmt(v) : '—'}</div>
            </div>
          );
        })}
      </div>

      {/* Depth control */}
      <div className="card py-3 flex items-center gap-6">
        <div className="text-xs text-slate-400 shrink-0">Depth interval (m)</div>
        <div className="flex-1 flex items-center gap-3">
          <span className="text-xs text-slate-500 font-mono">{depthRange[0].toFixed(0)}</span>
          <input type="range" min={minD} max={maxD} step={(maxD - minD) / 200} value={depthRange[0]}
            onChange={e => setDepthRange([Math.min(+e.target.value, depthRange[1] - 10), depthRange[1]])}
            className="flex-1 accent-cyan" />
          <input type="range" min={minD} max={maxD} step={(maxD - minD) / 200} value={depthRange[1]}
            onChange={e => setDepthRange([depthRange[0], Math.max(+e.target.value, depthRange[0] + 10)])}
            className="flex-1 accent-cyan" />
          <span className="text-xs text-slate-500 font-mono">{depthRange[1].toFixed(0)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>Points: <strong className="text-slate-200">{data.length}</strong></span>
        </div>
      </div>

      {/* Well log tracks */}
      <div className="card p-0 overflow-hidden">
        <div className="flex bg-navy-800 border-b border-slate-700/50 px-4 py-2.5 items-center justify-between">
          <span className="text-sm font-semibold text-white">Well: <span className="text-cyan">{wellName}</span></span>
          {markerLines.length > 0 && <span className="text-xs text-red-400">● {markerLines.length} marker(s)</span>}
        </div>
        {loading ? (
          <div className="h-96 flex items-center justify-center text-slate-500">Loading well log data…</div>
        ) : data.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-500">No data in selected depth range</div>
        ) : (
          <div className="flex overflow-x-auto">
            {TRACKS.map((track, i) => (
              <WellTrack
                key={i}
                trackDef={track}
                data={data}
                depthDomain={[depthRange[0], depthRange[1]]}
                markerDepths={markerLines}
                showYAxis={i === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
