// =====================================================================
// CONFIGURATION — à éditer avant de déployer sur GitHub Pages
// =====================================================================
// ATTENTION : ce fichier est en clair dans le repo/site. N'importe qui
// visitant le site (ou lisant le code source) peut voir CLIENT_ID et
// CLIENT_SECRET. Ce n'est acceptable QUE si :
//  - c'est un repo privé, ou
//  - tu acceptes le risque pour un usage strictement personnel.
// Ne mets jamais ce genre de secret dans un repo public si tu tiens à
// ce qu'il reste secret.
// =====================================================================

const CONFIG = {
  // Créés sur https://developers.eveonline.com/applications
  CLIENT_ID: "fb9e88b753ff4e868fec1ef71254091b",
  CLIENT_SECRET: "eat_2XVoALvVbWw9kWdc1esRMO3VTBJmQMA6h_67tdi", // optionnel avec PKCE, gardé pour le refresh

  // Doit correspondre EXACTEMENT à l'URL "Callback" enregistrée sur
  // developers.eveonline.com (ex: https://tonuser.github.io/eve-espionage/callback.html)
  REDIRECT_URI: window.location.origin + window.location.pathname.replace(/index\.html$/, "").replace(/\/$/, "") + "/callback.html",

  // Mot de passe local demandé avant de pouvoir consulter le dashboard.
  // Stocké en clair ici (c'est un site statique) — change-le.
  // Simple protection contre un accès occasionnel, pas une vraie sécurité.
  ACCESS_PASSWORD: "azertyuiop",

  // Portée de la recherche cyno (années-lumière). ~7.19 LY = cyno standard,
  // ~7.99 LY avec Black Ops / cyno beacon selon le contexte.
  CYNO_RANGE_LY: 7.99,

  // Scopes demandés au moment du login. Demande tout ce qui peut être utile ;
  // les sections correspondantes s'afficheront seulement si le perso a
  // effectivement les rôles/permissions nécessaires côté ESI.
  SCOPES: [
    "publicData",
    "esi-location.read_location.v1",
    "esi-location.read_ship_type.v1",
    "esi-location.read_online.v1",
    "esi-skills.read_skills.v1",
    "esi-skills.read_skillqueue.v1",
    "esi-wallet.read_character_wallet.v1",
    "esi-wallet.read_corporation_wallets.v1",
    "esi-assets.read_assets.v1",
    "esi-assets.read_corporation_assets.v1",
    "esi-characters.read_notifications.v1",
    "esi-characters.read_standings.v1",
    "esi-characters.read_contacts.v1",
    "esi-corporations.read_corporation_membership.v1",
    "esi-corporations.read_structures.v1",
    "esi-corporations.read_starbases.v1",
    "esi-corporations.read_divisions.v1",
    "esi-corporations.read_facilities.v1",
    "esi-corporations.read_contacts.v1",
    "esi-corporations.read_titles.v1",
    "esi-corporations.track_members.v1",
    "esi-killmails.read_killmails.v1",
    "esi-killmails.read_corporation_killmails.v1",
    "esi-alliances.read_contacts.v1",
    "esi-industry.read_character_jobs.v1",
    "esi-industry.read_corporation_jobs.v1",
    "esi-planets.read_customs_offices.v1",
    "esi-contracts.read_character_contracts.v1",
    "esi-contracts.read_corporation_contracts.v1",
    "esi-markets.read_character_orders.v1",
    "esi-markets.read_corporation_orders.v1",
    "esi-fleets.read_fleet.v1",
    "esi-fittings.read_fittings.v1",
    "esi-clones.read_clones.v1",
    "esi-clones.read_implants.v1"
  ].join(" ")
};
