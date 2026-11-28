# Deploy Sentinel

The Docker image runs the React production build, Express API, and Python worker together. Local secrets, recordings, verification caches, and private runtime data are excluded from the build context.

## Render

Create a Render Blueprint from this GitHub repository and select `render.yaml`, or create a Docker web service using the repository root as the Docker context. Render assigns the public HTTPS URL after a successful deployment.

The Blueprint selects the free web plan and creates a session signing secret. `DETECTIF_API_KEY` starts empty: visitors see **API key not set**, and live enrollment/verification is unavailable until the operator configures a key in Render. Never put that secret in Git or browser configuration.

The free deployment is a demonstration. Its filesystem is ephemeral, and customer accounts and balances are already held in memory. Voice profiles, audit history, and audio created on that service can disappear when the instance is replaced. Attach a persistent disk at `/app/private_runtime` on a suitable paid service if you need to retain them; review the host's charges before upgrading. Account persistence still requires an application database.

Whisper loads a local model on first transcription. Measure memory needs and choose sufficient compute before enabling live checks; the free instance may not have enough memory. DetectifAI enrollment and verification also consume provider credits. The seeded client accounts are demo accounts, so do not upload real biometric recordings or use this as production banking infrastructure.

## Docker locally

```powershell
docker build -t sentinel .
docker run --rm -p 3000:3000 sentinel
```

Open http://localhost:3000. With no provider key, saved/text analysis and the presentation remain available, while live voice operations show the configuration message.
