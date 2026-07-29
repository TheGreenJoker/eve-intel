// =====================================================================
// APP — orchestre le chargement et l'affichage des 3 pages
// =====================================================================

function panelHTML(title, count, bodyHtml) {
  return `
    <div class="panel">
      <div class="panel-head">
        <div class="panel-title">${title}</div>
        ${count !== null ? `<div class="panel-count">${count}</div>` : ""}
      </div>
      ${bodyHtml}
    </div>`;
}
function noAccessHTML(scopeName) {
  return `<div class="no-access">Pas de permission ESI pour cette section${scopeName ? ` <span class="mono">(${scopeName})</span>` : ""}</div>`;
}
function loadingHTML() {
  return `<div class="loading">Chargement…</div>`;
}

async function initApp() {
  const session = getSession();
  if (!session) { window.location.href = "index.html"; return; }

  document.getElementById("who-name").textContent = session.character_name;
  document.getElementById("who-portrait").src = `https://images.evetech.net/characters/${session.character_id}/portrait?size=64`;

  const charData = await esiFetch(`/characters/${session.character_id}/`);
  const corpId = charData ? charData.corporation_id : null;
  const allianceId = charData ? charData.alliance_id : null;

  window.__ctx = { session, charData, corpId, allianceId };

  await renderCharacterPage();
  if (corpId) await renderCorpPage(); else document.getElementById("page-corp").innerHTML = `<div class="no-access">Pas de corporation.</div>`;
  if (allianceId) await renderAlliancePage(); else document.getElementById("page-alliance").innerHTML = `<div class="no-access">Cette corporation n'appartient à aucune alliance.</div>`;
}

