import unittest

from risk_engine import assess_risk


class RiskEngineTests(unittest.TestCase):
    def test_genuine_match_does_not_authorize_payment(self):
        checks = {"result": {"decision": "match"}, "deepfake": {"is_synthetic": False, "verdict": "real"}}
        result = assess_risk("Transfer 5000 rupees", checks)
        self.assertEqual(result["risk_level"], "high")
        self.assertFalse(result["action_authorized"])

    def test_missing_checks_are_unknown(self):
        result = assess_risk("Hello")
        self.assertEqual(result["speaker_status"], "unknown")
        self.assertEqual(result["authenticity_status"], "unknown")

    def test_partial_deepfake_failure_preserves_speaker_result(self):
        result = assess_risk("Hello", {"result": {"decision": "match"}, "deepfake": {"error": {"code": "failed"}}})
        self.assertEqual(result["speaker_status"], "match")
        self.assertEqual(result["authenticity_status"], "unknown")

    def test_synthetic_speech_escalates(self):
        result = assess_risk("Hello", {"deepfake": {"is_synthetic": True}})
        self.assertEqual(result["risk_level"], "high")

    def test_nonmatching_speaker_escalates(self):
        result = assess_risk("Hello", {"result": {"decision": "no_match"}})
        self.assertEqual(result["risk_level"], "high")

    def test_malformed_nested_checks_stay_unknown(self):
        result = assess_risk("Hello", {"result": None, "deepfake": []})
        self.assertEqual(result["authenticity_status"], "unknown")

    def test_movement_and_codes_get_specific_guidance(self):
        result = assess_risk("Tell me your OTP and follow me")
        self.assertIn("mobility aids", result["guidance"])
        self.assertIn("codes private", result["guidance"])


if __name__ == "__main__":
    unittest.main()
