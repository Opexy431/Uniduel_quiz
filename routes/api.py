import random

from flask import Blueprint, current_app, jsonify, request

from utils.fuzzy_match import best_match

api_bp = Blueprint("api", __name__)


@api_bp.route("/get-sections", methods=["GET"])
def get_sections():
    questions = current_app.config["QUESTIONS"]
    counts = {}
    for q in questions.values():
        section = q.get("section", "Unknown")
        counts[section] = counts.get(section, 0) + 1
    sections = [{"name": name, "count": count} for name, count in counts.items()]
    return jsonify(sections)


@api_bp.route("/get-pool", methods=["POST"])
def get_pool():
    data = request.get_json(silent=True) or {}
    section = data.get("section")
    total = max(10, min(70, int(data.get("total", 10))))

    questions = current_app.config["QUESTIONS"]
    if section:
        pool = [k for k, v in questions.items() if v.get("section") == section]
    else:
        pool = list(questions.keys())

    random.shuffle(pool)

    result = []
    while len(result) < total:
        result.extend(pool)
    result = result[:total]

    return jsonify({"pool": result})


@api_bp.route("/get-question", methods=["GET"])
def get_question():
    questions = current_app.config["QUESTIONS"]
    question_id = request.args.get("id")

    if not question_id or question_id not in questions:
        return jsonify({"error": "Invalid question id"}), 400

    question = questions[question_id]
    payload = {
        "id": question_id,
        "question": question["question"],
        "section": question.get("section"),
    }
    if "options" in question:
        payload["options"] = question["options"]
    return jsonify(payload)


@api_bp.route("/submit-answer", methods=["POST"])
def submit_answer():
    data = request.get_json(silent=True) or {}
    question_id = data.get("id")
    transcript = data.get("transcript", "")

    questions = current_app.config["QUESTIONS"]
    if question_id not in questions:
        return jsonify({"error": "Invalid question id"}), 400

    question = questions[question_id]
    result = best_match(
        transcript,
        question["answer"],
        question.get("acceptable_alternatives"),
    )
    result["correct_answer"] = question["answer"]
    return jsonify(result)