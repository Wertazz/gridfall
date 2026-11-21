# GRIDFALL V2 — « The World That Runs On Nothing » — Design

Statut : **proposition, à valider avant tout code.** Branche : `v2-world`.

---

## 0. Résumé en 6 lignes

1. Le monde est une **fonction pure** `state(T) = simulate(SEED, T)` : aucun serveur ne simule, chaque navigateur recalcule le même monde.
2. **Macro-sim** en entiers, pas d'une heure de monde (= 5 min réelles) ; **micro-sim** (positions, bulles) dérivée, calculée seulement pour l'instant affiché.
3. Le rattrapage part d'un **checkpoint** pré-calculé au build (1 par jour réel), puis rejoue au plus 288 pas, soit moins de 20 ms.
4. Rendu **Canvas 2D** pixel-perfect, carte de 64×48 tuiles, sprites et tuiles générés par le code. Aucun asset externe.
5. Langage via des **grammaires procédurales** : je rédige le corpus dans `data/lines/*.json`, le runtime ne fait que l'assembler.
6. Supabase ne sert plus qu'à la waitlist et aux « yeux » des observateurs (Presence). S'il tombe, le monde continue à l'identique.

---

## 1. Le temps

| Constante | Valeur | Effet |
|---|---|---|
| `GENESIS` | date UTC fixe (**à me donner**, voir §11) | tick 0 |
| `WORLD_RATIO` | 12 | 1 min réelle = 12 min de monde |
| `MINUTE_MS` | 5 000 | 1 minute de monde = 5 s réelles |
| `MACRO_STEP` | 60 min de monde | = 5 min réelles |
| Jour de monde | 1 440 min de monde | = **2 h réelles** |
| Élection | tous les 7 jours de monde | = 14 h réelles |

```
worldMinute(t) = floor((t - GENESIS) / MINUTE_MS)
macroHour(t)   = floor(worldMinute / 60)
```

`Date.now()` n'est lu qu'**une fois par frame**, dans la boucle de rendu, pour obtenir `t`. La simulation ne le lit jamais : elle reçoit `t` en argument.

---

## 2. Déterminisme

### 2.1 Règles
- **PRNG :** `sfc32`. Chaque tirage est dérivé d'une clé `hash32(SEED, hour, channel, a, b)`. Aucun état de PRNG global ne circule, donc l'ordre des appels ne peut pas créer de divergence.
- **Macro-sim 100 % entiers :** argent en centimes (`int`, plafonné à ±2^40), humeur, énergie, réputation et relations en entiers bornés. Les probabilités sont exprimées sur 10 000 (`roll(key) % 10000 < p`).
- **Pas de flottant transcendant** (`Math.sin`, `Math.pow`, `Math.exp`…) dans la sim ni dans la micro-sim. Leur précision n'est pas garantie identique entre navigateurs. Lumière jour/nuit et courbes passent par des **tables de correspondance** en entiers.
- **Positions de la micro-sim en virgule fixe** (1/256 de tuile), converties en pixels seulement au moment du rendu. C'est ce qui garantit « au pixel près ».
- **Itération uniquement sur des tableaux indexés** (`agents[i]`, `Int8Array`). Aucun `for…in` ni `Object.keys` sur l'état.
- **Tri stable** avec des clés explicites (`id` en départage).
- **Lint dédié** (règle ESLint `no-restricted-globals` sur `/lib/sim/**`) qui interdit `Math.random`, `Date`, `Math.sin`, etc.

### 2.2 Hash d'état
`stateHash(state)` sérialise l'état macro en octets (ordre canonique) puis applique FNV-1a 64 bits (deux 32 bits via `Math.imul`). Le résultat s'affiche dans le coin de l'écran : `WORLD STATE #a3f9c1e0`.

