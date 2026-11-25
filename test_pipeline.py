import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from sentinel import load_checks, spoken_message
from risk_engine import assess_risk


class PipelineTests(unittest.TestCase):
    def test_saved_checks_reject_different_audio(self):
        with tempfile.TemporaryDirectory() as directory:
            audio = Path(directory) / "audio.m4a"
            checks = Path(directory) / "checks.json"
            audio.write_bytes(b"first recording")
            checks.write_text(json.dumps({
                "audio_sha256": hashlib.sha256(audio.read_bytes()).hexdigest(),
                "speaker_id": "customer_001", "verification": {},
            }))
            self.assertEqual(load_checks(checks, audio)[0], {})
            audio.write_bytes(b"different recording")
            with self.assertRaises(ValueError):
                load_checks(checks, audio)

    def test_spoken_guidance_mentions_missing_checks(self):
        message = spoken_message(assess_risk("Transfer 5000 rupees"))
        self.assertIn("identity is unverified", message)
        self.assertIn("authenticity is unverified", message)
        self.assertIn("banking app", message)


if __name__ == "__main__":
    unittest.main()
