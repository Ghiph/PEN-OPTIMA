import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { parseLASText, parsePartitionTable, parseBoundaryFile, parseCSV } from './parsers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export const DB_PATH = process.env.PENOPTIMA_DB || path.join(__dirname, '..', 'pen_optima.db');
const SAMPLE_DIR = path.join(__dirname, '..', 'sample_data');

// Initialize sql.js once — top-level await works in ES modules
const initSqlJs = require('sql.js');
const SQL = await initSqlJs({
  locateFile: file => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file),
});

let _db = null;

function getDB() {
  if (_db) return _db;
  if (fs.existsSync(DB_PATH)) {
    _db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    _db = new SQL.Database();
  }
  _db.run(`CREATE TABLE IF NOT EXISTS app_metadata (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`);
  _flush();
  return _db;
}

function _flush() {
  if (!_db) return;
  const buf = Buffer.from(_db.export());
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, buf);
}

function _all(sql, params) {
  const db = getDB();
  const stmt = db.prepare(sql);
  if (params && params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

export function sanitizeName(name) {
  name = path.basename(name, path.extname(name));
  name = name.replace(/[^0-9a-zA-Z_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  if (!name) name = 'table';
  if (/^\d/.test(name)) name = `t_${name}`;
  return name.slice(0, 72);
}

export function saveDF(tableName, data) {
  tableName = sanitizeName(tableName);
  if (!data || data.length === 0) return tableName;
  const db = getDB();
  const cols = Object.keys(data[0]);

  const numericCols = new Set(cols.filter(col => {
    const sample = data.slice(0, 50).map(r => r[col]).filter(v => v != null && v !== '');
    return sample.length > 0 && sample.filter(v => !isNaN(Number(v))).length > sample.length * 0.8;
  }));

  db.run(`DROP TABLE IF EXISTS "${tableName}"`);
  const colDefs = cols.map(c => `"${c}" ${numericCols.has(c) ? 'REAL' : 'TEXT'}`).join(', ');
  db.run(`CREATE TABLE "${tableName}" (${colDefs})`);

  const placeholders = cols.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT INTO "${tableName}" VALUES (${placeholders})`);
  db.run('BEGIN');
  for (const row of data) {
    stmt.run(cols.map(c => {
      const v = row[c];
      if (v == null) return null;
      if (numericCols.has(c)) return isNaN(Number(v)) ? null : Number(v);
      return String(v);
    }));
  }
  db.run('COMMIT');
  stmt.free();

  db.run(`INSERT OR REPLACE INTO app_metadata(key,value,updated_at) VALUES(?,?,?)`, [
    `table:${tableName}`,
    JSON.stringify({ rows: data.length, columns: cols }),
    new Date().toISOString(),
  ]);

  _flush();
  return tableName;
}

export function readTable(tableName) {
  return _all(`SELECT * FROM "${tableName}"`);
}

export function listTables(prefix) {
  const rows = _all(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`);
  let names = rows.map(r => r.name).filter(n => n !== 'app_metadata');
  if (prefix) names = names.filter(n => n.startsWith(prefix));
  return names;
}

export function deleteTable(tableName) {
  const db = getDB();
  db.run(`DROP TABLE IF EXISTS "${tableName}"`);
  db.run(`DELETE FROM app_metadata WHERE key=?`, [`table:${tableName}`]);
  _flush();
}

export function seedSampleData() {
  const loaded = [];

  const finalPath = path.join(SAMPLE_DIR, 'final_low_base_high_volumetric_table.csv');
  if (fs.existsSync(finalPath)) {
    const data = parseCSV(fs.readFileSync(finalPath, 'utf8'));
    if (data.length) loaded.push(saveDF('scenario_final_low_base_high', data));
  }

  for (const wf of ['B-41.las', 'L-30.las']) {
    const p = path.join(SAMPLE_DIR, wf);
    if (fs.existsSync(p)) {
      const { df, wellName } = parseLASText(fs.readFileSync(p, 'utf8'));
      if (df.length) loaded.push(saveDF(`welllog_${wellName}`, df));
    }
  }

  const markerPath = path.join(SAMPLE_DIR, 'Marker_Pe2.txt');
  if (fs.existsSync(markerPath)) {
    const text = fs.readFileSync(markerPath, 'utf8');
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split('\t').map(h => h.trim());
    const data = lines.slice(1).map(l => {
      const v = l.split('\t');
      return Object.fromEntries(headers.map((h, i) => [h, v[i]?.trim() ?? '']));
    });
    if (data.length) loaded.push(saveDF('markers_penobscot', data));
  }

  const boundaryPath = path.join(SAMPLE_DIR, 'PenobscotBoundary_1.txt');
  if (fs.existsSync(boundaryPath)) {
    const df = parseBoundaryFile(fs.readFileSync(boundaryPath, 'utf8'));
    if (df.length) loaded.push(saveDF('boundary_penobscot', df));
  }

  const varioPath = path.join(SAMPLE_DIR, 'demo_variogram_points.csv');
  if (fs.existsSync(varioPath)) {
    const data = parseCSV(fs.readFileSync(varioPath, 'utf8'));
    if (data.length) loaded.push(saveDF('vario_demo_penobscot_blocked_points', data));
  }

  const partFiles = {
    vol_partition_shallow_base: 'partitionshallowbase.txt',
    vol_partition_horc_base: 'partitionhorcpacakgebase.txt',
    vol_partition_hord_base: 'partitionhordpackagebase.txt',
    vol_partition_shallow_low: 'partition_shallow_low.txt',
    vol_partition_horc_low: 'partition_HORC_low.txt',
    vol_partition_hord_low: 'partition_HORD_low.txt',
    vol_partition_shallow_high: 'Vol_Partition_Shallow_high.txt',
    vol_partition_horc_high: 'Vol_Partition_HORC_high.txt',
    vol_partition_hord_high: 'Vol_Partition_HORD_high.txt',
  };
  for (const [tbl, fname] of Object.entries(partFiles)) {
    const p = path.join(SAMPLE_DIR, fname);
    if (fs.existsSync(p)) {
      const df = parsePartitionTable(fs.readFileSync(p, 'utf8'), tbl);
      if (df.length) loaded.push(saveDF(tbl, df));
    }
  }

  return loaded.filter(Boolean);
}

export function getScenarioData() {
  const tables = listTables('scenario_');
  if (tables.length > 0) {
    const rows = readTable(tables[0]);
    if (rows.length && 'STOIIP (MMSTB)' in rows[0]) return rows;
  }
  return [
    { Case: 'Low / Conservative', Contact: 'Shallow OWC', Sw: 0.70, So: 0.30, 'Bo (rm³/sm³)': 1.30, RF: 0.20, 'STOIIP (MMSTB)': 154.04, 'Recoverable Oil (MMSTB)': 30.81, Interpretation: 'Conservative' },
    { Case: 'Base / Most Defensible', Contact: 'Hor_C OWC', Sw: 0.60, So: 0.40, 'Bo (rm³/sm³)': 1.20, RF: 0.30, 'STOIIP (MMSTB)': 512.42, 'Recoverable Oil (MMSTB)': 153.73, Interpretation: 'Main development basis' },
    { Case: 'High / Upside', Contact: 'Hor_D OWC', Sw: 0.50, So: 0.50, 'Bo (rm³/sm³)': 1.10, RF: 0.40, 'STOIIP (MMSTB)': 4307.57, 'Recoverable Oil (MMSTB)': 1723.03, Interpretation: 'Aggressive upside' },
  ];
}

export function rankSegments(data) {
  const filtered = data.filter(r =>
    String(r.Segment).toLowerCase() !== 'total' &&
    String(r.Zone).toLowerCase() !== 'total'
  );
  if (!filtered.length) return [];

  const map = {};
  for (const r of filtered) {
    const k = `${r.Zone}||${r.Segment}`;
    if (!map[k]) map[k] = { Zone: r.Zone, Segment: r.Segment, _thickArr: [], Area_m2: 0, HCPV_rm3: 0, STOIIP_MMSTB: 0, RecOil_MMSTB: 0 };
    map[k].Area_m2 += Number(r.Area_m2) || 0;
    map[k]._thickArr.push(Number(r.Mean_Thickness_m) || 0);
    map[k].HCPV_rm3 += Number(r.HCPV_rm3) || 0;
    map[k].STOIIP_MMSTB += Number(r.STOIIP_MMSTB) || 0;
    map[k].RecOil_MMSTB += Number(r.RecOil_MMSTB) || 0;
  }

  const rows = Object.values(map).map(r => ({
    ...r,
    Mean_Thickness_m: r._thickArr.reduce((a, b) => a + b, 0) / (r._thickArr.length || 1),
  }));

  const mx = {
    HCPV: Math.max(...rows.map(r => r.HCPV_rm3)) || 1,
    STOIIP: Math.max(...rows.map(r => r.STOIIP_MMSTB)) || 1,
    Rec: Math.max(...rows.map(r => r.RecOil_MMSTB)) || 1,
    Thick: Math.max(...rows.map(r => r.Mean_Thickness_m)) || 1,
  };

  return rows.map(r => {
    const score = (0.35 * r.HCPV_rm3 / mx.HCPV + 0.30 * r.STOIIP_MMSTB / mx.STOIIP + 0.20 * r.RecOil_MMSTB / mx.Rec + 0.15 * r.Mean_Thickness_m / mx.Thick) * 100;
    return {
      Zone: r.Zone, Segment: r.Segment,
      Area_m2: +r.Area_m2.toFixed(0),
      Mean_Thickness_m: +r.Mean_Thickness_m.toFixed(2),
      HCPV_rm3: +r.HCPV_rm3.toFixed(0),
      STOIIP_MMSTB: +r.STOIIP_MMSTB.toFixed(4),
      RecOil_MMSTB: +r.RecOil_MMSTB.toFixed(4),
      Priority_Score: +score.toFixed(1),
      Recommended_Action: score >= 70 ? 'Primary target' : score >= 40 ? 'Secondary target' : 'Monitor/appraise',
    };
  }).sort((a, b) => b.Priority_Score - a.Priority_Score);
}
