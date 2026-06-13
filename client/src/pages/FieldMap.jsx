import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import { api } from '../api.js';

export default function FieldMap() {
  const [tables, setTables] = useState([]);
  const [selected, setSelected] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.tables('boundary_').then(t => {
      setTables(t);
      if (t.length) setSelected(t[0]);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.table(selected).then(rows => {
      const pts = rows.map(r => ({ X: Number(r.X), Y: Number(r.Y), Z: Number(r.Z) })).filter(r => isFinite(r.X) && isFinite(r.Y));
      // Close the polygon
      if (pts.length > 1) pts.push({ ...pts[0] });
      setData(pts);
    }).finally(() => setLoading(false));
  }, [selected]);

  const centroidX = data.length ? data.reduce((s, r) => s + r.X, 0) / data.length : 0;
  const centroidY = data.length ? data.reduce((s, r) => s + r.Y, 0) / data.length : 0;
  const xVals = data.map(r => r.X), yVals = data.map(r => r.Y);
  const xRange = xVals.length ? [Math.min(...xVals), Math.max(...xVals)] : [0, 1];
  const yRange = yVals.length ? [Math.min(...yVals), Math.max(...yVals)] : [0, 1];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Field Boundary / Spatial View</h1>
        <p className="text-sm text-slate-400 mt-0.5">Penobscot structural closure boundary visualization</p>
      </div>

      {!tables.length ? (
        <div className="warn-box">No boundary table found. Upload <code className="bg-navy-900 px-1 rounded">PenobscotBoundary_1.txt</code> or load sample data.</div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <label className="text-sm text-slate-400">Boundary table</label>
            <select className="select w-64" value={selected} onChange={e => setSelected(e.target.value)}>
              {tables.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-300">Penobscot Structural Boundary</h2>
              <div className="flex gap-4 text-xs text-slate-400">
                <span>Points: <strong className="text-slate-200">{data.length - 1}</strong></span>
                <span>X range: <strong className="text-cyan font-mono">{xRange[0].toFixed(0)} – {xRange[1].toFixed(0)}</strong></span>
                <span>Y range: <strong className="text-cyan font-mono">{yRange[0].toFixed(0)} – {yRange[1].toFixed(0)}</strong></span>
              </div>
            </div>
            {loading ? (
              <div className="h-[520px] flex items-center justify-center text-slate-500">Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height={520}>
                <LineChart data={data} margin={{ top: 10, right: 30, bottom: 30, left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="X"
                    type="number"
                    domain={['auto', 'auto']}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickFormatter={v => (v / 1000).toFixed(1) + 'k'}
                    label={{ value: 'X (m)', position: 'insideBottom', fill: '#64748b', fontSize: 11, dy: 15 }}
                  />
                  <YAxis
                    dataKey="Y"
                    type="number"
                    domain={['auto', 'auto']}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickFormatter={v => (v / 1000).toFixed(1) + 'k'}
                    label={{ value: 'Y (m)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11, dx: -10 }}
                  />
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload?.length ? (
                        <div className="bg-navy-800 border border-slate-600/50 rounded-xl p-3 text-xs">
                          <p className="text-cyan font-mono">X: {Number(payload[0]?.payload?.X).toFixed(1)}</p>
                          <p className="text-cyan font-mono">Y: {Number(payload[0]?.payload?.Y).toFixed(1)}</p>
                        </div>
                      ) : null
                    }
                  />
                  <Line
                    type="linear"
                    dataKey="Y"
                    stroke="#00d4ff"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <ReferenceDot x={centroidX} y={centroidY} r={8} fill="#00d4ff" fillOpacity={0.4} stroke="#00d4ff" strokeWidth={2} label={{ value: 'CENTROID', fill: '#00d4ff', fontSize: 10, dy: -12 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Area (approx.)', value: data.length > 2 ? `${((xRange[1] - xRange[0]) * (yRange[1] - yRange[0]) / 1e6 * 0.6).toFixed(2)} km²` : '—', note: 'Bounding-box estimate × 0.6' },
              { label: 'Centroid X', value: centroidX.toFixed(1), note: 'metres (field coordinate)' },
              { label: 'Centroid Y', value: centroidY.toFixed(1), note: 'metres (field coordinate)' },
            ].map((item, i) => (
              <div key={i} className="card">
                <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{item.label}</div>
                <div className="text-xl font-bold text-cyan font-mono">{item.value}</div>
                <div className="text-xs text-slate-500 mt-1">{item.note}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