// =====================================================================
// PAGE PERSONNAGE
// =====================================================================
async function renderCharacterPage() {
  const el = document.getElementById("page-char");
  el.innerHTML = loadingHTML();
  const { session, charData } = window.__ctx;
  const cid = session.character_id;

  const [location, ship, online, skills, skillQueue, wallet, journal, clones, contracts, industryJobs, notifications, contacts] = await Promise.all([
    esiFetch(`/characters/${cid}/location/`, { needsAuth: true, requiredScope: "esi-location.read_location.v1" }),
    esiFetch(`/characters/${cid}/ship/`, { needsAuth: true, requiredScope: "esi-location.read_ship_type.v1" }),
    esiFetch(`/characters/${cid}/online/`, { needsAuth: true, requiredScope: "esi-location.read_online.v1" }),
    esiFetch(`/characters/${cid}/skills/`, { needsAuth: true, requiredScope: "esi-skills.read_skills.v1" }),
    esiFetch(`/characters/${cid}/skillqueue/`, { needsAuth: true, requiredScope: "esi-skills.read_skillqueue.v1" }),
    esiFetch(`/characters/${cid}/wallet/`, { needsAuth: true, requiredScope: "esi-wallet.read_character_wallet.v1" }),
    esiFetchAllPages(`/characters/${cid}/wallet/journal/`, { needsAuth: true, requiredScope: "esi-wallet.read_character_wallet.v1" }),
    esiFetch(`/characters/${cid}/clones/`, { needsAuth: true, requiredScope: "esi-clones.read_clones.v1" }),
    esiFetchAllPages(`/characters/${cid}/contracts/`, { needsAuth: true, requiredScope: "esi-contracts.read_character_contracts.v1" }),
    esiFetch(`/characters/${cid}/industry/jobs/`, { needsAuth: true, requiredScope: "esi-industry.read_character_jobs.v1" }),
    esiFetchAllPages(`/characters/${cid}/notifications/`, { needsAuth: true, requiredScope: "esi-characters.read_notifications.v1" }),
    esiFetchAllPages(`/characters/${cid}/contacts/`, { needsAuth: true, requiredScope: "esi-characters.read_contacts.v1" })
  ]);
  const assets = await esiFetchAllPages(`/characters/${cid}/assets/`, { needsAuth: true, requiredScope: "esi-assets.read_assets.v1" });

  let html = `<div class="grid-2">`;

  // --- Identité / localisation ---
  html += panelHTML("Identité", null, `
    <div class="stat"><span class="k">Nom</span><span class="v">${charData?.name ?? "—"}</span></div>
    <div class="stat"><span class="k">Sécurité</span><span class="v">${charData?.security_status?.toFixed(2) ?? "—"}</span></div>
    <div class="stat"><span class="k">Date de création</span><span class="v mono">${charData?.birthday ? new Date(charData.birthday).toLocaleDateString("fr-FR") : "—"}</span></div>
  `);

  if (location === NO_ACCESS) {
    html += panelHTML("Localisation", null, noAccessHTML("esi-location.read_location.v1"));
  } else {
    const sysName = location.solar_system_id ? cachedName(location.solar_system_id) : "—";
    await resolveNames([location.solar_system_id]);
    html += panelHTML("Localisation & vaisseau", null, `
      <div class="stat"><span class="k">Système</span><span class="v">${cachedName(location.solar_system_id)}</span></div>
      <div class="stat"><span class="k">En ligne</span><span class="v">${online === NO_ACCESS ? "—" : (online?.online ? "🟢 Oui" : "🔴 Non")}</span></div>
      <div class="stat"><span class="k">Vaisseau</span><span class="v">${ship === NO_ACCESS ? noAccessInline() : (await typeInfo(ship.ship_type_id))?.name ?? ship.ship_type_id}</span></div>
      <div class="stat"><span class="k">Nom du vaisseau</span><span class="v">${ship === NO_ACCESS ? "—" : (ship.ship_name || "—")}</span></div>
    `);
  }
  html += `</div><div class="grid-2">`;

  // --- Skills ---
  if (skills === NO_ACCESS) {
    html += panelHTML("Compétences", null, noAccessHTML("esi-skills.read_skills.v1"));
  } else {
    const totalSp = skills.total_sp;
    const queueLen = skillQueue === NO_ACCESS ? "—" : skillQueue.length;
    html += panelHTML("Compétences", `${skills.skills.length} skills`, `
      <div class="stat"><span class="k">SP total</span><span class="v">${num(totalSp)}</span></div>
      <div class="stat"><span class="k">SP non alloués</span><span class="v">${num(skills.unallocated_sp || 0)}</span></div>
      <div class="stat"><span class="k">File d'entraînement</span><span class="v">${queueLen} skill(s)</span></div>
    `);
  }

  // --- Wallet ---
  if (wallet === NO_ACCESS) {
    html += panelHTML("Portefeuille", null, noAccessHTML("esi-wallet.read_character_wallet.v1"));
  } else {
    const journalRows = journal === NO_ACCESS ? [] : (journal || []).slice(0, 30);
    html += panelHTML("Portefeuille", journal === NO_ACCESS ? null : `${journal.length} tx`, `
      <div class="stat"><span class="k">Solde</span><span class="v pos">${isk(wallet)}</span></div>
      ${journal === NO_ACCESS ? noAccessHTML("wallet journal") : `
      <div class="scroll-y" style="margin-top:10px;">
        <table><thead><tr><th>Date</th><th>Type</th><th>Montant</th><th>Raison</th></tr></thead><tbody>
        ${journalRows.map(j => `<tr><td class="mono">${new Date(j.date).toLocaleDateString("fr-FR")}</td><td>${j.ref_type}</td><td class="mono ${j.amount >= 0 ? "v pos" : "v neg"}">${isk(j.amount)}</td><td>${j.reason || j.description || "—"}</td></tr>`).join("")}
        </tbody></table>
      </div>`}
    `);
  }
  html += `</div><div class="grid-2">`;

  // --- Clones/implants ---
  if (clones === NO_ACCESS) {
    html += panelHTML("Clones & implants", null, noAccessHTML("esi-clones.read_clones.v1"));
  } else {
    html += panelHTML("Clones & implants", `${clones.jump_clones?.length ?? 0} clone(s)`, `
      <div class="stat"><span class="k">Clone actif</span><span class="v">Home location: ${clones.home_location?.location_id ?? "—"}</span></div>
      <div class="stat"><span class="k">Dernier saut</span><span class="v mono">${clones.last_clone_jump_date ? new Date(clones.last_clone_jump_date).toLocaleString("fr-FR") : "—"}</span></div>
    `);
  }

  // --- Notifications ---
  if (notifications === NO_ACCESS) {
    html += panelHTML("Notifications", null, noAccessHTML("esi-characters.read_notifications.v1"));
  } else {
    const rows = (notifications || []).slice(0, 20);
    html += panelHTML("Notifications récentes", `${notifications.length}`, `
      <div class="scroll-y"><table><thead><tr><th>Date</th><th>Type</th></tr></thead><tbody>
      ${rows.map(n => `<tr><td class="mono">${new Date(n.timestamp).toLocaleDateString("fr-FR")}</td><td>${n.type}</td></tr>`).join("")}
      </tbody></table></div>
    `);
  }
  html += `</div>`;

  // --- Assets ---
  if (assets === NO_ACCESS) {
    html += panelHTML("Assets", null, noAccessHTML("esi-assets.read_assets.v1"));
  } else {
    const locIds = [...new Set(assets.map(a => a.location_id))];
    await resolveNames(locIds.filter(id => id < 70000000)); // stations/systems résolubles directement
    const grouped = {};
    assets.forEach(a => {
      const key = a.location_id;
      grouped[key] = grouped[key] || [];
      grouped[key].push(a);
    });
    const typeIds = [...new Set(assets.map(a => a.type_id))];
    await Promise.all(typeIds.map(t => typeInfo(t)));

    html += panelHTML("Assets", `${assets.length} items / ${Object.keys(grouped).length} emplacements`, `
      <div class="scroll-y">
        ${Object.entries(grouped).slice(0, 50).map(([loc, items]) => `
          <div style="margin-bottom:10px;">
            <div class="mono" style="color:var(--amber);font-size:11px;margin-bottom:4px;">📍 ${cachedName(parseInt(loc)) || "Emplacement #" + loc} (${items.length} items)</div>
            <table><tbody>
              ${items.slice(0, 8).map(it => `<tr><td>${_typeCache.get(it.type_id)?.name ?? it.type_id}</td><td class="mono">x${it.quantity}</td></tr>`).join("")}
            </tbody></table>
            ${items.length > 8 ? `<div class="mono" style="color:var(--text-2);font-size:10px;">+ ${items.length - 8} autres…</div>` : ""}
          </div>
        `).join("")}
      </div>
    `);
  }

  // --- Contracts ---
  if (contracts === NO_ACCESS) {
    html += panelHTML("Contrats", null, noAccessHTML("esi-contracts.read_character_contracts.v1"));
  } else {
    html += panelHTML("Contrats", `${contracts.length}`, `
      <div class="scroll-y"><table><thead><tr><th>Type</th><th>Statut</th><th>Prix</th></tr></thead><tbody>
      ${contracts.slice(0, 20).map(c => `<tr><td>${c.type}</td><td><span class="badge ${c.status === "finished" ? "ok" : "warn"}">${c.status}</span></td><td class="mono">${isk(c.price)}</td></tr>`).join("")}
      </tbody></table></div>
    `);
  }

  // --- Industry ---
  if (industryJobs === NO_ACCESS) {
    html += panelHTML("Jobs d'industrie", null, noAccessHTML("esi-industry.read_character_jobs.v1"));
  } else {
    html += panelHTML("Jobs d'industrie", `${industryJobs.length}`, `
      <div class="scroll-y"><table><thead><tr><th>Activité</th><th>Statut</th><th>Fin</th></tr></thead><tbody>
      ${industryJobs.map(j => `<tr><td>${j.activity_id}</td><td><span class="badge info">${j.status}</span></td><td class="mono">${new Date(j.end_date).toLocaleString("fr-FR")}</td></tr>`).join("")}
      </tbody></table></div>
    `);
  }

  el.innerHTML = html;
}
function noAccessInline() { return `<span class="mono" style="color:var(--text-2)">n/a</span>`; }

