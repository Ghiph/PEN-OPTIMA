import { useState, useEffect } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Sigma, Download } from 'lucide-react';
import { api } from '../api.js';

function VarioChart({ title, expData, sill, range }) {
  if (!expData) return <div className="bg-navy-900 rounded-xl h-52 flex items-center justify-center text-slate-600 text-xs">No data</div>;
  const combined = expData.model.map(m => ({ h: m.h, model: m.g }));
  for (const exp of expData.experimental) {
    const entry = combined.find(c => Math.abs(c.h - exp.Distance) < 0.1) || { h: exp.Distance };
    entry.exp = exp.Gamma;
    if (!combined.includes(entry)) combined.push(entry);
  }
  combined.sort((a, b) => a.h - b.h);

  return (
    <div>
      <div className="text-xs font-semibold text-slate-300 mb-2 text-center">{title}</div>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={combined} margin={{ top: 5, right: 10, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="h" type="number" domain={['auto', 'auto']} tick={{ fill: '#64748b', fontSize: 9 }} label={{ value: 'Lag (m)', position: 'insideBottom', fill: '#64748b', fontSize: 9, dy: 12 }} />
          <YAxis tick={{ fill: '#64748b', fontSize: 9 }} domain={['auto', 'auto']} />
          <Tooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="bg-navy-800 border border-slate-600/50 rounded-lg p-2 text-[10px]">
                  <p className="text-slate-400">h = {payload[0]?.payload?.h?.toFixed(1)} m</p>
                  {payload.map(p => p.value != null && <p key={p.name} style={{ color: p.stroke || p.fill }}>{p.name}: {Number(p.value).toFixed(4)}</p>)}
                </div>
              ) : null
            }
          />
          {sill && <ReferenceLine y={sill} stroke="#00d4ff" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `Sill ${sill?.toFixed(3)}`, fill: '#00d4ff', fontSize: 8, position: 'right' }} />}
          {range && <ReferenceLine x={range} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5} />}
          <Bar dataKey="exp" name="Experimental" fill="#00d4ff" fillOpacity={0.55} radius={[2, 2, 0, 0]} />
          <Line dataKey="model" name="Spherical model" stroke="#00e676" strokeWidth={2} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const DEFAULTS = {
  azimuth: 99, lagSize: 200, maxRangeH: 3500, maxRangeV: 900,
  maxPerp: 750, verticalTol: 250, minPairs: 8, maxPairs: 90000,
  propertyType: 'Binary / Netpay',
};

