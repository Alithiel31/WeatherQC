# Android (TWA)

🇫🇷 [Version française](./android.md)

[Back to README](../README.en.md)

The app is in **internal testing** on the Google Play Store, as a TWA (Trusted Web Activity): a thin Android shell that loads the PWA directly from `https://qcweather.alithiel31.dev`. Public-track publication is expected soon — see the status note below.

**Package ID:** `dev.alithiel31.qcweather` — Sources: `twa-qcweather/`

## CI/CD workflows

| Workflow | Trigger | Role |
|---|---|---|
| `android.yml` | PR or push touching `twa-qcweather/**` | **Unsigned** `bundleRelease` — pre-merge safety net |
| `build-twa.yml` | Push to `twa-qcweather/**` **from `main`**, or manual **from `main`** | Build + sign the `.aab` |
| `deploy-twa.yml` | After `build-twa.yml` succeeds, or manual from `main` | Publish to Play Store (Internal Testing) |

> The production keystore is only decrypted from `main` — `build-twa.yml` and `deploy-twa.yml`
> carry the `github.ref == 'refs/heads/main'` guard, which also covers manual dispatch.
>
> **The production signature therefore only exists on `main`.** Compilation, however, is
> verified from the pull request onwards: `android.yml` runs `bundleRelease` with no secrets at
> all — the project declares no `signingConfig`, Bubblewrap injects the signature at build time,
> and the bundle this safety net produces is unsigned and never published. A Gradle, AGP or
> `androidbrowserhelper` bump therefore fails before the merge, not after.
>
> To reproduce locally: `cd twa-qcweather && ./gradlew bundleRelease`.

> `deploy-twa.yml` requires a **first manual submission** in Play Console — Google requires a version to already exist on the track before accepting uploads via API.

> **Current status**: the version available via `deploy-twa.yml` is limited to testers declared in Play Console (Internal Testing track) — the badge link at the top of the [README](../README.en.md) isn't publicly reachable yet. The move to a production track is in progress; this section will be updated once publication is live.

## Required GitHub secrets

| Secret | Description |
|---|---|
| `KEYSTORE_BASE64` | Android keystore, base64-encoded |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_PASSWORD` | Signing key password |
| `PLAY_SERVICE_ACCOUNT_JSON` | Google Play API Service Account JSON key |

## Setting up the Service Account (once)

1. [Google Cloud Console](https://console.cloud.google.com) → IAM & Admin → Service Accounts → Create
2. Download the JSON key → add it as the `PLAY_SERVICE_ACCOUNT_JSON` secret
3. Play Console → Setup → API access → link the service account → **Release Manager** role
