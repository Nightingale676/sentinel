"""Local Sentinel interface: python -m streamlit run app.py"""

import hashlib
import json
from pathlib import Path
import tempfile

import streamlit as st

from risk_engine import assess_risk
from sentinel import load_checks, speak, spoken_message
from transcription import transcribe_audio


ROOT = Path(__file__).resolve().parent
FORMATS = {".m4a": "audio/mp4", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".flac": "audio/flac", ".ogg": "audio/ogg"}

st.set_page_config(page_title="Sentinel | Auditory trust", page_icon="🛡️", layout="centered")
st.markdown("""<style>
.stApp {background:#0b1424;color:#edf3fa}
h1,h2,h3 {color:#edf3fa}
.stButton button {min-height:3rem;font-size:1rem}
div[data-testid="stMetric"] {background:#17253a;padding:1rem;border-radius:12px}
</style>""", unsafe_allow_html=True)
st.caption("SENTINEL · LOCAL PROTOTYPE")
st.title("Listen with more context")
st.write("Check a recording, understand the request, and hear guidance before acting.")
st.info("Local analysis · Saved voice checks · No DetectifAI credits used")

mode = st.radio("Choose an audio source", ["Project recording", "Upload recording"], horizontal=True)
audio_bytes = None
suffix = ".m4a"
name = ""
if mode == "Project recording":
    recordings = sorted(p for p in ROOT.iterdir() if p.is_file() and p.suffix.lower() in FORMATS)
    if recordings:
        selected = st.selectbox("Recording", recordings, format_func=lambda p: p.name,
                                index=next((i for i, p in enumerate(recordings) if p.name == "verify.m4a"), 0))
        audio_bytes, suffix, name = selected.read_bytes(), selected.suffix.lower(), selected.name
    else:
        st.warning("No recordings found. Upload one to begin.")
else:
    uploaded = st.file_uploader("Audio recording", type=["m4a", "wav", "mp3", "flac", "ogg"])
    if uploaded:
        if uploaded.size > 100 * 1024 * 1024:
            st.error("Choose a recording smaller than 100 MB.")
        else:
            audio_bytes, suffix, name = uploaded.getvalue(), Path(uploaded.name).suffix.lower(), uploaded.name

if audio_bytes:
    digest = hashlib.sha256(audio_bytes).hexdigest()
    # Changing inputs clears the old report so guidance cannot belong to another clip.
    if st.session_state.get("audio_digest") != digest:
        st.session_state.pop("analysis", None)
        st.session_state["audio_digest"] = digest
    st.audio(audio_bytes, format=FORMATS.get(suffix, "audio/mp4"))
    st.caption("Saved checks are used only when the recording's file hash matches. New recordings remain unverified.")
    if st.button("Analyze recording", type="primary", use_container_width=True):
        st.session_state.pop("analysis", None)
        with st.spinner("Transcribing and assessing the request. First use may download Whisper..."):
            try:
                with tempfile.TemporaryDirectory(prefix="sentinel-") as directory:
                    audio = Path(directory) / ("recording" + suffix)
                    audio.write_bytes(audio_bytes)
                    checks, source = None, "No matching saved checks. Identity and authenticity are unverified."
                    for saved_path in sorted((ROOT / "saved_checks").glob("*.json")):
                        try:
                            checks, source = load_checks(saved_path, audio)
                            break
                        except (ValueError, OSError, AttributeError):
                            continue
                    transcript = transcribe_audio(audio)
                    report = assess_risk(transcript, checks)
                st.session_state["analysis"] = {"name": name, "transcript": transcript,
                                                "source": source, "report": report}
            except Exception as error:
                st.error(f"Could not analyze the recording: {error}")
else:
    st.session_state.pop("analysis", None)

analysis = st.session_state.get("analysis")
if analysis:
    report = analysis["report"]
    st.divider()
    st.subheader("Your guidance")
    st.write(spoken_message(report))
    if st.button("Read guidance aloud", use_container_width=True):
        try:
            speak(spoken_message(report))
        except Exception as error:
            st.error(f"Speech output unavailable: {error}")
    st.caption("Speech plays through this Windows computer's selected audio output.")
    columns = st.columns(3)
    columns[0].metric("Speaker", report["speaker_status"].replace("_", " "))
    columns[1].metric("Speech", report["authenticity_status"])
    columns[2].metric("Action risk", report["risk_level"])
    st.caption("High action risk does not by itself mean fraud was detected.")
    st.subheader("What was said")
    st.write(analysis["transcript"] or "No speech transcribed.")
    st.subheader("Why this guidance")
    for reason in report["reasons"]:
        st.write("• " + reason)
    st.caption("Checks: " + analysis["source"])
    with st.expander("Intent and full assessment"):
        st.json(report)
    st.download_button("Download assessment", json.dumps(analysis, indent=2),
                       file_name="sentinel-assessment.json", mime="application/json")
st.divider()
st.caption("Prototype guidance. Voice matches and genuine speech do not establish that an instruction is safe. No action is authorized.")
