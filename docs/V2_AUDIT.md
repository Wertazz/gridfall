# GRIDFALL V2 — Audit final (phase 10)

Branche `v2-world`. Rien n'a été fusionné sur `main`. La prod (gridfall.xyz) n'a pas changé.

## 1. Déterminisme ✅

| Contrôle | Résultat |
|---|---|
| 1 000 valeurs de T aléatoires sur un an de monde, calculées deux fois | hashes identiques (`tests/determinism.test.ts`) |
| Checkpoint + rejeu = rejeu complet depuis la Genèse | identique sur 4 checkpoints testés, dont un à 30 jours réels |
| Sérialisation / désérialisation | aller-retour exact, et le pas suivant reste identique |
| Node vs Chromium (Playwright) | même hash à H-2, H-30, H-150 et sur `/proof` maintenant (`e2e/cross-env.spec.ts`) |
| Deux navigateurs ouverts en même temps | même `WORLD STATE` affiché, 2 observateurs détectés |
| Positions des agents (micro-sim) | identiques sur 2 rejeux, testées sur 3 jours de monde à raison d'un point toutes les 2 minutes |
| Garde-fous | ESLint interdit `Math.random`, `Date`, `sin`/`cos`/`exp`/`log`/`pow`/`sqrt` et `for…in` dans `lib/sim` et `lib/micro` ; empreinte de version qui fait ignorer les checkpoints d'une autre version de la sim |

## 2. Performance ✅

| Mesure (build de prod, Playwright) | Desktop 1440×900 | iPhone 14, CPU ralenti 4× |
|---|---|---|
| Monde visible après | 0,53 – 0,80 s | 1,21 – 1,25 s (2,2 s au premier passage à froid) |
| Images par seconde | 60 | 36 – 38 |
| 1 an de monde (Node) | ≈ 0,4 s | — |
| Rattrapage maximal depuis un checkpoint (288 pas) | < 20 ms | — |

Optimisations apportées pendant l'audit : résolution du canvas plafonnée à 2×, et mise en cache des profils, du bavardage et du découpage du texte des bulles. Le téléphone est passé de 20 à 37 images/s.

## 3. Mobile ✅

Captures iPhone 14 vérifiées à chaque phase : carte plein écran, The Wire et fiche d'agent en panneaux glissants du bas, timeline toujours visible, pan / zoom à deux doigts / tap. Corrigé en route : débordement de la barre du haut en mode passé / futur.

## 4. Accessibilité de base ✅ (avec réserves)

- Canvas avec `role="img"` et `aria-label`.
- Tous les boutons-icônes étiquetés.
- Timeline utilisable au clavier (flèches gauche / droite) ; la touche Échap ferme les panneaux.
- Mode Oracle sans tremblement si `prefers-reduced-motion`.
- **Réserves :**
  - certains textes secondaires (`#4b5563` sur fond noir) sont sous le contraste AA ;
  - la ville elle-même n'est pas lisible par un lecteur d'écran (The Wire en donne l'équivalent textuel).

## 5. Textes 100 % anglais ✅

Tout le site public est en anglais. J'ai traduit les 4 derniers titres et descriptions français de `lib/story-en.ts`, et supprimé la V1 française (`lib/story.ts`). La recherche de caractères accentués français dans le code livré ne donne aucun résultat. Aucun « I built », ni aucune mention d'un créateur (j'ai reformulé une réplique d'agent).

## 6. Secrets côté client ✅

- Les bundles `.next/static` ne contiennent ni clé service, ni `ADMIN_KEY`, ni clé Anthropic.
- `/admin` envoie un formulaire POST vers `/api/admin/export`, qui compare la clé côté serveur en temps constant. Aucune clé n'est envoyée au navigateur.
- Seules l'URL Supabase et la clé anon (publiques par conception) sont exposées, pour la présence.
- Toutes les routes coûteuses de la V1 sont supprimées : génération, économie, world-engine, scheduler, trigger, **debug**, jump-to-day, reset-world, statut. Le SDK Anthropic est désinstallé.

## 7. Monde simulé sur la durée ✅

| Horizon | Morts | Naissances | Vivants | Élections | Remarques |
|---|---|---|---|---|---|
| 1 an de monde ≈ 30 jours réels (test d'invariants) | 3 | 4 | 21 | 51 | aucun argent négatif, aucun agent dans un mur, un président toujours vivant ou un intérim, une élection chaque semaine sans exception |
| 3 ans de monde ≈ 3 mois réels | 8 | 16 | 28 | 156 | la population atteint le plafond de naissances (28), puis seules les morts libèrent des places |

**Élection sans candidat :** impossible. Si personne ne se présente, SYSTEM désigne d'office les deux agents les plus réputés.

**Arcs émergents observés sans écriture manuelle :** Nova recruté par le culte de Nyx ; $VAULT retiré de la cote après un krach puis un bank run ; un journaliste publie une fuite, la presse est interdite, le journaliste la défie et se fait arrêter sous loi martiale.

## 8. Écarts assumés par rapport au prompt

1. **Corpus :** environ 1 450 morceaux de phrases combinables (499 pour les storylets, 777 pour les voix des 20 fondateurs, 87 pour les nouveau-nés, 66 répliques d'ambiance, 23 épitaphes), au lieu de « centaines par agent et par storylet ». La variété vient de l'assemblage.
2. **Futur lisible :** les checkpoints sont calculés jusqu'à 3 ans dans le futur. Une personne technique peut donc lire l'avenir dans les fichiers ; l'Oracle limité à 10 minutes n'est qu'une limite d'interface.
3. **Population plafonnée à 32 places**, 28 pour les naissances, pour garder un coût borné.
4. **Images OG :** `next/og` en runtime Node plante sous Windows (bug de Next 14). Elles ont été validées par une route de test edge, réservée au dev (404 en prod), et le build Vercel (Linux) a réussi. Elles ne sont **pas encore vérifiées en conditions réelles**, car la preview est protégée par la connexion Vercel.
5. **Supabase Presence :** le plan gratuit accepte environ 200 connexions simultanées. Au-delà, les nouveaux visiteurs n'ont simplement pas d'yeux.

## 9. Ce qui reste à faire de ton côté

- **Ouvrir la preview :** `https://gridfall-9umj-git-v2-world-wertazzous-projects.vercel.app`. Elle demande ta connexion Vercel.
- **Fusionner `v2-world` → `main`** quand tu valides. Je ne le fais pas sans ton accord.
- **Après la fusion :** retirer `ANTHROPIC_API_KEY` et `CRON_SECRET` des variables d'environnement Vercel.
- **Date de Genèse :** elle est fixée au 21/11/2026 00:00 UTC, le monde tourne donc déjà. Elle se change en une ligne dans `lib/sim/config.ts`, mais ça change tout le monde.
- **Logos :** `public/logo.jpg` et `public/logo.webp` n'étaient pas dans git avant mon passage, je ne les ai pas ajoutés. J'ai retiré l'icône Apple qui pointait vers `logo.webp`.
