# Sentinel frontend

This folder contains the imported React/Vite interface and its Express demo server.
The existing Python pipeline remains in the parent folder.

From the Sentinel project terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. Keep that terminal running; use Ctrl+C to stop.
Use a second terminal for Python commands from the parent folder.

The dashboard's **Owner voice payment protection** panel connects to the Python pipeline.
Start npm from the same activated Python environment where transcription worked.
Install the parent `requirements.txt` first. If Python is not on PATH, set
`$env:SENTINEL_PYTHON = 'C:\path\to\working\python.exe'` before `npm run dev`.
The Express server starts the Python worker; no second API server is needed.
Restart npm after changes to server.ts.

Record until Stop or upload audio (12 MB maximum, 60 seconds maximum). Saved mode
uses checks only for the exact file hash; unknown clips stay unverified. To test
existing results, upload `verify.m4a` or `unknown.m4a` from the parent folder.
Live mode explicitly uploads to DetectifAI, using the existing `customer_001`
enrollment and backend key. Completed responses are saved under `saved_checks/`;
raw uploaded audio is temporary. Do not treat this single-profile local prototype
as a multi-customer service. Cache files contain voice model responses; delete them
when no longer needed. They are ignored by Git. Stable idempotency keys protect
retries of identical clips; there are no automatic paid retries.

Typed analysis invokes only the risk rules: it cannot verify a speaker or detect
synthetic audio. Legacy typed/transcript and passphrase payment endpoints now
always block and cannot change the balance.

## Owner-only demo payments

1. Select **Enroll owner voice**, record 25-30 seconds of the account owner, give
   consent, and enroll. This uses the real Eidos enrollment endpoint and credits.
2. Select **Verify a payment** and make a fresh 8-15 second recording. Say a single
   amount in rupees and exactly one full saved payee name, e.g. "Transfer fifty
   rupees to Maya Chen". Both live voice checks spend credits.
3. A genuine, matching voice can receive a server-issued authorization, valid for
   two minutes and only one use. Review and confirm the exact amount/payee to debit
   the **demo** balance. A mismatch or missing check blocks; a passphrase cannot
   bypass it. Saving an analysis alone cannot authorize a debit.

The enrollment speaker ID is bound to the signed-in account. Profile consent and
known used recording hashes are saved in `private_runtime/voice-payments.json`
(Git-ignored). Replacing an owner through this UI is disabled. Pending transfer
tokens disappear on server restart. The original exported demo account/balance
store remains in memory; it is not a real banking ledger. Old customer_001 examples
can still be analyzed in **Risk analysis only**, but cannot authorize payments.
Exact enrollment clips and already authorized files cannot be reused. This is
not full replay/liveness protection: re-encoded recordings and sophisticated
spoofs require additional challenge/response and security work before real use.

No DetectifAI key
belongs in browser code. Whisper's first run downloads its model; later inference
is local. Browser voice playback uses the installed browser/OS voices.

The supplied README's Gemini setup is inherited from the export and is not
required by the current Express demo server. Keep the existing DetectifAI key
in the parent project's .env.

Checks, after installing dependencies:

```powershell
npm run build
npm test
```