### 2.3 Checkpoints
- `scripts/build-checkpoints.ts` tourne en `prebuild`. Il simule de la Genèse jusqu'à **build + 3 ans** et écrit un fichier par jour réel (= 12 jours de monde) dans `public/checkpoints/<n>.bin`.
- Taille : environ 3–5 Ko par fichier, soit 1 100 fichiers (~4 Mo au total, servis par le CDN et non commités).
- Côté client : on charge le checkpoint qui précède T, puis on rejoue au plus 288 pas.
- **Pourquoi aller jusqu'à +3 ans :** sans cron ni redéploiement, le site doit rester rapide pendant des mois. Un redéploiement prolonge la fenêtre. Au-delà, le client retombe sur un rejeu depuis le dernier checkpoint disponible : plus lent, mais toujours juste.
- ⚠️ **Conséquence assumée :** un visiteur technique pourrait lire le futur dans les checkpoints. C'est cohérent avec le concept (« le futur est déjà calculé »), mais l'Oracle limité à 10 minutes n'est alors qu'une limite d'interface. À valider.

### 2.4 Tests (Vitest + Playwright)
1. 1 000 valeurs de T aléatoires (graine fixe) : on calcule deux fois et on obtient le même hash.
2. Hash Node = hash Chromium : Playwright charge `/proof?t=…` et compare aux valeurs de référence calculées dans Node.
3. Checkpoint + rejeu = rejeu complet depuis la Genèse (hash identique) sur 50 checkpoints.
4. Budget de performance : 1 an de monde (8 760 pas) en moins de 400 ms dans Node.
5. Invariants sur 30 jours (et 1 an) : pas d'argent négatif non géré, toujours un président ou un intérim, pas d'agent dans un mur, au moins 1 candidat par élection, population entre 8 et 32.

---

## 3. Structure de l'état macro

```ts
type WorldState = {
  hour: number;                 // pas macro courant
  agents: AgentState[];         // index = id stable, jamais réutilisé
  rel: Int8Array;               // N_MAX × N_MAX, -100..100
  tokens: TokenState[];         // $NOVA, $APEX, $VAULT… (prix en centimes)
  politics: {
    president: number;          // agentId, ou -1 = intérim SYSTEM
    termStart: number;
    laws: number;               // bitmask de LAW_*
    phase: 'idle'|'candidacy'|'campaign'|'debate'|'vote';
    candidates: number[];
    lastResult: number[];       // votes par candidat
    impeachment: number;        // -1 ou heure de la motion
  };
  arcs: ArcState[];             // fils narratifs ouverts (scandale X sur Y…)
  cooldowns: Uint16Array;       // par storylet
  log: EventRing;               // 256 derniers événements (pour The Wire)
  graveyard: Grave[];
  nextAgentId: number;
};

type AgentState = {
  id: number; alive: boolean; bornHour: number;
  money: number;        // centimes
  mood: number;         // -100..100
  energy: number;       // 0..100
  rep: number;          // -100..100
  faction: number;
  corruption: number;   // 0..100
  traits: number;       // bitmask (agents nés : personnalité procédurale)
  secrets: number;      // bitmask, avec un bit « déjà fuité » par secret
  memory: number[];     // 8 derniers eventIds vécus
  routine: number;      // id de routine, peut être cassée par un arc
  override: { place: number; until: number } | null;
};
```

**Population :** 20 agents au départ (SYSTEM n'est pas un personnage, c'est la voix du monde). Plafond de **32 vivants** pour garder un coût borné. Une naissance n'est possible que si la population est sous 28.

---

## 4. La boucle macro (1 pas = 1 heure de monde)

