# Sentinel

Voice-secured demo payments using React, TypeScript, Node.js, Python, and DetectifAI. Faster Whisper transcribes audio locally; Eidos verifies speakers and Aletheia checks speech authenticity.

## Run locally

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

## Payment flow

Add a payee and enroll the owner's voice with consent. Select Pay, record a fresh request containing one amount in rupees and the full saved payee name, then Stop and Run. Review the verified amount and recipient before confirming.

The backend issues account-bound, single-use authorization tokens that expire after two minutes. Typed requests cannot authorize a debit. Enrollment audio and previously authorized recording hashes cannot be reused.

## Validation

From `frontend`, run `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build`. Python tests are in the repository root; saved-recording tests need local audio and verification fixtures excluded from Git.

## Prototype limits

Transfers update a demo balance; there is no banking integration. Accounts, payees, balances, and transaction history are stored in server memory. Enrollment metadata and used recording hashes persist in `private_runtime/`. Recording-hash checks are not full liveness protection. API keys, recordings, cached checks, and private runtime state are excluded from Git.