// =====================================================================
// PAGE CORPORATION
// =====================================================================
async function renderCorpPage() {
  const el = document.getElementById("page-corp");
  el.innerHTML = loadingHTML();
  const { corpId, allianceId } = window.__ctx;

  const corpData = await esiFetch(`/corporations/${corpId}/`);

  const [members, structures, starbases, wallets, killmails, divisions, facilities, jobs, contracts] = await Promise.all([
    esiFetchAllPages(`/corporations/${corpId}/members/`, { needsAuth: true, requiredScope: "esi-corporations.read_corporation_membership.v1" }),
    esiFetch(`/corporations/${corpId}/structures/`, { needsAuth: true, requiredScope: "esi-corporations.read_structures.v1" }),
    esiFetch(`/corporations/${corpId}/starbases/`, { needsAuth: true, requiredScope: "esi-corporations.read_starbases.v1" }),
    esiFetch(`/corporations/${corpId}/wallets/`, { needsAuth: true, requiredScope: "esi-wallet.read_corporation_wallets.v1" }),
    esiFetchAllPages(`/corporations/${corpId}/killmails/recent/`, { needsAuth: true, requiredScope: "esi-killmails.read_corporation_killmails.v1" }),
    esiFetch(`/corporations/${corpId}/divisions/`, { needsAuth: true, requiredScope: "esi-corporations.read_divisions.v1" }),
    esiFetch(`/corporations/${corpId}/facilities/`, { needsAuth: true, requiredScope: "esi-corporations.read_facilities.v1" }),
    esiFetchAllPages(`/corporations/${corpId}/industry/jobs/`, { needsAuth: true, requiredScope: "esi-industry.read_corporation_jobs.v1" }),
    esiFetchAllPages(`/corporations/${corpId}/contracts/`, { needsAuth: true, requiredScope: "esi-contracts.read_corporation_contracts.v1" })
  ]);
  const corpAssets = await esiFetchAllPages(`/corporations/${corpId}/assets/`, { needsAuth: true, requiredScope: "esi-assets.read_corporation_assets.v1" });

  window.__ctx.corpStructures = (structures && structures !== NO_ACCESS) ? structures : [];

  let html = `<div class="grid-2">`;
  html += panelHTML("Identité corporation", null, `
    <div class="stat"><span class="k">Nom</span><span class="v">${corpData?.name ?? "—"} [${corpData?.ticker ?? ""}]</span></div>
    <div class="stat"><span class="k">Membres (déclarés)</span><span class="v">${corpData?.member_count ?? "—"}</span></div>
    <div class="stat"><span class="k">Taxe</span><span class="v">${corpData?.tax_rate ? (corpData.tax_rate * 100).toFixed(1) + "%" : "—"}</span></div>
    <div class="stat"><span class="k">Alliance</span><span class="v">${allianceId ? cachedName(allianceId) : "Aucune"}</span></div>
  `);

  if (members === NO_ACCESS) {
    html += panelHTML("Membres", null, noAccessHTML("esi-corporations.read_corporation_membership.v1"));
  } else {
    await resolveNames(members.slice(0, 200));
    html += panelHTML("Membres", `${members.length}`, `
      <div class="scroll-y"><table><tbody>
      ${members.slice(0, 100).map(id => `<tr><td>${cachedName(id)}</td></tr>`).join("")}
      </tbody></table></div>
    `);
  }
  html += `</div><div class="grid-2">`;

  // --- Structures / Citadelles ---
  if (structures === NO_ACCESS) {
    html += panelHTML("Structures (citadelles)", null, noAccessHTML("esi-corporations.read_structures.v1"));
  } else {
    const sysIds = structures.map(s => s.system_id);
    await resolveNames(sysIds);
    html += panelHTML("Structures (citadelles)", `${structures.length}`, `
      <div class="scroll-y"><table><thead><tr><th>Système</th><th>Type</th><th>État</th><th>Vulnérable</th></tr></thead><tbody>
      ${structures.map(s => `<tr>
        <td>${cachedName(s.system_id)}</td>
        <td class="mono">${s.type_id}</td>
        <td><span class="badge ${s.state === "shield_vulnerable" ? "danger" : "ok"}">${s.state}</span></td>
        <td class="mono">${s.vulnerability_occupancy_map ? "cf. fenêtre" : (s.next_reinforce_hour !== undefined ? s.next_reinforce_hour + "h" : "—")}</td>
      </tr>`).join("")}
      </tbody></table></div>
    `);
  }

  // --- Starbases / POS ---
  if (starbases === NO_ACCESS) {
    html += panelHTML("Starbases (POS)", null, noAccessHTML("esi-corporations.read_starbases.v1"));
  } else {
    const sysIds = starbases.map(s => s.system_id);
    await resolveNames(sysIds);
    html += panelHTML("Starbases (POS)", `${starbases.length}`, `
      <div class="scroll-y"><table><thead><tr><th>Système</th><th>État</th><th>Réassort carburant</th></tr></thead><tbody>
      ${starbases.map(s => `<tr><td>${cachedName(s.system_id)}</td><td><span class="badge ${s.state === "online" ? "ok" : "warn"}">${s.state}</span></td><td class="mono">${s.reinforce_hour ?? "—"}h</td></tr>`).join("")}
      </tbody></table></div>
    `);
  }
  html += `</div><div class="grid-2">`;

  // --- Wallets ---
  if (wallets === NO_ACCESS) {
    html += panelHTML("Portefeuilles corpo", null, noAccessHTML("esi-wallet.read_corporation_wallets.v1"));
  } else {
    html += panelHTML("Portefeuilles corpo (7 divisions)", null, `
      ${wallets.map(w => `<div class="stat"><span class="k">Division ${w.division}</span><span class="v pos">${isk(w.balance)}</span></div>`).join("")}
    `);
  }

  // --- Killmails ---
  if (killmails === NO_ACCESS) {
    html += panelHTML("Killmails récents", null, noAccessHTML("esi-killmails.read_corporation_killmails.v1"));
  } else {
    html += panelHTML("Killmails récents", `${killmails.length}`, `
      <div class="scroll-y"><table><thead><tr><th>Date</th><th>Killmail</th></tr></thead><tbody>
      ${killmails.slice(0, 30).map(k => `<tr><td class="mono">#${k.killmail_id}</td><td class="mono">${k.killmail_hash.slice(0, 12)}…</td></tr>`).join("")}
      </tbody></table></div>
    `);
  }
  html += `</div><div class="grid-2">`;

  // --- Assets corpo ---
  if (corpAssets === NO_ACCESS) {
    html += panelHTML("Assets corporation", null, noAccessHTML("esi-assets.read_corporation_assets.v1"));
  } else {
    const grouped = {};
    corpAssets.forEach(a => { grouped[a.location_id] = grouped[a.location_id] || []; grouped[a.location_id].push(a); });
    const typeIds = [...new Set(corpAssets.map(a => a.type_id))];
    await Promise.all(typeIds.map(t => typeInfo(t)));
    const capitalKeywords = ["Carrier", "Dreadnought", "Titan", "Supercarrier", "Force Auxiliary", "Freighter", "Jump Freighter"];
    const capitals = corpAssets.filter(a => {
      const t = _typeCache.get(a.type_id);
      return t && capitalKeywords.some(k => t.name.includes(k));
    });
    html += panelHTML("Assets corporation", `${corpAssets.length} items / ${Object.keys(grouped).length} lieux`, `
      <div class="stat"><span class="k">🚀 Capitaux détectés</span><span class="v ${capitals.length ? "neg" : ""}">${capitals.length}</span></div>
      ${capitals.length ? `<div class="scroll-y" style="margin:8px 0;"><table><tbody>
        ${capitals.slice(0, 20).map(c => `<tr><td>${_typeCache.get(c.type_id)?.name}</td><td class="mono">x${c.quantity}</td><td class="mono">loc #${c.location_id}</td></tr>`).join("")}
      </tbody></table></div>` : ""}
    `);
  }

  // --- Divisions / facilities / industry / contracts ---
  html += panelHTML("Divisions & installations", null, `
    ${divisions === NO_ACCESS ? noAccessHTML("esi-corporations.read_divisions.v1") : `<div class="stat"><span class="k">Divisions wallet</span><span class="v">${divisions.wallet?.length ?? 0}</span></div><div class="stat"><span class="k">Divisions hangar</span><span class="v">${divisions.hangar?.length ?? 0}</span></div>`}
    ${facilities === NO_ACCESS ? noAccessHTML("esi-corporations.read_facilities.v1") : `<div class="stat"><span class="k">Facilities</span><span class="v">${facilities.length}</span></div>`}
  `);
  html += `</div>`;

  el.innerHTML = html;
}

// =====================================================================
// PAGE ALLIANCE
// =====================================================================
async function renderAlliancePage() {
  const el = document.getElementById("page-alliance");
  el.innerHTML = loadingHTML();
  const { allianceId } = window.__ctx;

  const allianceData = await esiFetch(`/alliances/${allianceId}/`);
  const corpIds = await esiFetch(`/alliances/${allianceId}/corporations/`);
  const sov = await sovereigntyMap();

  let html = `<div class="grid-2">`;
  html += panelHTML("Identité alliance", null, `
    <div class="stat"><span class="k">Nom</span><span class="v">${allianceData?.name ?? "—"} [${allianceData?.ticker ?? ""}]</span></div>
    <div class="stat"><span class="k">Corp exécutive</span><span class="v">${allianceData?.executor_corporation_id ? cachedName(allianceData.executor_corporation_id) : "—"}</span></div>
    <div class="stat"><span class="k">Nb corporations membres</span><span class="v">${corpIds && corpIds !== NO_ACCESS ? corpIds.length : "—"}</span></div>
  `);

  if (corpIds && corpIds !== NO_ACCESS) {
    await resolveNames(corpIds);
    html += panelHTML("Corporations membres", `${corpIds.length}`, `
      <div class="scroll-y"><table><tbody>
      ${corpIds.slice(0, 100).map(id => `<tr><td>${cachedName(id)}</td></tr>`).join("")}
      </tbody></table></div>
    `);
  }
  html += `</div>`;

  // --- Systèmes tenus par l'alliance (souveraineté) ---
  const heldSystems = (sov && sov !== NO_ACCESS) ? sov.filter(s => s.alliance_id === allianceId) : [];
  await resolveNames(heldSystems.map(s => s.system_id));
  html += panelHTML("Systèmes sous souveraineté de l'alliance", `${heldSystems.length}`, `
    <div class="scroll-y"><table><thead><tr><th>Système</th><th>Corp propriétaire</th></tr></thead><tbody>
    ${heldSystems.map(s => `<tr><td>${cachedName(s.system_id)}</td><td class="mono">${s.corporation_id ?? "—"}</td></tr>`).join("")}
    </tbody></table></div>
  `);

  // --- Portée cyno depuis les structures corpo connues ---
  const structures = window.__ctx.corpStructures || [];
  if (!structures.length) {
    html += panelHTML("Portée cyno depuis les structures", null, `<div class="no-access">Aucune structure corpo accessible pour calculer la portée (nécessite la page Corporation avec le scope structures).</div>`);
  } else {
    html += panelHTML("Portée cyno depuis les structures corpo", null, `<div id="cyno-progress" class="loading">Calcul en cours (chargement des coordonnées de tous les systèmes)…</div><div id="cyno-results"></div>`);
  }

  el.innerHTML = html;

  if (structures.length) {
    await resolveNames(structures.map(s => s.system_id));
    const progressEl = document.getElementById("cyno-progress");
    await loadAllSystemCoords((done, total) => {
      if (progressEl) progressEl.textContent = `Chargement des systèmes… ${done}/${total}`;
    });
    if (progressEl) progressEl.remove();

    const resultsEl = document.getElementById("cyno-results");
    let cynoHtml = "";
    for (const struct of structures) {
      const { origin, systems } = await systemsInCynoRange(struct.system_id, CONFIG.CYNO_RANGE_LY, allianceId);
      if (!origin) continue;
      const allied = systems.filter(s => s.status === "allied");
      const hostile = systems.filter(s => s.status === "hostile");
      const neutral = systems.filter(s => s.status === "neutral");
      cynoHtml += `
        <div style="margin-bottom:18px;">
          <div class="mono" style="color:var(--amber);font-size:12px;margin-bottom:8px;">📡 Depuis ${cachedName(struct.system_id)} — ${systems.length} système(s) à ≤${CONFIG.CYNO_RANGE_LY} AL</div>
          <div class="grid" style="grid-template-columns:1fr 1fr 1fr;">
            <div>
              <div class="mono" style="font-size:10px;color:var(--green);margin-bottom:4px;">ALLIÉS (${allied.length})</div>
              <div class="scroll-y" style="max-height:160px;">${allied.map(s => `<div style="font-size:11.5px;padding:3px 0;">${s.name} <span class="mono" style="color:var(--text-2)">${s.distance.toFixed(2)} AL</span></div>`).join("") || `<span class="mono" style="color:var(--text-2);font-size:11px;">Aucun</span>`}</div>
            </div>
            <div>
              <div class="mono" style="font-size:10px;color:var(--red);margin-bottom:4px;">HOSTILES (${hostile.length})</div>
              <div class="scroll-y" style="max-height:160px;">${hostile.map(s => `<div style="font-size:11.5px;padding:3px 0;"><span class="badge hostile" style="margin-right:4px;">SOV</span>${s.name} <span class="mono" style="color:var(--text-2)">${s.distance.toFixed(2)} AL</span></div>`).join("") || `<span class="mono" style="color:var(--text-2);font-size:11px;">Aucun</span>`}</div>
            </div>
            <div>
              <div class="mono" style="font-size:10px;color:var(--cyan);margin-bottom:4px;">NON-ALLIÉS / NEUTRES (${neutral.length})</div>
              <div class="scroll-y" style="max-height:160px;">${neutral.map(s => `<div style="font-size:11.5px;padding:3px 0;">${s.name} <span class="mono" style="color:var(--text-2)">${s.distance.toFixed(2)} AL / sec ${s.security_status.toFixed(1)}</span></div>`).join("") || `<span class="mono" style="color:var(--text-2);font-size:11px;">Aucun</span>`}</div>
            </div>
          </div>
        </div>`;
    }
    if (resultsEl) resultsEl.innerHTML = cynoHtml;
  }
}

// =====================================================================
// Tabs
// =====================================================================
function switchTab(tab) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + tab));
}