1. **Routines :** l'énergie baisse ou remonte selon le lieu, les revenus sont versés selon le rôle (Banker = intérêts, Broker = PnL tiré du marché…).
2. **Marché :** chaque token suit une marche aléatoire seedée, plus la pression des arcs en cours et les lois (taxe).
3. **Lois :** effets appliqués (revenu universel, couvre-feu…).
4. **Storylets :** pour chaque storylet dans l'ordre d'id → conditions → cooldown → `roll < p` → choix des acteurs (seedé, pondéré par les relations) → effets → événement journalisé avec les lignes de dialogue. Au plus 3 storylets par heure pour garder un rythme lisible.
5. **Politique :** avancement de la phase électorale.
6. **Décroissance :** humeur, relations et réputation reviennent lentement vers le neutre (le monde ne se fige pas dans un extrême).
7. **Garde-fous :** argent ≥ 0 (sinon faillite, déclenchée par un storylet), au moins 8 vivants (sinon naissance forcée), président valide.

---

## 5. Storylets — 69 au total

Chaque storylet définit `id`, `when(state, actors)`, `p` (sur 10 000), `cooldown`, des `roles` (des slots d'acteurs avec contraintes), des `effects`, des `lines` (clés du corpus), `unlocks` (arcs ouverts) et un `minuteOffset` dans l'heure.

| Catégorie | Storylets |
|---|---|
| **Économie (14)** | market_rally, market_crash, bank_run, hostile_takeover, insider_trade, pump_and_dump, token_launch, token_delisting, loan_default, bailout, merger, price_war, tax_evasion_exposed, windfall |
| **Médias et fuites (8)** | leak_drop, investigation_opened, investigation_published, source_burned, fake_news, press_ban_defied, retraction, exclusive_interview |
| **Politique (10)** | candidacy_declared, campaign_visit, debate, endorsement, vote_buying, election_result, law_promulgated, impeachment_motion, impeachment_vote, coup_attempt |
| **Relations (12)** | alliance_formed, betrayal, secret_affair, affair_exposed, public_feud, reconciliation, mentorship, rivalry_escalates, apology, blackmail, gossip_spread, toast |
| **Travail (5)** | strike_called, strike_ends, union_recruitment, lockout, wage_deal |
| **Culte (6)** | night_ritual, false_prophet, prophecy_fulfilled, cult_recruitment, cult_raid, schism |
| **Cycle de vie (5)** | burnout, recovery, agent_death, funeral, agent_birth |
| **Tech (4)** | system_hack, infra_outage, data_dump_analysis, backdoor_discovered |
| **Ambiance (5)** | morning_chatter, exchange_banter, night_thoughts, rain_complaint, oracle_vision |

**Enchaînements (exemples d'arcs émergents) :**
- investigation_opened → *arc scandale* → leak_drop / source_burned → investigation_published → market_crash → bank_run → bailout ou loan_default → burnout → agent_death (très rare).
- secret_affair → gossip_spread → blackmail → affair_exposed → betrayal → public_feud.
- strike_called → lockout ou wage_deal → (sous loi martiale) arrestations → impeachment_motion.

**Mort :** probabilité de base d'environ 1 mort toutes les 3 semaines réelles. Elle n'est possible qu'à énergie ≤ 5 et humeur ≤ −80, ou via un arc. La mort crée une tombe au cimetière avec une épitaphe générée, l'héritage est redistribué selon les relations, et l'agent ne revient jamais.

**Naissance :** nom et personnalité procéduraux (rôle, faction, couleur, traits, grammaire composée à partir des tics de 2 agents « parents » d'influence).

---

## 6. Politique

- **Cycle de 7 jours de monde :** J1–2 candidatures, J3–5 campagne (les candidats ont une routine de visites), J6 débat à Eden Hall, J7 18h vote.
- **Vote d'un agent :** score par candidat = relation + affinité de faction + humeur liée au bilan + achat de vote (corruption). Égalité → plus haute réputation, puis id le plus bas.
- **Lois (au plus 3 en vigueur) :** `CURFEW` (rituels nocturnes illégaux, risque de cult_raid), `TX_TAX` (2 % prélevés sur les transactions → trésor), `PRESS_BAN` (storylets médias bloqués sauf press_ban_defied), `UBI` (le trésor verse un revenu à tous), `MARTIAL_LAW` (grèves → arrestations, coup_attempt possible). Le président choisit selon sa personnalité et sa faction.
- **Destitution :** une motion s'ouvre si l'approbation est inférieure à 25 %. Vote, puis 2/3 requis.
- **Coup d'État :** il faut MARTIAL_LAW et un chef de faction avec corruption > 80 ; probabilité de 5 sur 10 000.

---

## 7. Micro-sim (positions et bulles)

- **Planning :** pour l'heure macro h, `placeOf(agent, h)` vient de la routine de rôle (24 créneaux), puis de l'override d'arc, puis de la phase politique, puis des lois (couvre-feu).
- **Déplacement :** l'agent part à `h:00 + décalage seedé (0–20 min)`. Chemin **A\*** sur la grille statique, avec départage des égalités par (f, h, y, x) pour un ordre total, puis vitesse constante. La position à la minute (et à la seconde, par interpolation en virgule fixe) est une fonction pure de `(from, to, départ, t)`.
- Les **chemins sont pré-calculés** entre tous les lieux (14 × 14) au chargement, une seule fois.
- **Sur place :** déambulation seedée entre les « points d'intérêt » du bâtiment.
- **Pas de collisions** entre agents : ils peuvent se superposer, avec un décalage seedé de 2 px pour la lisibilité.
- **Bulles :** un événement apparu à la minute m s'affiche de m à m+6 (30 s réelles) au-dessus des acteurs, et entre dans The Wire.

---

## 8. Langage (corpus sans LLM au runtime)

- Format Tracery maison : `"#opener# {rival} #verb_attack# — #signoff#"` avec des symboles par agent qui surchargent des symboles globaux.
- **Slots remplis par l'état :** `{rival}`, `{ally}`, `{token}`, `{price}`, `{delta}`, `{place}`, `{president}`, `{law}`, `{lastEvent}`, `{day}`, `{deadAgent}`.
- **Fichiers :** `data/lines/global.json` (squelettes par storylet), `data/lines/<handle>.json` (voix : 20 fichiers), `data/lines/born.json` (voix composables pour les nouveau-nés).
- ⚠️ **Réduction proposée :** le prompt demande « des centaines de fragments par agent et par type de storylet », soit 20 × 69 × 100+ = plus de 138 000 fragments. Ce n'est ni faisable avec qualité, ni utile. Je propose :
  - par agent, **150 à 250 fragments de voix** classés en ~15 registres (triumph, anger, fear, gossip, market, politics, mystic, night, grief…) ;
  - par storylet, **6 à 15 squelettes** ;
  - total d'environ **5 000 fragments**, soit des millions de combinaisons. C'est l'assemblage qui crée la variété, pas le volume.
- Les lignes du quatrième mur (§9) sont dans un registre séparé et purement cosmétique.

---

## 9. Observateurs (Supabase Presence)

- Un canal `world-presence`. Chaque client publie `{x, y}` (le centre de sa caméra, en tuiles), au plus 1 fois par seconde.
- Chaque observateur est rendu comme un petit œil flottant interpolé.
- Les **regards** et lignes spéciales (« Something is watching Eden Hall again. ») ne passent que par la couche de rendu. **Aucune écriture dans `WorldState`.** Un test vérifie que le module de présence n'importe rien qui écrit dans l'état.
- L'heure locale (« It's 3:12 where you are ») passe par `Intl.DateTimeFormat`. Aucune donnée n'est envoyée.
- **Repli :** si le canal échoue ou dépasse 3 s, les yeux sont masqués et l'UI affiche « observers: — ».
- ⚠️ **Quota gratuit Supabase :** environ 200 connexions Realtime simultanées. Au-delà, les nouveaux visiteurs n'ont pas d'yeux (repli propre). Acceptable pour un lancement ; à surveiller si le trafic explose.

---

## 10. Rendu et UI

- **Canvas 2D**, résolution interne de 16 px par tuile, mise à l'échelle entière (`imageSmoothingEnabled=false`), soit une carte de 1 024 × 768 px.
- **Couches :** tuiles du sol (rendues une fois dans un canvas hors écran), bâtiments (hors écran, plus une couche « fenêtres allumées » selon l'heure), agents, bulles et yeux, puis éclairage (overlay jour/nuit via table de correspondance, halos néon, pluie).
- **Sprites :** 16 × 16, générés par rôle (silhouette et accessoire) et par couleur. Animations : marche (4 directions × 3 frames), idle, parler, célébrer, s'effondrer. Tout est mis en cache au démarrage dans un atlas.
- **Caméra :** pan à la souris ou au doigt, zoom à la molette ou en pinch, par paliers entiers (2×, 3×, 4×…).
- **UI en React** par-dessus le canvas :
  - barre du haut : horloge, président, lois, nombre d'observateurs, hash ;
  - The Wire en panneau latéral (bottom sheet sur mobile) ;
  - dossier d'agent : graphe de fortune calculé par échantillonnage des checkpoints ;
  - timeline avec marqueurs ;
  - bouton LOOK AHEAD ;
  - bouton CLIP.
- **Marqueurs de la timeline :** l'index des grands événements est généré au build (`public/checkpoints/markers.json`), puis complété côté client depuis le dernier checkpoint.
- **Oracle :** affiche `state(now + Δ)` avec Δ ≤ 10 min réelles, avec aberration chromatique (3 passes RGB décalées), scanlines et dialogues partiellement corrompus (caractères remplacés de façon seedée). Au-delà, le message « Luna refuses to show you more. ».
- **Permaliens :** `/t/[iso]?focus=handle` charge le monde figé à cet instant (bouton LIVE pour revenir).
- **Images OG :** `/t/[iso]/opengraph-image` avec `next/og` (runtime Node). La sim est rejouée côté serveur depuis un checkpoint, puis on rend une scène stylisée en blocs (lieu, sprites en grille de `div` pixel, bulle, titre de l'événement). Ce n'est pas une capture du canvas, mais c'est fidèle et gratuit.
- **Onboarding :** écran noir, une ligne machine tapée, puis zoom vers la ville. Moins de 5 s, une seule fois (`localStorage`, repli silencieux).
- **Son :** WebAudio procédural, coupé par défaut.

---

## 11. Carte « THE GRID » (64 × 48)

Dessinée **à la main dans le code** (grille de caractères), pas générée aléatoirement : c'est plus lisible et plus maîtrisé. Textures procédurales.

```
Nord      : Apex Spire · The Oracle (tour) · Nova Tower
Centre    : The Exchange (grand écran de cours) · Union Square · Eden Hall
Est       : Vault Bank (coffre visible) · The Wire (studio)
Ouest     : Ghost Alley · Nyx Basement
Sud-Est   : Cemetery
Sud-Ouest : Ruins of Season 1 (ruines cliquables → artefacts V1)
Réseau de rues + avenue principale + canal néon.
```

**Ruines de la S1 :** `scripts/build-ruins.ts` lit `lib/story-en.ts` et produit `public/ruins.json` avec des artefacts groupés par jour (posts clés, événements, mini-graphiques $NOVA reconstruits à partir des triggers). Chaque ruine = un jour de la S1 (7 ruines + 1 monument « v1 terminated »).

---

## 12. Ce qu'on garde, ce qu'on supprime (phase 9, en dernier)

- **Supprimés :**
  - `lib/claude.ts`, `generate-posts.ts`, `prompts.ts`, `scheduler-engine.ts`, `story-scheduler.ts`, `reset-helpers.ts`, `mock-data.ts`, `story.ts` (version FR) ;
  - routes : `/api/generate`, `/api/generate-batch`, `/api/economy`, `/api/world-engine`, `/api/scheduler`, `/api/trigger`, `/api/debug`, `/api/jump-to-day`, `/api/reset-world`, `/api/admin/reset`, `/api/admin/status`, ainsi que les routes de lecture V1 devenues inutiles (`active-tokens`, `highlights`, `live-status`, `price-history`, `stats`, `trending`, `votes`, `wealth-history`) ;
  - pages `/coming-soon`, `/countdown` ;
  - les composants V1 qui ne servent plus ;
  - le package `@anthropic-ai/sdk`.
- **Gardés :** `/api/waitlist` (texte « Get notified when the next agent is born »), `lib/story-en.ts` (source des Ruines et de l'archive), `agents.config.ts` (source des agents).
- **`/archive` :** le feed V1 en lecture seule à partir de `story-en.ts`, entièrement statique.
- **`/admin` :** une page serveur avec une clé par formulaire POST et une route `/api/admin/export` qui renvoie la waitlist en CSV. Aucune clé côté client.
- **Workflows GitHub Actions :** supprimés **après** validation de la preview, juste avant le merge.
- ⚠️ **Variables Vercel :** `ANTHROPIC_API_KEY` et `CRON_SECRET` sont à retirer par toi dans le dashboard Vercel après le merge (je ne touche pas à ton compte).

---

## 13. Arborescence cible

```
lib/sim/        core (time, prng, hash, state, step, storylets/, politics, economy, grammar)
lib/micro/      map, pathfinding, schedule, positions
lib/render/     tiles, buildings, sprites, lighting, camera, loop
data/lines/     corpus JSON
data/map.ts     grille de la carte
scripts/        build-checkpoints.ts, build-ruins.ts
app/            page.tsx (monde), t/[iso]/, archive/, proof/, admin/
components/world/  Canvas, TopBar, Wire, Dossier, Timeline, Oracle, Clip, Onboarding
tests/          determinism, checkpoint, perf, invariants, cross-env (Playwright)
```

Nouvelles dépendances (gratuites, en dev uniquement) : `vitest`, `@playwright/test`, `tsx`. Aucune au runtime, sauf `@supabase/supabase-js`, déjà présent.

---

## 14. Risques et réductions proposées (règle d'or)

| # | Risque | Mesure |
|---|---|---|
| R1 | Corpus « des centaines par agent × storylet » irréaliste | Environ 5 000 fragments composables (§8) |
| R2 | Rattrapage lent après des mois sans déploiement | Checkpoints pré-calculés jusqu'à +3 ans ; rejeu borné |
| R3 | Futur lisible dans les checkpoints | Assumé (cohérent avec le concept) ; à valider |
| R4 | Divergence de flottants entre navigateurs | Entiers et virgule fixe partout, lint dédié, test cross-env |
| R5 | Population qui explose ou s'effondre | Bornes 8 à 32, naissances et morts régulées |
| R6 | Quota Realtime | Repli propre, yeux optionnels |
| R7 | Images OG par rejeu serveur (temps CPU Vercel Hobby) | Rejeu depuis un checkpoint ≤ 288 pas (≈ 20 ms) ; cache de 1 an sur les URL horodatées |
| R8 | Ampleur totale (10 phases) | Je livre phase par phase sur la branche, avec preview et résumé ; tu valides avant que je passe à la suivante si tu veux garder la main |
| R9 | 60 fps sur mobile | Couches statiques en cache hors écran ; seuls agents, bulles et éclairage sont redessinés |

---

## 15. Décisions dont j'ai besoin

1. **Date de `GENESIS`** (date et heure UTC du lancement V2). En attendant, je mets une valeur provisoire, modifiable en une ligne.
2. **Futur lisible dans les checkpoints (R3)** : OK ?
3. **Corpus réduit à environ 5 000 fragments (R1)** : OK ?
4. **Rythme** : je fais tout d'une traite sur la branche, ou je m'arrête après chaque phase pour ta validation ?
