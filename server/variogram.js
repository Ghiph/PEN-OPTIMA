export function sphericalModel(h, nugget, sill, range_) {
  if (!range_ || range_ <= 0) return h.map(() => NaN);
  return h.map(hi => {
    if (hi >= range_) return sill;
    const hr = hi / range_;
    return nugget + (sill - nugget) * (1.5 * hr - 0.5 * hr * hr * hr);
  });
}

function computePairs(points, maxPairs) {
  const n = points.length;
  const totalPairs = (n * (n - 1)) / 2;
  const pairs = [];

  if (totalPairs <= maxPairs) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dp = points[j].p - points[i].p;
        pairs.push({
          dx: points[j].x - points[i].x,
          dy: points[j].y - points[i].y,
          dz: points[j].z - points[i].z,
          g: 0.5 * dp * dp,
        });
      }
    }
  } else {
    for (let k = 0; k < maxPairs; k++) {
      const i = Math.floor(Math.random() * n);
      let j = Math.floor(Math.random() * (n - 1));
      if (j >= i) j++;
      const dp = points[j].p - points[i].p;
      pairs.push({
        dx: points[j].x - points[i].x,
        dy: points[j].y - points[i].y,
        dz: points[j].z - points[i].z,
        g: 0.5 * dp * dp,
      });
    }
  }
  return pairs;
}

function dirVariogram(pairs, direction, azDeg, lagSize, maxRange, maxPerp, maxVertTol, minPairs) {
  const az = (azDeg * Math.PI) / 180;
  const ux = Math.sin(az), uy = Math.cos(az);
  const px = Math.sin(az + Math.PI / 2), py = Math.cos(az + Math.PI / 2);

  const filtered = [];
  for (const { dx, dy, dz, g } of pairs) {
    let h, valid;
    if (direction === 'Vertical') {
      h = Math.abs(dz);
      const lat = Math.sqrt(dx * dx + dy * dy);
      valid = h > 0 && h <= maxRange && lat <= maxPerp;
    } else {
      const proj = Math.abs(dx * ux + dy * uy);
      const perp = Math.abs(dx * px + dy * py);
      h = proj;
      valid = h > 0 && h <= maxRange && perp <= maxPerp && Math.abs(dz) <= maxVertTol;
    }
    if (valid) filtered.push({ h, g });
  }

  if (filtered.length === 0) return [];

  const numBins = Math.max(1, Math.ceil(maxRange / lagSize));
  const bins = Array.from({ length: numBins }, () => ({ h: [], g: [] }));
  for (const { h, g } of filtered) {
    const bi = Math.min(Math.floor(h / lagSize), numBins - 1);
    bins[bi].h.push(h);
    bins[bi].g.push(g);
  }

  return bins
    .filter(b => b.h.length >= minPairs)
    .map((b, i) => ({
      Lag: i + 1,
      Distance: b.h.reduce((s, v) => s + v, 0) / b.h.length,
      Gamma: b.g.reduce((s, v) => s + v, 0) / b.g.length,
      Pairs: b.h.length,
    }));
}

function estimateParams(expDf, vals, propertyType) {
  const finite = vals.filter(v => isFinite(v));
  let variance = 1e-6;
  if (finite.length >= 2) {
    if (propertyType === 'Binary / Netpay') {
      const p = finite.filter(v => v > 0.5).length / finite.length;
      variance = Math.max(1e-6, p * (1 - p));
    } else {
      const mean = finite.reduce((a, b) => a + b, 0) / finite.length;
      variance = Math.max(1e-6, finite.reduce((s, v) => s + (v - mean) ** 2, 0) / (finite.length - 1));
    }
  }

  if (expDf.length === 0)
    return { Variance: variance, Nugget: 0, Sill: variance, Range: null, Confidence: 'Low', Bins: 0, Pairs: 0 };

  const sorted = [...expDf].sort((a, b) => a.Distance - b.Distance);
  const firstG = sorted[0].Gamma;
  const maxG = Math.max(...sorted.map(r => r.Gamma));
  const sill = Math.max(variance, Math.min(maxG, variance * 1.35));
  const nugget = Math.max(0, Math.min(firstG, sill * 0.25));
  const threshold = nugget + 0.95 * (sill - nugget);
  const reached = sorted.find(r => r.Gamma >= threshold);
  let range = reached ? reached.Distance : sorted[sorted.length - 1].Distance;
  range = Math.max(range, sorted[0].Distance);

  const bins = sorted.length;
  const pairs = sorted.reduce((s, r) => s + r.Pairs, 0);
  const confidence = bins >= 8 && pairs >= 200 ? 'High' : bins >= 5 && pairs >= 80 ? 'Medium' : 'Low';
  return { Variance: variance, Nugget: nugget, Sill: sill, Range: range, Confidence: confidence, Bins: bins, Pairs: pairs };
}

export function calculateVariogram({ tableData, xcol, ycol, zcol, pcol, azimuth, lagSize, maxRangeH, maxRangeV, maxPerp, verticalTol, minPairs, maxPairs, propertyType }) {
  let points = tableData
    .map(r => ({
      x: parseFloat(r[xcol]),
      y: parseFloat(r[ycol]),
      z: parseFloat(r[zcol]),
      p: parseFloat(r[pcol]),
    }))
    .filter(r => isFinite(r.x) && isFinite(r.y) && isFinite(r.z) && isFinite(r.p));

  if (points.length > 1800) {
    points = points.sort(() => Math.random() - 0.5).slice(0, 1800);
  }
  if (points.length < 6) throw new Error('Too few valid data points (need at least 6).');

  const vals = points.map(r => r.p);
  const pairs = computePairs(points, maxPairs || 90000);

  const directions = [
    { name: 'Main', dir: 'Horizontal', az: azimuth, maxR: maxRangeH },
    { name: 'Normal', dir: 'Horizontal', az: azimuth + 90, maxR: maxRangeH },
    { name: 'Vertical', dir: 'Vertical', az: azimuth, maxR: maxRangeV },
  ];

  const results = [];
  const expData = {};

  for (const d of directions) {
    const ls = d.name === 'Vertical' ? Math.max(10, lagSize / 5) : lagSize;
    const exp = dirVariogram(pairs, d.dir, d.az, ls, d.maxR, maxPerp, verticalTol, minPairs);
    const p = estimateParams(exp, vals, propertyType);

    results.push({
      Direction: d.name,
      Azimuth_deg: d.name === 'Vertical' ? 'Vert' : String(((d.az % 180) + 180) % 180).slice(0, 6),
      Range_m: p.Range != null ? +p.Range.toFixed(1) : null,
      Sill: +p.Sill.toFixed(4),
      Nugget: +p.Nugget.toFixed(4),
      Variance: +p.Variance.toFixed(4),
      Bins: p.Bins,
      Pairs: p.Pairs,
      Confidence: p.Confidence,
    });

    const maxH = exp.length > 0 ? Math.max(...exp.map(r => r.Distance), p.Range || 1) : (p.Range || d.maxR);
    const modelH = Array.from({ length: 80 }, (_, i) => (i / 79) * maxH * 1.15);
    const modelG = sphericalModel(modelH, p.Nugget, p.Sill, p.Range || maxH);

    expData[d.name] = {
      experimental: exp,
      model: modelH.map((h, i) => ({ h: +h.toFixed(1), g: isFinite(modelG[i]) ? +modelG[i].toFixed(5) : null })),
      sill: p.Sill,
      range: p.Range,
    };
  }

  return { params: results, data: expData };
}
