import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Download, RefreshCw, Database, ChevronRight } from 'lucide-react';
import { api } from '../api.js';

function FileDropZone({ accept, multiple = true, onUpload, label }) {
  const ref = useRef();
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState([]);

  function onDrop(e) {
    e.preventDefault(); setDragging(false);
    const f = [...e.dataTransfer.files].filter(f => accept.split(',').some(a => f.name.endsWith(a.trim().replace('*', ''))));
    setFiles(f);
  }

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragging ? 'border-cyan/60 bg-cyan/5' : 'border-slate-600/60 hover:border-slate-500 hover:bg-navy-700/30'}`}
        onClick={() => ref.current.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Upload size={24} className="mx-auto mb-2 text-slate-500" />
        <p className="text-sm text-slate-400">{label || 'Drop files here or click to browse'}</p>
        <p className="text-xs text-slate-600 mt-1">{accept}</p>
        <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden" onChange={e => setFiles([...e.target.files])} />
      </div>
      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 bg-navy-900 rounded-lg px-3 py-2 text-xs text-slate-300">
              <ChevronRight size={12} className="text-cyan" />{f.name}
              <span className="text-slate-500 ml-auto">{(f.size / 1024).toFixed(0)} KB</span>
            </div>
          ))}
          <button onClick={() => { onUpload(files); setFiles([]); }} className="btn-primary w-full mt-2">
            Upload {files.length} file{files.length > 1 ? 's' : ''}
          </button>
        </div>
      )}
    </div>
  );
}

function StatusMsg({ results }) {
  if (!results) return null;
  return (
    <div className="space-y-1 mt-3">
      {results.map((r, i) => (
        <div key={i} className="text-xs bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2 text-emerald-400">
          ✓ {r.file} → <code>{r.table}</code> ({r.rows.toLocaleString()} rows)
        </div>
      ))}
    </div>
  );
}

const TABS = ['LAS Well Logs', 'tNavigator Volumetric', 'Spatial / Variogram', 'Markers / Boundary', 'Manage DB'];

export default function DataCenter() {
  const [tab, setTab] = useState(0);
  const [tables, setTables] = useState([]);
  const [preview, setPreview] = useState('');
  const [previewData, setPreviewData] = useState([]);
  const [results, setResults] = useState(null);
  const [seeding, setSeeding] = useState(false);

  async function loadTables() { setTables(await api.tables()); }
  useEffect(() => { loadTables(); }, []);

  async function uploadFiles(endpoint, files) {
    try {
      const r = await api.upload(endpoint, files);
      setResults(r);
      loadTables();
    } catch (e) { alert(e.message); }
  }

  async function handlePreview(name) {
    setPreview(name);
    setPreviewData(await api.table(name, 250));
  }

  async function handleDelete(name) {
    if (!confirm(`Delete table "${name}"?`)) return;
    await api.deleteTable(name);
    setPreview('');
    setPreviewData([]);
    loadTables();
  }

  async function downloadCSV(name) {
    const rows = await api.table(name, 100000);
    const cols = Object.keys(rows[0] || {});
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => `"${r[c] ?? ''}"`).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${name}.csv`;
    a.click();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Center</h1>
          <p className="text-sm text-slate-400 mt-0.5">Upload and manage field data in SQLite</p>
        </div>
        <button onClick={async () => { setSeeding(true); try { await api.seed(); loadTables(); } finally { setSeeding(false); } }} disabled={seeding} className="btn-secondary flex items-center gap-2">
          {seeding ? <RefreshCw size={13} className="animate-spin" /> : <Database size={13} />}
          Load Sample Data
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-navy-900 border border-slate-700/50 rounded-xl w-fit">
        {TABS.map((t, i) => (
          <button key={i} onClick={() => { setTab(i); setResults(null); }} className={`tab ${tab === i ? 'tab-active' : 'tab-inactive'}`}>{t}</button>
        ))}
      </div>

      <div className="card">
        {tab === 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Upload LAS Well Log Files</h2>
            <FileDropZone accept=".las" label="Drop .las files here" onUpload={f => uploadFiles('las', f)} />
            <StatusMsg results={results} />
          </div>
        )}
        {tab === 1 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-4">Upload tNavigator Volumetric Tables</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-slate-400 mb-2">Partition Tables (.txt)</div>
                <FileDropZone accept=".txt,.csv" label="Partition tables" onUpload={f => uploadFiles('partition', f)} />
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-2">Extended Oil Tables (.txt)</div>
                <FileDropZone accept=".txt,.csv" label="ExtOil tables" onUpload={f => uploadFiles('extoil', f)} />
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-2">Final Scenario CSV</div>
                <FileDropZone accept=".csv" label="Scenario CSV" onUpload={f => uploadFiles('scenario', f)} />
              </div>
            </div>
            <StatusMsg results={results} />
          </div>
        )}
        {tab === 2 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-2">Upload Spatial / Variogram Data</h2>
            <p className="text-xs text-slate-400 mb-4">Export blocked-well statistics or grid-property samples from tNavigator. Required columns: X, Y, Z/TVDSS, and a property (PHIE, NTG, VSH, Netpay).</p>
            <FileDropZone accept=".csv,.txt" label="Spatial CSV / TXT files" onUpload={f => uploadFiles('spatial', f)} />
            <StatusMsg results={results} />
          </div>
        )}
        {tab === 3 && (
          <div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-400 mb-2">Marker Files (tab-separated)</div>
                <FileDropZone accept=".txt,.csv" label="Marker files" onUpload={f => uploadFiles('marker', f)} />
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-2">Boundary Files (whitespace-separated)</div>
                <FileDropZone accept=".txt,.csv" label="Boundary files" onUpload={f => uploadFiles('boundary', f)} />
              </div>
            </div>
            <StatusMsg results={results} />
          </div>
        )}
        {tab === 4 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-300">Database Tables ({tables.length})</h2>
              <button onClick={loadTables} className="btn-secondary text-xs flex items-center gap-1"><RefreshCw size={12} />Refresh</button>
            </div>
            <div className="flex gap-4 min-h-[400px]">
              {/* Table list */}
              <div className="w-56 shrink-0 space-y-1 overflow-y-auto">
                {tables.map(t => (
                  <div
                    key={t}
                    onClick={() => handlePreview(t)}
                    className={`px-3 py-2 rounded-lg text-xs cursor-pointer transition-all flex items-center justify-between group ${preview === t ? 'bg-cyan/10 text-cyan border border-cyan/20' : 'text-slate-400 hover:bg-navy-700 hover:text-slate-200'}`}
                  >
                    <span className="truncate">{t}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={e => { e.stopPropagation(); downloadCSV(t); }} className="text-slate-500 hover:text-cyan p-0.5"><Download size={11} /></button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(t); }} className="text-slate-500 hover:text-red-400 p-0.5"><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div className="flex-1 overflow-auto">
                {preview && previewData.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400 font-mono">{preview} — {previewData.length} rows preview</span>
                      <button onClick={() => downloadCSV(preview)} className="btn-secondary text-xs flex items-center gap-1"><Download size={11} />CSV</button>
                    </div>
                    <div className="overflow-auto border border-slate-700/50 rounded-xl">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-navy-800">
                          <tr>
                            {Object.keys(previewData[0]).map(h => (
                              <th key={h} className="text-left px-3 py-2 text-slate-400 font-medium whitespace-nowrap border-b border-slate-700">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.map((row, i) => (
                            <tr key={i} className="border-b border-slate-800/40 hover:bg-navy-700/30">
                              {Object.values(row).map((v, j) => (
                                <td key={j} className="px-3 py-1.5 text-slate-300 font-mono whitespace-nowrap">{v ?? '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-600 text-sm">Select a table to preview</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
