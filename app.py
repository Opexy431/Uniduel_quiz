import io
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify
from groq import Groq

from routes.api import api_bp

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def load_questions():
    questions_path = BASE_DIR / "data" / "university_duel_2026_question_bank.json"
    with open(questions_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    questions = {}
    for section in raw.get("sections", []):
        section_name = section.get("section_name")
        for q in section.get("questions", []):
            questions[q["id"]] = {**q, "section": section_name}

    return questions


def create_app():
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config["QUESTIONS"] = load_questions()
    app.register_blueprint(api_bp)

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/transcribe", methods=["POST"])
    def transcribe():
        if "audio" not in request.files:
            return jsonify({"error": "No audio file received"}), 400

        audio_file = request.files["audio"]
        audio_bytes = audio_file.read()

        if len(audio_bytes) == 0:
            return jsonify({"error": "Audio file is empty"}), 400

        try:
            transcription = groq_client.audio.transcriptions.create(
                file=("answer.webm", io.BytesIO(audio_bytes), "audio/webm"),
                model="whisper-large-v3-turbo",
                language="en",
                response_format="text",
            )
            return jsonify({"transcript": transcription.strip()})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)