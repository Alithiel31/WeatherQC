# Android (TWA)

🇬🇧 [English version](./android.en.md)

[Retour au README](../README.md)

L'application est en **test interne** (Internal Testing) sur le Google Play Store, sous forme de TWA (Trusted Web Activity) : une coquille Android légère qui charge directement le PWA depuis `https://qcweather.alithiel31.dev`. La publication en piste publique est prévue à court terme — voir la note de statut ci-dessous.

**Package ID :** `dev.alithiel31.qcweather` — Sources : `twa-qcweather/`

## Workflows CI/CD

| Workflow | Déclencheur | Rôle |
|---|---|---|
| `android.yml` | PR ou push touchant `twa-qcweather/**` | `bundleRelease` **non signé** — filet avant merge |
| `build-twa.yml` | Push sur `twa-qcweather/**` **depuis `main`**, ou manuel **depuis `main`** | Build + signature du `.aab` |
| `deploy-twa.yml` | Après `build-twa.yml` réussi, ou manuel depuis `main` | Publication sur Play Store (Internal Testing) |

> Le keystore de production n'est déchiffré que depuis `main` — `build-twa.yml` et
> `deploy-twa.yml` portent la garde `github.ref == 'refs/heads/main'`, qui couvre aussi le
> déclenchement manuel.
>
> **La signature de production n'existe donc que sur `main`.** La compilation, elle, est
> vérifiée dès la PR : `android.yml` exécute `bundleRelease` sans aucun secret — le projet ne
> déclare pas de `signingConfig`, Bubblewrap injecte la signature au moment du build, et le
> bundle produit par ce filet est non signé et jamais publié. Une montée de Gradle, d'AGP ou
> d'`androidbrowserhelper` échoue donc avant merge, pas après.
>
> Pour reproduire en local : `cd twa-qcweather && ./gradlew bundleRelease`.

> `deploy-twa.yml` nécessite une **première soumission manuelle** dans Play Console — Google exige qu'une version existe déjà sur la piste avant d'accepter les uploads via API.

> **Statut actuel** : la version disponible via `deploy-twa.yml` est limitée aux testeurs déclarés dans Play Console (piste Internal Testing) — le lien du badge en haut du [README](../README.md) n'est donc pas encore accessible au public. La bascule vers une piste de production est en cours ; cette section sera mise à jour dès la publication effective.

## Secrets GitHub requis

| Secret | Description |
|---|---|
| `KEYSTORE_BASE64` | Keystore Android encodé en base64 |
| `KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `KEY_PASSWORD` | Mot de passe de la clé de signature |
| `PLAY_SERVICE_ACCOUNT_JSON` | Clé JSON du Service Account Google Play API |

## Configurer le Service Account (une fois)

1. [Google Cloud Console](https://console.cloud.google.com) → IAM & Admin → Service Accounts → Créer
2. Télécharger la clé JSON → ajouter comme secret `PLAY_SERVICE_ACCOUNT_JSON`
3. Play Console → Setup → API access → lier le service account → rôle **Release Manager**
