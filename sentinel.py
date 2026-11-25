"""Transcribe audio, assess saved checks, and optionally speak local guidance."""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

from risk_engine import assess_risk
from transcription import transcribe_audio


PROJECT_DIR = Path(__file__).resolve().parent


def load_checks(path, audio, speaker_id="customer_001"):
    saved = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    digest = hashlib.sha256(Path(audio).read_bytes()).hexdigest()
    if saved.get("audio_sha256") != digest:
        raise ValueError("Saved checks do not belong to this audio file.")
    if saved.get("speaker_id") != speaker_id:
        raise ValueError("Saved checks are for a different enrolled speaker.")
    if not isinstance(saved.get("verification"), dict):
        raise ValueError("Saved verification must be a JSON object.")
    return saved["verification"], saved.get("source", "Saved checks")


def spoken_message(report):
    speaker = {"match": "Voice matches the enrolled speaker.",
               "no_match": "Voice does not match the enrolled speaker.",
               "unknown": "Speaker identity is unverified."}[report["speaker_status"]]
    authenticity = {"genuine": "Speech was classified as genuine.",
                    "synthetic": "Possible AI-generated speech detected.",
                    "unknown": "Speech authenticity is unverified."}[report["authenticity_status"]]
    return f"Sentinel. {speaker} {authenticity} {report['guidance']}"


def speak(text):
    if sys.platform != "win32":
        raise RuntimeError("Built-in speech output currently requires Windows.")
    # Only constant code enters PowerShell; message text travels through stdin.
    script = (
        "$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.Speech; "
        "$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
        "try { $voice.Speak([Console]::In.ReadToEnd()) } finally { $voice.Dispose() }"
    )
    subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script],
                   input=text, text=True, check=True, capture_output=True, timeout=90)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", nargs="?", default="verify.m4a")
    parser.add_argument("--checks", type=Path, help="Saved checks bound to this recording")
    parser.add_argument("--speak", action="store_true", help="Read the guidance aloud on Windows")
    args = parser.parse_args()
    audio = Path(args.audio)
    if not audio.is_absolute():
        audio = PROJECT_DIR / audio
    try:
        checks, source = load_checks(args.checks, audio) if args.checks else (None, "No saved verification supplied; identity and authenticity are unknown")
        print("Checks:", source)
        print("Transcribing locally...")
        transcript = transcribe_audio(audio)
        report = assess_risk(transcript, checks)
    except Exception as error:
        print(f"Could not assess recording: {error}")
        return 1
    print("Transcript:", transcript or "[No speech transcribed]")
    print(json.dumps(report, indent=4))
    message = spoken_message(report)
    print("Guidance:", message)
    if args.speak:
        try:
            speak(message)
        except (OSError, RuntimeError, subprocess.SubprocessError) as error:
            print(f"Speech output unavailable; guidance is printed above. {error}")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
