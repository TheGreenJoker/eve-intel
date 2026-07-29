# ESI Intel — outil perso d'analyse EVE Online

Site statique (GitHub Pages compatible) pour consulter en détail les infos ESI
accessibles à **ton propre personnage** (ou un alt que tu contrôles) : perso,
corporation, alliance. Assets, wallets, structures, killmails, industrie,
portée cyno, etc. Les sections pour lesquelles le token n'a pas la
permission/le scope sont automatiquement masquées avec un message clair,
plutôt que de planter.

## ⚠️ Important avant de déployer

Ce site garde `CLIENT_ID` / `CLIENT_SECRET` en clair dans `js/config.js`,
visible par quiconque ouvre les outils de dev du navigateur ou lit le repo.
C'est acceptable seulement si :
- le repo GitHub est **privé**, ou
- tu acceptes ce risque pour un usage strictement personnel.

Ne mets jamais ce repo en public si tu veux garder le secret confidentiel.

## 1. Créer l'application ESI

1. Va sur https://developers.eveonline.com/applications → **Create New Application**
2. Type : **Authentication & API Access**
3. Callback URL : l'URL exacte de ta page `callback.html` une fois déployée,
   par exemple :
   `https://TON_USER.github.io/TON_REPO/callback.html`
   (doit correspondre EXACTEMENT, sans slash final en trop)
4. Coche les scopes listés dans `js/config.js` (ou "select all" si tu préfères)
5. Récupère le **Client ID** et le **Secret Key**

## 2. Configurer `js/config.js`

```js
CLIENT_ID: "ton_client_id",
CLIENT_SECRET: "ton_secret", // optionnel, sert pour le refresh token
ACCESS_PASSWORD: "un_mot_de_passe_a_toi",
CYNO_RANGE_LY: 7.99,
```

`REDIRECT_URI` se calcule automatiquement à partir de l'URL du site — pas
besoin d'y toucher si `callback.html` est à la racine du site.

## 3. Déployer sur GitHub Pages

```bash
git init
git add .
git commit -m "ESI Intel"
git branch -M main
git remote add origin https://github.com/TON_USER/TON_REPO.git
git push -u origin main
```

Puis dans **Settings → Pages** du repo, active GitHub Pages sur la branche
`main` (dossier racine). L'URL générée doit correspondre exactement à ce que
tu as mis comme Callback URL sur developers.eveonline.com.

## 4. Utilisation

1. Ouvre le site → entre ton mot de passe local (`ACCESS_PASSWORD`)
2. Clique sur **Se connecter avec EVE Online** → connecte-toi avec le
   personnage dont tu veux analyser les données
3. Le token (access + refresh) est stocké uniquement dans le
   `localStorage` de ton navigateur — jamais envoyé ailleurs qu'à ESI/SSO
4. Navigue entre les 3 onglets : **Personnage / Corporation / Alliance**

## Ce que ça affiche (selon les scopes réellement accordés au perso connecté)

- **Personnage** : identité, localisation, vaisseau actuel, compétences,
  portefeuille + historique, assets groupés par emplacement, clones/implants,
  contrats, jobs d'industrie, notifications
- **Corporation** : membres, structures (citadelles) avec état/vulnérabilité,
  starbases (POS), 7 divisions de wallet, assets (avec détection des
  capitaux : Dreadnought/Carrier/Titan/etc.), killmails récents, divisions,
  facilities
- **Alliance** : corporations membres, systèmes sous souveraineté de
  l'alliance, et pour chaque structure corpo accessible : la liste des
  systèmes dans un rayon de portée cyno (`CYNO_RANGE_LY`), classés
  **alliés** / **hostiles** (sous sov ennemie) / **neutres**

## Limites connues

- Le calcul de portée cyno télécharge les coordonnées de ~8000 systèmes au
  premier chargement de la page Alliance (mis en cache ensuite en mémoire,
  le temps de la session).
- Certains endpoints ESI nécessitent des rôles corp spécifiques (ex:
  `Director` pour `/structures/`) — sans ce rôle, la section s'affiche
  comme non accessible même si le scope OAuth a été accordé.
- Le mot de passe local n'est qu'un filtre basique côté client, pas une
  vraie sécurité si le site est exposé publiquement.
# eve-intel
