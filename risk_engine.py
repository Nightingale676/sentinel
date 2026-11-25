"""Offline prototype guidance. Run without arguments for a saved-result demo."""

import argparse
import json
from pathlib import Path

from intent import extract_intent


def assess_risk(transcript, verification=None):
    """Use categorical verdicts; missing, failed, or conflicting checks stay unknown."""
    verification = verification if isinstance(verification, dict) else {}
    result = verification.get("result")
    result = result if isinstance(result, dict) else {}
    deepfake = verification.get("deepfake")
    deepfake = deepfake if isinstance(deepfake, dict) else {}
    speaker = result.get("decision", "unknown")
    if speaker not in ("match", "no_match") or verification.get("error"):
        speaker = "unknown"
    authenticity = "unknown"
    if not deepfake.get("error"):
        if deepfake.get("is_synthetic") is True:
            authenticity = "synthetic"
        elif (deepfake.get("is_synthetic") is False
              and deepfake.get("verdict") == "real"
              and deepfake.get("label") not in ("synthetic", "uncertain")):
            authenticity = "genuine"

    intent = extract_intent(transcript)
    actions = set(intent["intents"])
    reasons = []
    guidance = []
    level = "review"
    if speaker == "no_match":
        level = "high"
        reasons.append("Voice does not match the enrolled speaker.")
        guidance.append("Confirm who is speaking through a known contact method.")
    elif speaker == "unknown":
        reasons.append("Speaker verification is unavailable or inconclusive.")
    if authenticity == "synthetic":
        level = "high"
        reasons.append("The model flagged possible AI-generated speech.")
        guidance.append("Pause before acting and independently confirm the request.")
    elif authenticity == "unknown":
        reasons.append("Speech authenticity has not been established.")

    if "security_code_reference" in actions:
        level = "high"
        reasons.append("Speech mentions a password, PIN, or security code.")
        guidance.append("Keep security codes private. Check the request in the official service.")
    if "money_transfer" in actions:
        level = "high"
        reasons.append("Speech may concern a payment or money transfer.")
        guidance.append("Confirm the recipient and amount in your trusted banking app before any transfer.")
    if "movement_instruction" in actions:
        level = "high"
        reasons.append("Speech may contain a movement instruction.")
        guidance.append("Check your surroundings using your usual mobility aids or trusted assistance before moving.")
    if not transcript.strip():
        reasons.append("No transcript is available.")
        guidance.append("Ask for the instruction to be repeated clearly.")
    elif actions == {"unknown"}:
        reasons.append("The prototype could not identify the requested action.")
        guidance.append("Ask for clarification before acting.")
    if not guidance:
        guidance.append("Review the request and confirm any sensitive action independently.")
    return {
        "risk_level": level,
        "speaker_status": speaker,
        "authenticity_status": authenticity,
        "intent": intent,
        "reasons": reasons,
        "guidance": " ".join(guidance),
        "action_authorized": False,
        "limitations": "Prototype keyword rules can misread context. Voice matches and genuine speech do not establish that instructions are safe.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--text", help="Transcript to assess; checks are unknown unless a result file is supplied")
    parser.add_argument("--verification", type=Path, help="Saved combined verification JSON for this same recording")
    parser.add_argument("--demo", choices=("customer", "unknown", "synthetic"))
    args = parser.parse_args()
    if args.verification and not args.text:
        parser.error("--verification requires --text from the same recording")
    if args.demo and (args.text is not None or args.verification):
        parser.error("Use --demo separately from custom inputs")
    if args.text is not None:
        try:
            verification = json.loads(args.verification.read_text(encoding="utf-8")) if args.verification else None
        except (OSError, ValueError) as error:
            parser.exit(1, f"Could not read verification JSON: {error}\n")
        transcript = args.text
        source = "User-supplied text and saved checks; no API call made"
    else:
        demo = args.demo or "customer"
        transcript = "Hello, I would like to transfer 5000 rupees to my saved beneficiary."
        verification = {
            "result": {"decision": "no_match" if demo == "unknown" else "match"},
            "deepfake": {"is_synthetic": demo == "synthetic", "verdict": "fake" if demo == "synthetic" else "real"},
        }
        source = f"Offline {demo} demo: manually summarized prior verdicts; synthetic scenario is simulated"
    print("Source:", source)
    print(json.dumps(assess_risk(transcript, verification), indent=4))


if __name__ == "__main__":
    main()
