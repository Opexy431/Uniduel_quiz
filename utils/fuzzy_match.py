from thefuzz import fuzz


def best_match(transcript: str, correct_answer: str, alternatives: list = None, threshold: int = 85) -> dict:
    """
    Compare a spoken transcript against the correct answer AND any accepted
    alternative phrasings (e.g. "14.7" vs "14.7 Newtons"). Returns whether it
    passed and the best similarity score found across all candidates.
    """
    cleaned_transcript = transcript.strip().lower()
    candidates = [correct_answer] + (alternatives or [])

    best_score = 0
    for candidate in candidates:
        score = fuzz.ratio(cleaned_transcript, candidate.strip().lower())
        best_score = max(best_score, score)

    return {
        "correct": best_score >= threshold,
        "score": best_score,
        "transcript": cleaned_transcript,
    }