import unittest
import base64
from pathlib import Path
import tempfile
import types
from unittest.mock import patch

from analysis_worker import analyze, InputError


class AnalysisWorkerTests(unittest.TestCase):
    def test_text_does_not_perform_voice_checks(self):
        with patch('analysis_worker.transcribe_audio') as transcribe:
            result = analyze({'text': 'Give me your OTP', 'live': True})
        transcribe.assert_not_called()
        self.assertEqual(result['credits_used'], 0)
        self.assertEqual(result['report']['speaker_status'], 'unknown')
        self.assertEqual(result['report']['authenticity_status'], 'unknown')
        self.assertEqual(result['report']['risk_level'], 'high')

    def test_invalid_audio_rejected_before_transcription(self):
        with patch('analysis_worker.transcribe_audio') as transcribe:
            with self.assertRaises(InputError):
                analyze({'audio': 'not base64!', 'suffix': '.wav', 'live': True})
        transcribe.assert_not_called()

    def test_unsupported_format_rejected(self):
        with self.assertRaises(InputError):
            analyze({'audio': 'aGVsbG8=', 'suffix': '.exe'})

    def test_new_audio_in_saved_mode_stays_unverified(self):
        fake_audio = types.ModuleType('faster_whisper.audio')
        fake_audio.decode_audio = lambda *args, **kwargs: range(16000 * 9)
        with tempfile.TemporaryDirectory() as directory:
            with patch('analysis_worker.ROOT', Path(directory)), \
                 patch.dict('sys.modules', {'faster_whisper.audio': fake_audio}), \
                 patch('analysis_worker.transcribe_audio', return_value='Transfer 5000 rupees'):
                result = analyze({'audio': base64.b64encode(b'fake audio').decode(), 'suffix': '.wav'})
        self.assertEqual(result['report']['speaker_status'], 'unknown')
        self.assertEqual(result['report']['authenticity_status'], 'unknown')
        self.assertEqual(result['credits_used'], 0)

    def test_too_long_audio_rejected_before_paid_request(self):
        fake_audio = types.ModuleType('faster_whisper.audio')
        fake_audio.decode_audio = lambda *args, **kwargs: range(16000 * 61)
        with patch.dict('sys.modules', {'faster_whisper.audio': fake_audio}), \
             patch('analysis_worker.transcribe_audio') as transcribe:
            with self.assertRaises(InputError):
                analyze({'audio': base64.b64encode(b'fake').decode(), 'suffix': '.wav', 'live': True})
        transcribe.assert_not_called()


if __name__ == '__main__':
    unittest.main()
