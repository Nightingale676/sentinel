# 🛡️Sentinel

🎙️ Voice-secured demo payments using React, TypeScript, Node.js, Python, and DetectifAI. Faster Whisper transcribes audio locally; Eidos verifies speakers and Aletheia checks speech authenticity.

## 🌍 Deploy a demo

[Deploy to Render](https://render.com/deploy?repo=https://github.com/Nightingale676/sentinel)

The Blueprint uses the free demo plan and leaves the provider key unset. See [deployment instructions](DEPLOYMENT.md) for configuration, ephemeral storage limitations, and compute requirements for live transcription. Deployment does not upload your local recordings or API keys.

## 🚀 Run locally

Install Python 3.10+ and Node.js compatible with Vite 8. In PowerShell from this folder:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `DETECTIF_API_KEY` in the root `.env`, then start the app:

```powershell
$env:SENTINEL_PYTHON = (Resolve-Path .\.venv\Scripts\python.exe).Path
cd frontend
npm.cmd install
npm.cmd run dev
```

Open http://localhost:3000. See [the setup guide](frontend/LOCAL_SETUP.md) for enrollment and troubleshooting. Live enrollment and checks upload audio to DetectifAI and use credits. Whisper may download its model on first use.

## 💸 Payment flow

Customers enroll their owner voice once during account setup. With explicit registry consent, their name and automatic customer reference appear in Aarohan Bank India's Voices tab. Later password sign-ins require a fresh matching, genuine voice recording before customer APIs are accessible; successful verification updates the registry's last-verified date. Existing enrolled owners can opt into the registry from their dashboard without uploading enrollment audio again. Live checks use DetectifAI credits. This demo links customer registry consent to the configured Aarohan organization; production requires verified bank membership. Customer accounts remain in memory even though voice profile metadata persists across server restarts.

Add a payee and enroll the owner's voice with consent. Select Pay, record a fresh request containing one amount in rupees and the full saved payee name, then Stop and Run. Review the verified amount and recipient before confirming.

The backend issues account-bound, single-use authorization tokens that expire after two minutes. Typed requests cannot authorize a debit. Enrollment audio and previously authorized recording hashes cannot be reused.

## 🎧 Security recordings and live audit ledger

The client portal uses persisted real audit events in `private_runtime/client-ledger.json`, rather than seeded transaction examples. Pending voice payments appear as Suspicious until confirmation; completed transfers update that row to Allowed. Rejected and inconclusive payment/sign-in checks are recorded with their reasons. Only allowed transfer amounts contribute to the value total. The portal refreshes every 15 seconds and on window focus.

Recording retention requires separate, unchecked-by-default consent for each submission. Consented audio is saved under `private_runtime/recordings/` and served only through an organization-scoped client-admin endpoint. Admins can play a retained owner sample from Voices and submitted attempt recordings from transaction details, including blocked attempts. A rejected sample does not establish who spoke. Audio without retention consent, including older recordings, cannot be recovered. Retained audio has no automatic expiry; the operator must remove it when no longer needed. These private files are excluded from Git.

## 🧪 Validation

From `frontend`, run `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build`. Python tests are in the repository root; saved-recording tests need local audio and verification fixtures excluded from Git.

## 📌 Prototype limits

Transfers update a demo balance; there is no banking integration. Accounts, payees, balances, and transaction history are stored in server memory. Enrollment metadata and used recording hashes persist in `private_runtime/`. Recording-hash checks are not full liveness protection. API keys, recordings, cached checks, and private runtime state are excluded from Git.

