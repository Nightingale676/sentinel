import os
import sys
from pathlib import Path
from uuid import uuid4

import requests
from dotenv import load_dotenv


PROJECT_DIR = Path(__file__).resolve().parent
URL = "https://platform.detectif.ai/v1/deepfake/detect"


def detect_deepfake(audio_path="sample.m4a"):
    load_dotenv(PROJECT_DIR / ".env")
    api_key = os.getenv("DETECTIF_API_KEY", "").strip()
    if not api_key or api_key.lower() in {"your_actual_api_key", "api key not set", "your_api_key", "my_api_key"}:
        print("API key not set. Configure DETECTIF_API_KEY in .env before detection.")
        return 1

    audio_path = Path(audio_path)
    if not audio_path.is_absolute():
        audio_path = PROJECT_DIR / audio_path
    if not audio_path.is_file():
        print(f"Audio file not found: {audio_path.name}. Save your recording there first.")
        return 1

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Idempotency-Key": str(uuid4()),
    }
    try:
        with audio_path.open("rb") as audio:
            response = requests.post(
                URL,
                headers=headers,
                files={"file": (audio_path.name, audio)},
                timeout=60,
            )
    except (OSError, requests.RequestException):
        print("Could not read the audio or reach DetectifAI. Check the file and connection.")
        return 1

    print("Status Code:", response.status_code)
    print("Response:", response.text)
    return 0 if response.ok else 1


if __name__ == "__main__":
    sys.exit(detect_deepfake())
