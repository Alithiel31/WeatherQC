# Notifications d'alertes météo

🇬🇧 [English version](./notifications.en.md)

[Retour au README](../README.md)

Abonnement facultatif, par ville, à des alertes Web Push déclenchées par un changement météo
brusque — précipitation imminente, chute de température, vent fort, verglas, orage. Les routes
sont listées dans le tableau des routes disponibles de
[Développement local](./developpement.md#backend-port-3005) (`GET /api/notifications/cle-publique`,
`POST`/`DELETE /api/notifications/abonnement`).

```bash
# backend/.env — générer une paire de clés VAPID (une fois)
npx web-push generate-vapid-keys
```

Sans `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` configurées (voir
[Variables d'environnement](./environnement.md)), les routes `/api/notifications/*` répondent
**503** et le contrôle « Activer les alertes météo » de l'interface échoue proprement à
l'abonnement plutôt que de faire disparaître le reste de l'application.

**En prod**, ces deux clés ne vivent plus dans `backend/.env` sur le Pi : elles sont gérées dans
Infisical (projet *Shared Keys*, environnement `prod`) et injectées au déploiement par
`deploy-web.yml` via `infisical run` (Machine Identity `qcweather-deploy`, rôle lecture seule).
`docker-compose.yml` les récupère via `${VAPID_PUBLIC_KEY}`/`${VAPID_PRIVATE_KEY}` dans le bloc
`environment:` du service `backend` — substitution résolue depuis le shell (Infisical) en prod,
depuis `backend/.env` (via `--env-file`) en local. Toute rotation de clé se fait uniquement dans
Infisical, jamais à la main sur le Pi.

**Détection** (`backend/src/services/detecteur-alertes.ts`) — fonction pure, sans réseau ni
horloge : compare l'état actuel aux prévisions horaires et rend les alertes qui franchissent un
seuil (précipitation ≥ 70 % sous 2 h, chute ≥ 8 °C sous 6 h, rafales ≥ 60 km/h, verglas et orage
par code météo WMO). Verglas et orage sont marquées « importantes ».

**Abonnements** (`backend/src/services/abonnements.service.ts`) — stockage `node:sqlite`, un
fichier par défaut (`DB_PATH`), une table d'abonnements (ville, endpoint, clés de chiffrement) et
une table anti-spam qui empêche de renvoyer la même alerte tant que la situation qui l'a
déclenchée n'a pas cessé puis repris. Un navigateur ne porte qu'un abonnement actif à la fois :
ré-abonner un même `endpoint` à une autre ville remplace l'entrée existante plutôt que d'en créer
une seconde.

**Vérification et envoi** (`backend/src/services/verificateur-alertes.ts`) — cycle horaire (le premier
cycle part deux minutes après le démarrage, pour qu'un redéploiement ne repousse pas la
vérification d'une heure), sur
les seules villes ayant au moins un abonnement (`villesAbonnees()`, pour éviter d'interroger
Open-Meteo pour les autres). Un abonnement dont l'envoi échoue avec un 404/410 Web Push est
considéré expiré et supprimé automatiquement — c'est ainsi que se nettoient les abonnements
orphelins (permission retirée, site désinstallé), sans action explicite de personne.

**Frontend** — `frontend/src/lib/notifications.ts` (demande de permission, abonnement et
désabonnement `PushManager`) et `AlertesMeteo.svelte` (contrôle affiché sous l'en-tête de
l'application, masqué plutôt qu'en erreur si le navigateur ne supporte pas Push — Safari iOS
< 16.4, navigation privée sur plusieurs navigateurs). La réception vit dans le service worker
(`frontend/src/sw.ts`, mode `injectManifest` de vite-plugin-pwa — seul moyen d'y ajouter des
gestionnaires `push`/`notificationclick`, que `generateSW` ne permet pas), qui affiche la
notification reçue et ramène au premier onglet déjà ouvert au clic.

Ce que le navigateur transmet et ce que le serveur conserve : voir la section « Alertes météo
(notifications) » de la
[politique de confidentialité](https://qcweather.alithiel31.dev/privacy-policy.html).
