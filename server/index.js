import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  listTables, readTable, saveDF, deleteTable,
  seedSampleData, getScenarioData, rankSegments, sanitizeName
} from './db.js';
import {
  parseLASText, parsePartitionTable, parseExtOilTable,
  parseBoundaryFile, parseMarkerFile, parseCSV
} from './parsers.js';
import { calculateVariogram } from './variogram.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '100mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── Tables ──────────────────────────────────────────────────────────────────
app.get('/api/tables', (req, res) => {
  res.json(listTables(req.query.prefix || undefined));
});

app.get('/api/tables/:name', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5000;
    const rows = readTable(req.params.name);
    res.json(rows.slice(0, limit));
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.delete('/api/tables/:name', (req, res) => {
  deleteTable(req.params.name);
  res.json({ ok: true });
});

// ── Seed ─────────────────────────────────────────────────────────────────────
app.post('/api/seed', (req, res) => {
  try {
    const loaded = seedSampleData();
    res.json({ loaded });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Scenario ─────────────────────────────────────────────────────────────────
app.get('/api/scenario', (req, res) => {
  res.json(getScenarioData());
});

// ── Ranked Segments ───────────────────────────────────────────────────────────
app.get('/api/ranked-segments/:name', (req, res) => {
  try {
    const rows = readTable(req.params.name);
    res.json(rankSegments(rows));
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// ── Upload: LAS ───────────────────────────────────────────────────────────────
app.post('/api/upload/las', upload.array('files'), (req, res) => {
  try {
    const results = [];
    for (const file of req.files) {
      const text = file.buffer.toString('utf8');
      const { df, wellName } = parseLASText(text);
      const tbl = saveDF(`welllog_${wellName}`, df);
      results.push({ file: file.originalname, table: tbl, rows: df.length });
    }
    res.json(results);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Upload: Partition ─────────────────────────────────────────────────────────
app.post('/api/upload/partition', upload.array('files'), (req, res) => {
  try {
    const results = [];
    for (const file of req.files) {
      const text = file.buffer.toString('utf8');
      const df = parsePartitionTable(text, file.originalname);
      const tbl = saveDF(`vol_partition_${sanitizeName(file.originalname)}`, df);
      results.push({ file: file.originalname, table: tbl, rows: df.length });
    }
    res.json(results);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Upload: ExtOil ────────────────────────────────────────────────────────────
app.post('/api/upload/extoil', upload.array('files'), (req, res) => {
  try {
    const results = [];
    for (const file of req.files) {
      const text = file.buffer.toString('utf8');
      const df = parseExtOilTable(text, file.originalname);
      const tbl = saveDF(`vol_extoil_${sanitizeName(file.originalname)}`, df);
      results.push({ file: file.originalname, table: tbl, rows: df.length });
    }
    res.json(results);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Upload: Spatial / CSV ─────────────────────────────────────────────────────
app.post('/api/upload/spatial', upload.array('files'), (req, res) => {
  try {
    const results = [];
    for (const file of req.files) {
      const text = file.buffer.toString('utf8');
      const df = parseCSV(text);
      const tbl = saveDF(`vario_${sanitizeName(file.originalname)}`, df);
      results.push({ file: file.originalname, table: tbl, rows: df.length });
    }
    res.json(results);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Upload: Marker ────────────────────────────────────────────────────────────
app.post('/api/upload/marker', upload.array('files'), (req, res) => {
  try {
    const results = [];
    for (const file of req.files) {
      const df = parseMarkerFile(file.buffer.toString('utf8'));
      const tbl = saveDF(`markers_${sanitizeName(file.originalname)}`, df);
      results.push({ file: file.originalname, table: tbl, rows: df.length });
    }
    res.json(results);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Upload: Boundary ──────────────────────────────────────────────────────────
app.post('/api/upload/boundary', upload.array('files'), (req, res) => {
  try {
    const results = [];
    for (const file of req.files) {
      const df = parseBoundaryFile(file.buffer.toString('utf8'));
      const tbl = saveDF(`boundary_${sanitizeName(file.originalname)}`, df);
      results.push({ file: file.originalname, table: tbl, rows: df.length });
    }
    res.json(results);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Upload: Generic scenario CSV ──────────────────────────────────────────────
app.post('/api/upload/scenario', upload.array('files'), (req, res) => {
  try {
    const results = [];
    for (const file of req.files) {
      const df = parseCSV(file.buffer.toString('utf8'));
      const tbl = saveDF(`scenario_${sanitizeName(file.originalname)}`, df);
      results.push({ file: file.originalname, table: tbl, rows: df.length });
    }
    res.json(results);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Variogram ─────────────────────────────────────────────────────────────────
app.post('/api/variogram', (req, res) => {
  try {
    const { tableName, ...settings } = req.body;
    const tableData = readTable(tableName);
    const result = calculateVariogram({ tableData, ...settings });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Serve built client in production ─────────────────────────────────────────
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => console.log(`PEN-OPTIMA server → http://localhost:${PORT}`));
