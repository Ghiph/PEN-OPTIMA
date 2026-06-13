const BASE = '/api';

async function req(url, opts = {}) {
  const r = await fetch(BASE + url, opts);
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error || r.statusText);
  }
  return r.json();
}

export const api = {
  tables: (prefix) => req(`/tables${prefix ? `?prefix=${prefix}` : ''}`),
  table: (name, limit = 5000) => req(`/tables/${encodeURIComponent(name)}?limit=${limit}`),
  deleteTable: (name) => req(`/tables/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  seed: () => req('/seed', { method: 'POST' }),
  scenario: () => req('/scenario'),
  rankedSegments: (name) => req(`/ranked-segments/${encodeURIComponent(name)}`),
  variogram: (body) => req('/variogram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),

  upload(endpoint, files) {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    return req(`/upload/${endpoint}`, { method: 'POST', body: fd });
  },
};
