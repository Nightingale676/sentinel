"""Verify customer_001 and check the recording for AI-generated speech."""

import argparse
import json
import os
from pathlib import Path
import sys
from uuid import uuid4

import requests
from dotenv import load_dotenv


PROJECT_DIR = Path(__file__).resolve().parent
URL = "https://platform.detectif.ai/v1/speakers/verify"


def verify(audio_path):
    load_dotenv(PROJECT_DIR / ".env")
    api_key = os.getenv("DETECTIF_API_KEY", "").strip()
    if not api_key or api_key == "your_actual_api_key":
        print("Add your DetectifAI API key to .env and save the file first.")
        return 1

    audio_path = Path(audio_path)
    if not audio_path.is_absolute():
        audio_path = PROJECT_DIR / audio_path
    if not audio_path.is_file():
        print(f"Recording not found: {audio_path.name}")
        print("Save a fresh 8-15 second recording in the project folder.")
        print("For M4A recordings, run: python verify.py verify.m4a")
        return 1

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Idempotency-Key": str(uuid4()),
    }
    data = {"speaker_id": "customer_001", "detect_deepfake": "true"}
    try:
        with audio_path.open("rb") as audio:
            response = requests.post(
                URL,
                headers=headers,
                data=data,
                files={"file": (audio_path.name, audio)},
                timeout=300,
            )
    except (OSError, requests.RequestException):
        print("Could not read the recording or reach DetectifAI. Check the file and connection.")
        return 1

    print("Status Code:", response.status_code)
    try:
        print(json.dumps(response.json(), indent=4))
    except ValueError:
        print("Response:", response.text)
    return 0 if response.ok else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", nargs="?", default="verify.wav")
    args = parser.parse_args()
    sys.exit(verify(args.audio))
