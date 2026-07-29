// =====================================================================
// ESI CLIENT — wrapper générique + résolution de noms + cache mémoire
// =====================================================================

const ESI_BASE = "https://esi.evetech.net/latest";
const _nameCache = new Map();
const _typeCache = new Map();
const _systemCache = new Map();

// Résultat spécial renvoyé quand on n'a pas la permission / le scope
const NO_ACCESS = Symbol("NO_ACCESS");

async function esiFetch(path, { needsAuth = false, requiredScope = null, params = {} } = {}) {
  if (needsAuth && requiredScope && !hasScope(requiredScope)) {
    return NO_ACCESS;
  }

  const url = new URL(ESI_BASE + path);
  Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));

  const headers = {};
  if (needsAuth) {
    try {
      const token = await getValidAccessToken();
      headers["Authorization"] = `Bearer ${token}`;
    } catch {
      return NO_ACCESS;
    }
  }

  const res = await fetch(url.toString(), { headers });
  if (res.status === 403 || res.status === 401) return NO_ACCESS;
  if (res.status === 404) return null;
  if (!res.ok) {
    console.warn("ESI error", path, res.status);
    return null;
  }
  return await res.json();
}

// Pagination (x-pages header)
async function esiFetchAllPages(path, opts = {}) {
  const first = await esiFetchRaw(path, { ...opts, page: 1 });
  if (first === NO_ACCESS || !first) return first;
  const pages = first.pages || 1;
  let results = [...first.data];
  for (let p = 2; p <= pages; p++) {
    const r = await esiFetchRaw(path, { ...opts, page: p });
    if (r && r.data) results = results.concat(r.data);
  }
  return results;
}

async function esiFetchRaw(path, { needsAuth = false, requiredScope = null, params = {}, page = null } = {}) {
  if (needsAuth && requiredScope && !hasScope(requiredScope)) return NO_ACCESS;
  const url = new URL(ESI_BASE + path);
  Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
  if (page) url.searchParams.set("page", page);

  const headers = {};
  if (needsAuth) {
    try {
      headers["Authorization"] = `Bearer ${await getValidAccessToken()}`;
    } catch {
      return NO_ACCESS;
    }
  }
  const res = await fetch(url.toString(), { headers });
  if (res.status === 403 || res.status === 401) return NO_ACCESS;
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json();
  const pages = parseInt(res.headers.get("x-pages") || "1", 10);
  return { data, pages };
}

// ---------- Résolution de noms en masse ----------
async function resolveNames(ids) {
  const uniq = [...new Set(ids)].filter(id => id && !_nameCache.has(id));
  for (let i = 0; i < uniq.length; i += 1000) {
    const batch = uniq.slice(i, i + 1000);
    const res = await fetch(`${ESI_BASE}/universe/names/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch)
    });
    if (res.ok) {
      const data = await res.json();
      data.forEach(item => _nameCache.set(item.id, item));
    }
  }
  const out = {};
  ids.forEach(id => out[id] = _nameCache.get(id));
  return out;
}
function cachedName(id) {
  const e = _nameCache.get(id);
  return e ? e.name : `#${id}`;
}

// ---------- Types (items) ----------
async function typeInfo(typeId) {
  if (_typeCache.has(typeId)) return _typeCache.get(typeId);
  const data = await esiFetch(`/universe/types/${typeId}/`);
  if (data) _typeCache.set(typeId, data);
  return data;
}

// ---------- Systèmes (coordonnées pour le calcul cyno) ----------
async function systemInfo(systemId) {
  if (_systemCache.has(systemId)) return _systemCache.get(systemId);
  const data = await esiFetch(`/universe/systems/${systemId}/`);
  if (data) _systemCache.set(systemId, data);
  return data;
}

let _sovMapCache = null;
async function sovereigntyMap() {
  if (_sovMapCache) return _sovMapCache;
  _sovMapCache = await esiFetch(`/sovereignty/map/`);
  return _sovMapCache;
}

let _allSystemIdsCache = null;
async function allSystemIds() {
  if (_allSystemIdsCache) return _allSystemIdsCache;
  _allSystemIdsCache = await esiFetch(`/universe/systems/`);
  return _allSystemIdsCache;
}

function isk(n) {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n) + " ISK";
}
function num(n) {
  return new Intl.NumberFormat("fr-FR").format(n);
}