export default function VariogramAssistant() {
  const [tables, setTables] = useState([]);
  const [selected, setSelected] = useState('');
  const [columns, setColumns] = useState([]);
  const [settings, setSettings] = useState({ ...DEFAULTS, xcol: 'X', ycol: 'Y', zcol: 'Z', pcol: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.tables('vario_').then(t => { setTables(t); if (t.length) setSelected(t[0]); });
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.table(selected, 10).then(rows => {
      if (rows.length) {
        const cols = Object.keys(rows[0]);
        setColumns(cols);
        const numCols = cols.filter(c => rows.some(r => r[c] !== null && !isNaN(Number(r[c]))));
        const pCol = numCols.find(c => c.toLowerCase().includes('netpay') || c.toLowerCase().includes('phie') || c.toLowerCase().includes('ntg')) || numCols.filter(c => !['X','Y','Z'].includes(c))[0] || numCols[0] || '';
        setSettings(s => ({
          ...s,
          xcol: cols.find(c => c === 'X') || cols[0] || '',
          ycol: cols.find(c => c === 'Y') || cols[1] || '',
          zcol: cols.find(c => c.includes('Z') || c.includes('TVDSS')) || cols[2] || '',
          pcol: pCol,
        }));
      }
    });
  }, [selected]);

  function set(key, val) { setSettings(s => ({ ...s, [key]: val })); }

  async function calculate() {
    if (!selected || !settings.pcol) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await api.variogram({ tableName: selected, ...settings });
      setResult(r);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function downloadCSV() {
    if (!result) return;
    const cols = Object.keys(result.params[0]);
    const csv = [cols.join(','), ...result.params.map(r => cols.map(c => r[c]).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `variogram_${settings.pcol}.csv`;
    a.click();
  }

  const mainParams = result?.params?.find(p => p.Direction === 'Main');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Variogram Parameter Assistant</h1>
        <p className="text-sm text-slate-400 mt-0.5">First-pass range, sill, nugget & anisotropy recommendation for tNavigator</p>
      </div>

      <div className="info-box text-xs">
        <strong className="text-cyan">Purpose:</strong> QC and first-pass parameter recommendation for grid-property modeling. Always cross-check with depositional direction, fault compartmentalization, and blocked-well statistics.
      </div>

      {!tables.length ? (
        <div className="warn-box">No spatial/variogram table found. Go to Data Center → Spatial / Variogram Data, or load sample data.</div>
      ) : (
        <div className="grid grid-cols-4 gap-5">
          {/* Settings panel */}
          <div className="col-span-1 space-y-4">
            <div className="card space-y-3">
              <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Data Table</h2>
              <select className="select" value={selected} onChange={e => setSelected(e.target.value)}>
                {tables.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="card space-y-3">
              <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Columns</h2>
              {[['xcol','X column'],['ycol','Y column'],['zcol','Z / TVDSS'],['pcol','Property']].map(([k, label]) => (
                <div key={k}>
                  <label className="text-[10px] text-slate-400">{label}</label>
                  <select className="select mt-0.5" value={settings[k]} onChange={e => set(k, e.target.value)}>
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="text-[10px] text-slate-400">Property type</label>
                <select className="select mt-0.5" value={settings.propertyType} onChange={e => set('propertyType', e.target.value)}>
                  <option>Continuous</option>
                  <option>Binary / Netpay</option>
                </select>
              </div>
            </div>

            <div className="card space-y-3">
              <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Variogram Settings</h2>
              {[
                ['azimuth','Main azimuth (°)', 1],
                ['lagSize','Lag size (m)', 10],
                ['maxRangeH','H max range (m)', 100],
                ['maxRangeV','V max range (m)', 10],
                ['maxPerp','Bandwidth (m)', 50],
                ['verticalTol','Vert tol (m)', 10],
                ['minPairs','Min pairs/bin', 1],
                ['maxPairs','Max pairs', 5000],
              ].map(([k, label, step]) => (
                <div key={k}>
                  <label className="text-[10px] text-slate-400">{label}</label>
                  <input type="number" className="input mt-0.5" value={settings[k]} step={step} onChange={e => set(k, +e.target.value)} />
                </div>
              ))}
            </div>

            <button onClick={calculate} disabled={loading || !settings.pcol} className="btn-primary w-full flex items-center justify-center gap-2">
              <Sigma size={15} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Calculating…' : 'Calculate Variogram'}
            </button>
          </div>

          {/* Results panel */}
          <div className="col-span-3 space-y-5">
            {error && <div className="warn-box text-red-400">{error}</div>}

            {result && (
              <>
                {/* Param table */}
                <div className="card">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-300">Recommended tNavigator Parameters</h2>
                    <button onClick={downloadCSV} className="btn-secondary text-xs flex items-center gap-1"><Download size={11} />CSV</button>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700">
                        {['Direction', 'Azimuth', 'Range (m)', 'Sill', 'Nugget', 'Variance', 'Bins', 'Pairs', 'Confidence'].map(h => (
                          <th key={h} className="text-left pb-2 pr-4 text-slate-400 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.params.map((r, i) => (
                        <tr key={i} className="border-b border-slate-800/50">
                          <td className="py-2 pr-4 text-cyan font-semibold">{r.Direction}</td>
                          <td className="pr-4 font-mono text-slate-300">{r.Azimuth_deg}</td>
                          <td className="pr-4 font-mono text-white font-bold">{r.Range_m ?? '—'}</td>
                          <td className="pr-4 font-mono text-slate-300">{r.Sill}</td>
                          <td className="pr-4 font-mono text-slate-300">{r.Nugget}</td>
                          <td className="pr-4 font-mono text-slate-400">{r.Variance}</td>
                          <td className="pr-4 text-slate-400">{r.Bins}</td>
                          <td className="pr-4 text-slate-400">{r.Pairs}</td>
                          <td>
                            <span className={r.Confidence === 'High' ? 'badge-high' : r.Confidence === 'Medium' ? 'badge-med' : 'badge-low'}>
                              {r.Confidence}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 3 variogram charts */}
                <div className="grid grid-cols-3 gap-4">
                  {['Main', 'Normal', 'Vertical'].map(dir => {
                    const p = result.params.find(x => x.Direction === dir);
                    return (
                      <div key={dir} className="card">
                        <VarioChart
                          title={`${dir} Direction`}
                          expData={result.data[dir]}
                          sill={p?.Sill}
                          range={p?.Range_m}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Recommendation text */}
                <div className="card">
                  <h2 className="text-sm font-semibold text-slate-300 mb-3">Interpretation & Recommendation</h2>
                  <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                    <p>Property <strong className="text-cyan">{settings.pcol}</strong> treated as <strong className="text-cyan">{settings.propertyType}</strong>. Suggested tNavigator model: <strong>Spherical</strong>.</p>
                    {mainParams && (
                      <>
                        <p>Use variance/sill ≈ <strong className="text-white">{mainParams.Sill}</strong> and nugget ≈ <strong className="text-white">{mainParams.Nugget}</strong> as first-pass model parameters.</p>
                        {result.params.find(p => p.Direction === 'Main')?.Range_m && result.params.find(p => p.Direction === 'Normal')?.Range_m && (
                          <p>Horizontal anisotropy ratio (main/normal) ≈ <strong className="text-amber-400">{(result.params.find(p => p.Direction === 'Main').Range_m / result.params.find(p => p.Direction === 'Normal').Range_m).toFixed(2)}</strong>. Use this to set major/minor ranges in tNavigator.</p>
                        )}
                        {result.params.find(p => p.Direction === 'Vertical')?.Range_m && (
                          <p>Vertical range estimated at <strong className="text-white">{result.params.find(p => p.Direction === 'Vertical').Range_m} m</strong>. Keep conservative if vertical well control is sparse.</p>
                        )}
                      </>
                    )}
                    <p className="text-slate-500 italic">Cross-check results with depositional direction, fault compartmentalization, and blocked-well statistics before finalizing property modeling.</p>
                  </div>

                  {/* tNavigator copy block */}
                  <div className="mt-4 bg-navy-900 border border-slate-700/50 rounded-xl p-4 font-mono text-xs text-emerald-400 space-y-1">
                    <div className="text-slate-500 mb-2"># tNavigator variogram settings</div>
                    <div>Property: {settings.pcol}</div>
                    <div>Variogram Type: Spherical</div>
                    <div>Variance / Sill: {mainParams?.Sill ?? '—'}</div>
                    <div>Nugget Effect: {mainParams?.Nugget ?? '—'}</div>
                    <div>Main Direction Range: {result.params.find(p => p.Direction === 'Main')?.Range_m ?? '—'} m</div>
                    <div>Normal Direction Range: {result.params.find(p => p.Direction === 'Normal')?.Range_m ?? '—'} m</div>
                    <div>Vertical Direction Range: {result.params.find(p => p.Direction === 'Vertical')?.Range_m ?? '—'} m</div>
                    <div>Main Azimuth: {settings.azimuth}°</div>
                  </div>
                </div>
              </>
            )}

            {!result && !loading && !error && (
              <div className="card flex flex-col items-center justify-center h-64 text-center">
                <Sigma size={36} className="text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">Configure settings and click "Calculate Variogram"</p>
                <p className="text-slate-600 text-xs mt-1">Results will appear here</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
