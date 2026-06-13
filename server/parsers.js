const MMSTB_FACTOR = 6.2898 / 1_000_000;

export function parseLASText(text) {
  const lines = text.split('\n');
  let wellName = 'unknown_well';

  // Find well name in ~WELL section
  let inWell = false;
  for (const line of lines) {
    const s = line.trim();
    if (s.toLowerCase().startsWith('~well')) { inWell = true; continue; }
    if (inWell && s.startsWith('~')) break;
    if (inWell && s.toUpperCase().startsWith('WELL')) {
      const beforeComment = s.split(':')[0];
      if (beforeComment.includes('.')) {
        const val = beforeComment.split('.').slice(1).join('.').trim();
        if (val) wellName = val.split(/\s+/)[0].replace(/-/g, '_');
      }
      break;
    }
  }

  let curveStart = null, asciiStart = null;
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].trim().toLowerCase();
    if (s.startsWith('~curve') || s.startsWith('~c')) curveStart = i;
    if (s.startsWith('~ascii') || s.startsWith('~a')) { asciiStart = i; break; }
  }
  if (curveStart === null || asciiStart === null)
    throw new Error('LAS file missing ~Curve or ~Ascii section.');

  const RENAME = {
    DEPT: 'Depth', CALI_DA: 'CALI', GRS: 'GR', GRS_DA: 'GR',
    RESM_DA: 'RESM', RHOB_DA: 'RHOB', NPHI_DA: 'NPHI', DT_DA: 'DT',
    VCL_DA: 'VCL', PHIE_DA: 'PHIE', PHIT_DA: 'PHIT',
  };

  const rawCurves = [];
  for (let i = curveStart + 1; i < asciiStart; i++) {
    const s = lines[i].trim();
    if (!s || s.startsWith('#') || s.startsWith('~')) continue;
    const mnemonic = s.split(/[\.\s]/)[0].trim();
    if (mnemonic) rawCurves.push(mnemonic.replace(/__/g, '_'));
  }
  const curves = rawCurves.map(c => RENAME[c] || c);

  const rows = [];
  for (let i = asciiStart + 1; i < lines.length; i++) {
    const s = lines[i].trim();
    if (!s || s.startsWith('#') || s.startsWith('~')) continue;
    const parts = s.split(/\s+/);
    if (parts.length < curves.length) continue;
    const row = { Well: wellName.replace(/_/g, '-') };
    let valid = true;
    for (let j = 0; j < curves.length; j++) {
      const v = parseFloat(parts[j]);
      if (isNaN(v)) { valid = false; break; }
      row[curves[j]] = (v === -999.25 || v === -999.0) ? null : v;
    }
    if (valid) rows.push(row);
  }
  return { df: rows, wellName };
}

export function parsePartitionTable(text, sourceName) {
  const COLS = [
    'Zone', 'Segment', 'Area_m2', 'Mean_Thickness_m', 'GeomVolume_m3',
    'NetVolume_m3', 'PoreVolume_rm3', 'HCPV_rm3', 'STOIIP_sm3', 'RecOil_sm3',
  ];
  const rows = [];
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    const parts = s.split(',');
    if (parts.length < COLS.length) continue;
    const row = {};
    for (let i = 0; i < COLS.length; i++)
      row[COLS[i]] = i < 2 ? parts[i].trim() : (parseFloat(parts[i]) || 0);
    row.STOIIP_MMSTB = (row.STOIIP_sm3 || 0) * MMSTB_FACTOR;
    row.RecOil_MMSTB = (row.RecOil_sm3 || 0) * MMSTB_FACTOR;
    row.Source = sourceName;
    rows.push(row);
  }
  return rows;
}

export function parseExtOilTable(text, sourceName) {
  const COLS = [
    'Zone', 'Segment', 'Area_m2', 'Mean_Thickness_m', 'Porosity', 'Bo_rm3_sm3',
    'Oil_Density_kg_m3', 'OilNetVolume_m3', 'STOIIP_Mass_kg', 'Oil_Saturation',
  ];
  const rows = [];
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    const parts = s.split(',');
    if (parts.length < COLS.length) continue;
    const row = {};
    for (let i = 0; i < COLS.length; i++)
      row[COLS[i]] = i < 2 ? parts[i].trim() : (parseFloat(parts[i]) || 0);
    row.Source = sourceName;
    rows.push(row);
  }
  return rows;
}

export function parseBoundaryFile(text) {
  return text.split('\n')
    .map(l => l.trim().split(/\s+/))
    .filter(p => p.length >= 2 && !isNaN(parseFloat(p[0])))
    .map(p => ({ X: parseFloat(p[0]), Y: parseFloat(p[1]), Z: parseFloat(p[2]) || 0 }));
}

export function parseMarkerFile(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];
  const headers = lines[0].split('\t').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split('\t');
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]?.trim() ?? '']));
  });
}

export function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line).map(v => v.replace(/^"|"$/g, '').trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  });
}

function splitCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}
