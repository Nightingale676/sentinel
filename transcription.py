"""Transcribe a local recording using Whisper on the CPU."""

import argparse
import json
from functools import lru_cache
from pathlib import Path
import sys

from intent import extract_intent


PROJECT_DIR = Path(__file__).resolve().parent


@lru_cache(maxsize=1)
def get_model():
    from faster_whisper import WhisperModel

    return WhisperModel("base", device="cpu", compute_type="int8")


def transcribe_audio(audio_path="verify.m4a"):
    audio_path = Path(audio_path)
    if not audio_path.is_absolute():
        audio_path = PROJECT_DIR / audio_path
    if not audio_path.is_file():
        raise FileNotFoundError(f"Recording not found: {audio_path}")

    segments, _ = get_model().transcribe(str(audio_path), beam_size=5)
    return " ".join(segment.text.strip() for segment in segments).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", nargs="?", default="verify.m4a")
    args = parser.parse_args()
    print("Loading Whisper and transcribing (the first run downloads the base model)...")
    try:
        transcript = transcribe_audio(args.audio)
    except ImportError:
        print("Install the dependencies first: python -m pip install -r requirements.txt")
        return 1
    except Exception as error:
        print(f"Transcription failed: {error}")
        return 1
    print("Transcript:", transcript or "[No speech transcribed]")
    print("Intent:", json.dumps(extract_intent(transcript), indent=4))
    return 0


if __name__ == "__main__":
    sys.exit(main())
