// =====================================================================
// CYNO RANGE — systèmes dans un rayon de X années-lumière autour d'une
// structure, classés selon la souveraineté (allié / non-allié / neutre)
// =====================================================================

const METERS_PER_LY = 9.4607e15;

// Cache: liste de {id, x,y,z} pour tous les systèmes connus (chargé une fois, léger)
let _allSystemsCoordsCache = null;

async function loadAllSystemCoords(onProgress) {
  if (_allSystemsCoordsCache) return _allSystemsCoordsCache;
  const ids = await allSystemIds();
  if (!ids) return [];
  const out = [];
  const CHUNK = 40;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const infos = await Promise.all(chunk.map(id => systemInfo(id)));
    infos.forEach(info => {
      if (info && info.position) {
        out.push({
          id: info.system_id,
          name: info.name,
          x: info.position.x, y: info.position.y, z: info.position.z,
          security_status: info.security_status
        });
      }
    });
    if (onProgress) onProgress(Math.min(i + CHUNK, ids.length), ids.length);
  }
  _allSystemsCoordsCache = out;
  return out;
}

function distanceLY(a, b) {
  const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
  return d / METERS_PER_LY;
}

// Retourne les systèmes à portée cyno d'un système donné, avec statut allié/non-allié
async function systemsInCynoRange(originSystemId, rangeLY, allianceId) {
  const all = await loadAllSystemCoords();
  const origin = all.find(s => s.id === originSystemId);
  if (!origin) return { origin: null, systems: [] };

  const sov = await sovereigntyMap();
  const sovBySystem = new Map();
  if (Array.isArray(sov)) {
    sov.forEach(s => sovBySystem.set(s.system_id, s));
  }

  const inRange = all
    .filter(s => s.id !== origin.id)
    .map(s => ({ ...s, distance: distanceLY(origin, s) }))
    .filter(s => s.distance <= rangeLY)
    .sort((a, b) => a.distance - b.distance);

  return {
    origin,
    systems: inRange.map(s => {
      const sovInfo = sovBySystem.get(s.id);
      let status = "neutral"; // pas de sov (nullsec sans sov, lowsec, highsec, etc.)
      if (sovInfo && sovInfo.alliance_id) {
        status = sovInfo.alliance_id === allianceId ? "allied" : "hostile";
      }
      return { ...s, sovAllianceId: sovInfo ? sovInfo.alliance_id : null, status };
    })
  };
}
