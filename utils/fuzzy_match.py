from thefuzz import fuzz


def best_match(transcript: str, correct_answer: str, alternatives: list = None, threshold: int = 85) -> dict:
    cleaned_transcript = transcript.strip().lower()
    candidates = [correct_answer] + (alternatives or [])

    best_score = 0
    for candidate in candidates:
        cleaned_candidate = candidate.strip().lower()

        # exact substring match — if the answer appears anywhere in what
        # the user said, count it as correct regardless of extra words
        if cleaned_candidate in cleaned_transcript:
            return {
                "correct": True,
                "score": 100,
                "transcript": cleaned_transcript,
            }

        # also check the other way — if transcript is contained in answer
        # handles cases where user says a shorter version
        if cleaned_transcript in cleaned_candidate:
            return {
                "correct": True,
                "score": 100,
                "transcript": cleaned_transcript,
            }

        # fall back to fuzzy ratio for close but not exact matches
        score = fuzz.ratio(cleaned_transcript, cleaned_candidate)
        best_score = max(best_score, score)

    return {
        "correct": best_score >= threshold,
        "score": best_score,
        "transcript": cleaned_transcript,
    }