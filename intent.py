"""Local English keyword rules for a prototype; does not authorize actions."""

import argparse
import json
import re


NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40,
    "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
}


def extract_amounts(text):
    """Extract explicit rupee amounts, without guessing currency or missing amounts."""
    amounts = []
    numeric = r"\b(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:rupees?|inr)\b"
    for match in re.finditer(numeric, text):
        amounts.append({"value": float(match.group(1).replace(",", "")), "currency": "INR"})
    for match in re.finditer(r"(?:₹|\binr\s+)(\d+(?:,\d{3})*(?:\.\d{1,2})?)", text):
        amounts.append({"value": float(match.group(1).replace(",", "")), "currency": "INR"})
    words = "|".join(NUMBER_WORDS) + "|hundred|thousand|lakh|and"
    pattern = rf"\b((?:(?:{words})[\s-]+)+)rupees?\b"
    for match in re.finditer(pattern, text):
        total = current = 0
        for word in re.findall(r"[a-z]+", match.group(1)):
            if word in NUMBER_WORDS:
                current += NUMBER_WORDS[word]
            elif word == "hundred":
                current = (current or 1) * 100
            elif word in ("thousand", "lakh"):
                total += (current or 1) * (1000 if word == "thousand" else 100000)
                current = 0
        if total + current:
            amounts.append({"value": total + current, "currency": "INR"})
    return amounts


def extract_intent(transcript):
    text = transcript.lower().strip()
    rules = [
        ("money_transfer", r"\b(?:transfer|send|pay|payment)\b"),
        ("security_code_reference", r"\b(?:otp|one[ -]time password|pin|password|verification code)\b"),
        ("account_balance", r"\b(?:balance|balances)\b"),
        ("transaction_history", r"\b(?:transactions|transaction history)\b"),
        ("movement_instruction", r"\b(?:follow me|come with me|turn left|turn right|cross the road)\b"),
    ]
    intents = []
    evidence = {}
    for name, pattern in rules:
        matches = re.findall(pattern, text)
        if matches:
            intents.append(name)
            evidence[name] = matches
    return {
        "intents": intents or ["unknown"],
        "amounts": extract_amounts(text),
        "recipient_reference": "saved beneficiary" if "saved beneficiary" in text else None,
        "evidence": evidence,
        "requires_context_review": True,
        "method": "English keyword rules; may misread negation, quotes, or ambiguous speech",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("text", help="Transcript to analyze, in quotes")
    args = parser.parse_args()
    print(json.dumps(extract_intent(args.text), indent=4))
