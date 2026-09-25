# Guide de reprise

🇬🇧 [English version](./guide-de-reprise.en.md)

[Retour au README](../README.md)

Météo Québec a un seul mainteneur réel (**Jacques Duchamplecheval**, alias GitHub
`Alithiel31`). Ce document existe pour qu'une autre personne — ou Jacques lui-même après une
longue coupure — puisse reprendre le projet sans devoir reconstituer seul(e) ce qui est
documenté ailleurs, dispersé, ou seulement connu du mainteneur. Il pointe vers la documentation
existante plutôt que de la dupliquer, et liste ce qu'il faut *avoir accès à* pour agir, pas
seulement *comprendre*.

---

## 1. Comprendre le projet — ordre de lecture recommandé

1. [README.md](../README.md) — vue d'ensemble, fonctionnalités, stack
2. [docs/architecture.md](./architecture.md) — schéma complet, résilience des amonts, structure du dépôt
3. [docs/environnement.md](./environnement.md) — toutes les variables de config
4. [docs/developpement.md](./developpement.md) — lancer le projet en local, tests, CI
5. [docs/android.md](./android.md) — pipeline TWA / Google Play
6. [docs/notifications.md](./notifications.md) — alertes météo push
7. [docs/veille-api-tierces.md](./veille-api-tierces.md) — dépendance aux APIs gratuites
8. [CONTRIBUTING.md](../CONTRIBUTING.md), [SECURITY.md](../SECURITY.md), [TROUBLESHOOTING.md](../TROUBLESHOOTING.md)
9. [CHANGELOG.md](../CHANGELOG.md) — historique détaillé des décisions

---

## 2. Ce qui tourne, et où

| Composant | Où | Comment y accéder |
|---|---|---|
| Application en production | `qcweather.alithiel31.dev` | Domaine public, HTTPS via tunnel Cloudflare |
| Hébergement | Un **Raspberry Pi** physique (nom d'hôte `Caesura` dans les scripts/CI) | Accès réseau via **Tailscale** — voir `TAILSCALE_IP` dans [docs/environnement.md](./environnement.md) |
| Conteneurs | `docker-compose.yml` à la racine (backend + frontend nginx) | `docker compose ps` sur le Pi |
| Déploiement continu | Workflow `.github/workflows/deploy-web.yml` | Se déclenche sur push `main`, ou via `npm run deploy:web` (voir `scripts/gh-deploy.sh`) — tourne sur un **runner GitHub Actions self-hosted installé sur le Pi lui-même** (le Pi va chercher le job, aucun port entrant à ouvrir) |
| Nom de domaine | `alithiel31.dev` | Registrar — **à compléter par le mainteneur** (nom du registrar, identifiants) |
| Tunnel Cloudflare | Compte Cloudflare associé au domaine | **À compléter** (identifiants du compte Cloudflare) |
| Application Android | Package `dev.alithiel31.qcweather`, test interne Google Play | Voir [docs/android.md](./android.md) pour les workflows `android.yml` / `build-twa.yml` / `deploy-twa.yml` |

---

## 3. Secrets et accès nécessaires pour agir

Aucun secret réel n'est stocké dans ce dépôt (voir `.gitignore` et [SECURITY.md](../SECURITY.md)).
Pour reprendre le projet en pratique, il faut obtenir l'accès aux éléments suivants — **à
compléter par le mainteneur actuel** (gestionnaire de mots de passe utilisé, ou tout autre moyen
de transmission sécurisée) :

- **Accès administrateur au dépôt GitHub** [`Alithiel31/WeatherQC`](https://github.com/Alithiel31/WeatherQC) (secrets Actions, réglages CODEOWNERS/branches)
- **Compte Cloudflare** (tunnel, domaine `alithiel31.dev`)
- **Compte Tailscale** (réseau vers le Raspberry Pi)
- **Accès physique ou SSH au Raspberry Pi** hébergeant les conteneurs et le runner self-hosted
- **`backend/.env` et `frontend/.env` réels** (ou les valeurs pour les reconstituer à partir de `backend/.env.example` / `frontend/.env.example`) — en particulier les clés VAPID (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, régénérables avec `npx web-push generate-vapid-keys` mais cela invalide tous les abonnements push existants), et les clés OpenWeatherMap / CARTO (gratuites, voir [docs/veille-api-tierces.md](./veille-api-tierces.md))
- **Keystore de signature Android** (`twa-qcweather/android.keystore`, ignoré par git) et son mot de passe — sans lui, impossible de publier une mise à jour signée de la même application sur le Play Store
- **Compte Google Play Console** + **service account** utilisé par `deploy-twa.yml` (voir [docs/android.md](./android.md))
- **Boîte courriel `contact@alithiel31.dev`** (canal de signalement de sécurité par repli, voir [SECURITY.md](../SECURITY.md))

> Sans le keystore Android et son mot de passe, l'application ne peut **pas** être remplacée par
> une nouvelle : Google Play refuse un APK signé par une clé différente. Sa perte est
> irréversible pour l'app existante — c'est l'élément le plus critique de cette liste.

---

## 4. Remettre le service en marche à partir de zéro

Si le Raspberry Pi est perdu/remplacé mais que le code et les secrets ci-dessus sont
disponibles :

1. Réinstaller Docker + Docker Compose sur la nouvelle machine
2. Reconfigurer le tunnel Cloudflare et Tailscale vers cette machine
3. Reconstituer `backend/.env` et `frontend/.env` (voir [docs/environnement.md](./environnement.md))
4. Réinstaller le runner GitHub Actions self-hosted (nécessaire pour `deploy-web.yml`) — voir la
   documentation GitHub officielle sur les runners self-hosted, ce dépôt ne la duplique pas
5. `docker compose --env-file frontend/.env up --build -d` (voir [README.md](../README.md#déploiement-docker))
6. Vérifier `/api/sante` et les en-têtes de sécurité (le job `docker` de la CI reproduit
   exactement ces vérifications, voir `.github/workflows/ci.yml`)

Sans accès aux secrets ci-dessus (clés VAPID, keystore Android), le service web peut être
recréé mais avec de nouvelles clés — **tous les abonnements aux alertes météo existants
deviendront invalides** et l'app Android existante ne pourra plus recevoir de mise à jour
signée.

---

## 5. Risques connus à garder en tête

- **Mainteneur unique** — ce document réduit le risque mais ne le supprime pas ; envisager, à
  terme, de donner un accès en lecture à cette liste de secrets à une seconde personne de
  confiance.
- **Dépendance à des APIs tierces gratuites sans SLA** — voir
  [docs/veille-api-tierces.md](./veille-api-tierces.md).
- **Point unique matériel** — l'hébergement dépend d'un Raspberry Pi personnel ; pas de
  redondance ni de plan de bascule vers un autre hébergeur documenté à ce jour.
- **Perte du keystore Android** — irréversible pour l'application déjà publiée (voir section 3).

---

## À compléter par le mainteneur

Les champs suivants sont volontairement laissés vides — ils touchent à des informations
personnelles ou à des identifiants qui n'ont pas leur place dans un dépôt public :

- [ ] Où sont stockés les secrets listés en section 3 (gestionnaire de mots de passe, coffre-fort numérique...) et qui d'autre y a accès
- [ ] Registrar du domaine `alithiel31.dev` et identifiants du compte
- [ ] Personne(s) de confiance à contacter en cas d'indisponibilité prolongée du mainteneur
- [ ] Emplacement physique du Raspberry Pi et modalités d'accès en cas d'urgence
