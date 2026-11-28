"""JSON stdin/stdout bridge used by the local Express server. No credentials in output."""

import base64
import hashlib
import json
import os
import re
from pathlib import Path
import sys
import tempfile

from risk_engine import assess_risk
from sentinel import load_checks, spoken_message
from transcription import transcribe_audio

ROOT = Path(__file__).resolve().parent
MAX_BYTES = 12 * 1024 * 1024
SUFFIXES = {".webm", ".wav", ".m4a", ".mp3", ".ogg", ".flac", ".mp4"}


class InputError(ValueError):
    """An error message safe to show in the local frontend."""


def analyze(payload):
    if not isinstance(payload, dict):
        raise InputError("Invalid analysis request.")
    if "text" in payload:
        text = payload["text"]
        if not isinstance(text, str) or not text.strip() or len(text) > 10000:
            raise InputError("Enter between 1 and 10000 characters.")
        report = assess_risk(text)
        return {"transcript": text, "report": report, "guidance": spoken_message(report),
                "source": "Text only: no voice checks performed", "credits_used": 0,
                "warnings": ["Text cannot establish who spoke or whether audio was synthetic."]}

    suffix = payload.get("suffix", "").lower()
    if suffix not in SUFFIXES:
        raise InputError("Unsupported recording format.")
    encoded = payload.get("audio", "")
    if not isinstance(encoded, str) or len(encoded) > MAX_BYTES * 4 // 3 + 4:
        raise InputError("Recording exceeds the 12 MB limit.")
    try:
        audio_bytes = base64.b64decode(encoded, validate=True)
    except (ValueError, TypeError):
        raise InputError("Invalid audio upload.") from None
    if not audio_bytes or len(audio_bytes) > MAX_BYTES:
        raise InputError("Choose a nonempty recording smaller than 12 MB.")
    digest = hashlib.sha256(audio_bytes).hexdigest()
    speaker_id = payload.get("speaker_id", "customer_001")
    if not isinstance(speaker_id, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,64}", speaker_id):
        raise InputError("Invalid reference speaker.")
    warnings = []
    checks, source, credits = None, "No saved checks; voice identity and authenticity are unverified", 0
    with tempfile.TemporaryDirectory(prefix="sentinel-analysis-") as directory:
        audio = Path(directory) / ("recording" + suffix)
        audio.write_bytes(audio_bytes)
        # Decode before any paid request. Validate duration even for compressed uploads.
        from faster_whisper.audio import decode_audio
        decoded = decode_audio(str(audio), sampling_rate=16000)
        duration = len(decoded) / 16000
        if not 0 < duration <= 60:
            raise InputError("Use an audio clip of at most 60 seconds.")
        if payload.get("mode") == "enroll":
            if payload.get("consent") is not True or duration < 15:
                raise InputError("Enrollment needs consent and 15-60 seconds of one person speaking.")
            from dotenv import load_dotenv
            import requests
            load_dotenv(ROOT / ".env")
            key = os.getenv("DETECTIF_API_KEY", "").strip()
            if not key or key.lower() in {"your_actual_api_key", "api key not set", "your_api_key", "my_api_key"}:
                raise InputError("API key not set. Configure DETECTIF_API_KEY in the backend .env file before enrollment.")
            with audio.open("rb") as stream:
                response = requests.post("https://platform.detectif.ai/v1/speakers/enroll",
                    headers={"Authorization": f"Bearer {key}", "Idempotency-Key": hashlib.sha256((speaker_id + ':enroll:' + digest).encode()).hexdigest()},
                    data={"speaker_id": speaker_id, "display_name": "Sentinel account owner"},
                    files={"file": (audio.name, stream)}, timeout=300)
            body = response.json()
            if not response.ok or body.get("object") != "speaker.enrollment" or body.get("speaker", {}).get("speaker_id") != speaker_id:
                raise InputError(f"Voice enrollment failed (HTTP {response.status_code}). No payment permission was granted.")
            return {"enrolled": True, "speaker_id": speaker_id, "audio_sha256": digest,
                    "credits_used": body.get("credits", {}).get("charged")}
        transcript = transcribe_audio(audio)
        if not transcript.strip():
            raise InputError("No clear speech was transcribed. Try a clearer recording.")
        for saved in ([] if payload.get("payment") is True else sorted((ROOT / "saved_checks").glob("*.json"))):
            try:
                checks, source = load_checks(saved, audio, speaker_id)
                break
            except (ValueError, OSError, AttributeError):
                continue
        if payload.get("live") is True and checks is None:
            if duration <= 4:
                raise InputError("Use more than 4 seconds of speech for combined model checks.")
            from dotenv import load_dotenv
            import requests
            load_dotenv(ROOT / ".env")
            key = os.getenv("DETECTIF_API_KEY", "").strip()
            if not key or key.lower() in {"your_actual_api_key", "api key not set", "your_api_key", "my_api_key"}:
                raise InputError("API key not set. Configure DETECTIF_API_KEY in the backend .env file before live verification.")
            # Stable request key avoids another charge on retries of the same recording.
            idempotency = hashlib.sha256((speaker_id + ":combined:v1:" + digest).encode()).hexdigest()
            credits = None  # A lost response cannot establish whether credits were charged.
            try:
                with audio.open("rb") as stream:
                    response = requests.post(
                        "https://platform.detectif.ai/v1/speakers/verify",
                        headers={"Authorization": f"Bearer {key}", "Idempotency-Key": idempotency},
                        data={"speaker_id": speaker_id, "detect_deepfake": "true"},
                        files={"file": (audio.name, stream)}, timeout=300)
                body = response.json()
                if not isinstance(body, dict):
                    raise ValueError("Invalid model response")
                if response.ok and body.get("object") == "speaker.verification" and body.get("speaker_id") == speaker_id:
                    checks = body
                    source = "Live DetectifAI checks against " + speaker_id
                    credits = body.get("credits", {}).get("charged")
                    if not isinstance(body.get("deepfake"), dict) or body["deepfake"].get("error"):
                        warnings.append("Deepfake check failed; authenticity remains unknown.")
                    saved = {"audio_sha256": digest, "speaker_id": speaker_id,
                             "source": "Cached live DetectifAI response", "verification": body}
                    cache = ROOT / "saved_checks"
                    cache.mkdir(exist_ok=True)
                    try:
                        (cache / f"live-{speaker_id}-{digest}.json").write_text(json.dumps(saved), encoding="utf-8")
                    except OSError:
                        warnings.append("Checks completed, but saving the cache failed.")
                else:
                    partial = body.get("partial")
                    if isinstance(partial, dict):
                        # The API can complete authenticity even when speaker verification fails.
                        deepfake = partial.get("deepfake", partial)
                        if isinstance(deepfake, dict) and isinstance(deepfake.get("is_synthetic"), bool):
                            checks = {"deepfake": deepfake}
                            source = "Partial live response: authenticity only; speaker unverified"
                    warnings.append(f"DetectifAI returned HTTP {response.status_code}. Check key permissions, credits, enrollment, and audio quality. Voice checks remain unverified.")
            except (requests.RequestException, ValueError):
                warnings.append("Model request failed or timed out. Voice checks remain unverified; retrying the same audio reuses its request key.")
    report = assess_risk(transcript, checks)
    return {"transcript": transcript, "report": report, "guidance": spoken_message(report),
            "source": source, "credits_used": credits, "warnings": warnings,
            "duration_seconds": round(duration, 3), "speaker_id": speaker_id,
            "audio_sha256": digest,
            "payment_checks_live": payload.get("payment") is True and source.startswith("Live DetectifAI"),
            "voice_checks": {"decision": (checks or {}).get("result", {}).get("decision"),
                             "deepfake_complete": isinstance((checks or {}).get("deepfake"), dict) and not (checks or {}).get("deepfake", {}).get("error")}}


if __name__ == "__main__":
    try:
        output = analyze(json.loads(sys.stdin.read()))
    except InputError as error:
        output = {"error": str(error)}
    except Exception:
        # Do not send exception strings containing paths, request headers, or secrets.
        output = {"error": "Audio analysis failed. Check the recording (clear speech, at most 60 seconds), Python dependencies, and local model installation."}
    print(json.dumps(output))
