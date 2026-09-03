# University Practice Questions — Voice & Text Quiz App

## What This Is

University Practice Questions is a web-based exam preparation tool built for fast, focused drilling. It presents questions from a structured question bank and lets you answer either by speaking out loud or typing — making it usable whether you're at a desk or studying hands-free. The system checks your answer instantly using intelligent fuzzy matching, meaning you don't have to say or type the answer word-for-word perfectly for it to count as correct.

The app was built specifically for university-level competitive exam preparation, with the question bank organized into four subject areas: Applied Mathematics, Data Analysis & Statistics, Verbal Reasoning & Analogies, and General Knowledge & Duel Trivia.

---

## The Problem It Solves

Traditional flashcard and quiz apps require you to either tap a multiple-choice option or type a full exact answer. Both approaches slow you down and break your study rhythm. Reading through options and clicking takes time. Typing exact answers fails the moment you phrase something slightly differently from what the system expects.

This app removes both bottlenecks. You speak or type naturally, and the system figures out if you're right — even if you said "sahara desert" instead of "sahara", or "14.7" instead of "14.7 newtons". The goal is to make the question-answer loop as fast and frictionless as possible, so you can get through as many questions as possible in a session without the tool getting in your way.

---

## How It Works — The Full Flow

### 1. Setup Screen
When you open the app, you land on the setup screen. Here you:

- **Pick a subject** from the four course cards. Each card shows the subject name and how many questions are in that pool.
- **Set how many questions** you want in your round using the Questions Per Round slider (minimum 10, maximum 70).
- **Set a round time limit** using the Round Time Limit slider (10 minutes to 60 minutes / 1 hour). This is the total time you have to complete your round. The timer counts down from whatever you choose and ends the round automatically when it hits zero — this creates urgency and trains faster recall.
- **Toggle timed mode** if you want a per-question countdown bar. When switched on, a seconds-per-question slider appears (5 to 20 seconds). This runs a draining bar under each question — when it hits zero, the question is marked wrong and the next one loads automatically.
- **View your history** by tapping the History button in the top right. This reveals your last 10 practice attempts, showing the subject, your score, timer settings, and date.

### 2. Starting Now Countdown
After tapping Start, a 5-second fullscreen countdown appears before the first question loads. This gives you a moment to mentally prepare and position yourself before the round begins.

### 3. Practice Screen
Each question appears on a paper-styled card with the subject and question number shown above it (e.g. "Applied Mathematics · Question 3 of 20"). You answer using whichever method suits you:

- **Type your answer** in the input box and press Enter or tap Submit
- **Tap the mic button**, speak your answer, and stop speaking — the mic auto-detects when you've gone quiet for about 2 seconds and sends your audio automatically

The card flashes green with a "Correct ✓" message for right answers, or red with the correct answer shown for wrong ones. After 1.8 seconds it moves to the next question automatically. The session countdown timer runs in the top right corner throughout.

### 4. Results Popup
When you finish all your questions or the round timer hits zero, a results popup appears showing your score, accuracy percentage, subject, timer settings, and round duration. You can either practice again with the same settings or go back and change your course.

---

## How Answers Are Checked — The Fuzzy Matching System

This is one of the most important parts of the app. Answers are not checked for exact matches. Instead, the backend uses a two-layer checking system:

**Layer 1 — Substring match:** If the correct answer appears anywhere inside what you said or typed, it counts as correct immediately. This handles the most common natural speech patterns:
- Correct answer: "sahara" → You say: "sahara desert" → ✓ Pass
- Correct answer: "14.7 newtons" → You say: "14.7" → ✓ Pass
- Correct answer: "mitochondria" → You say: "the mitochondria" → ✓ Pass

**Layer 2 — Fuzzy ratio:** If neither string contains the other, the system calculates a similarity score between what you said and the correct answer. A score of 85% or above counts as correct. This handles minor mispronunciations, transcription quirks, and slight wording differences.

**Acceptable alternatives:** Each question in the question bank can also store a list of accepted alternative phrasings. These get checked the same way as the primary answer. So if a question has "sodium chloride" as the answer but "NaCl" as an alternative, either phrasing passes.

---

## Voice Transcription — Groq Whisper

Instead of using the browser's built-in Web Speech API (which is unreliable, accent-sensitive, and requires an active internet connection to Google's servers), the app uses **Groq's hosted Whisper Large V3 Turbo model** for voice transcription.

When you tap the mic:
1. The browser records your audio using the MediaRecorder API
2. Silence detection monitors your audio in real time — when you stop speaking for about 1.8 seconds, recording stops automatically (no need to tap again)
3. There is also a hard cap of 15 seconds in case you forget to speak
4. The recorded audio is sent to a Flask route (`/transcribe`) which forwards it to Groq's API
5. Groq returns a clean text transcript in under a second
6. That transcript goes through the fuzzy matching system exactly like a typed answer would

Groq's free tier allows 2,000 audio requests per day and 7,200 seconds of audio per hour — more than enough for intensive solo study sessions.

---

## The Question Bank

Questions are stored in a single JSON file (`data/questions.json`) loaded into Flask memory at startup. The file has a simple nested structure:

```json
{
  "tournament": "University Duel 2026",
  "total_questions": 200,
  "sections": [
    {
      "section_name": "Applied Mathematics",
      "questions": [
        {
          "id": "AM_001",
          "question": "What is the weight of a 1.5kg object?",
          "answer": "14.7 Newtons",
          "acceptable_alternatives": ["14.7", "14.7N"],
          "time_limit_seconds": 10
        }
      ]
    }
  ]
}
```

To add new subjects or questions, add a new section object inside the `sections` array with a unique `section_name`, and add question objects with unique IDs that don't clash with existing ones.

---

## The Backend — Flask

The backend is a lightweight Flask application (`app.py`) that serves both the HTML frontend and the API routes. It loads the question bank once at startup and holds it in memory — no database needed for questions.

The four main API routes are:

| Route | Method | What it does |
|---|---|---|
| `/get-sections` | GET | Returns all section names and question counts for the setup screen course cards |
| `/get-pool` | POST | Takes a section name and round size, returns a shuffled list of question IDs with no repeats until the full pool is exhausted |
| `/get-question` | GET | Takes a question ID, returns the question text and section (without the answer) |
| `/submit-answer` | POST | Takes a question ID and transcript, runs fuzzy matching, returns correct/incorrect and the right answer |
| `/transcribe` | POST | Takes an audio file, sends it to Groq's Whisper API, returns the transcript |

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend | Flask (Python) | Lightweight, easy to deploy, handles JSON routing cleanly |
| Frontend | HTML + CSS + Vanilla JS | No build step, no framework overhead, fast to iterate |
| Voice transcription | Groq Whisper Large V3 Turbo | Fast, accurate, free tier available, no RAM cost on server |
| Fuzzy matching | thefuzz + rapidfuzz | Tolerates natural speech variation without manual synonym lists |
| Deployment | Render (free tier) | One-command deploy from GitHub, HTTPS included, no server management |
| History storage | Browser localStorage | No login required, persists across sessions on the same device |

---

## Project Structure

```
voice-quiz-app/
├── app.py                    # Flask app factory, loads questions, registers routes
├── requirements.txt          # Python dependencies
├── .env                      # Local environment variables (never committed)
├── data/
│   └── questions.json        # The full question bank
├── routes/
│   ├── __init__.py
│   └── api.py                # All API routes
├── utils/
│   ├── __init__.py
│   └── fuzzy_match.py        # Answer checking logic
├── templates/
│   └── index.html            # The single HTML page (Flask renders this)
└── static/
    ├── css/
    │   └── style.css         # All styling
    └── js/
        ├── api.js            # Fetch wrappers for the Flask routes
        ├── speech.js         # MediaRecorder + silence detection
        └── quiz.js           # Main controller — state, UI, question flow
```

---

## Running Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Add your Groq API key to .env
echo "GROQ_API_KEY=your_key_here" > .env

# Start the server
python app.py
```

Then open `http://localhost:5000` in Chrome or Firefox.

---

## Deploying to Render

1. Push the project to a GitHub repository (make sure `.env` is in `.gitignore`)
2. Create a new Web Service on [render.com](https://render.com)
3. Connect your GitHub repo
4. Set Build Command to `pip install -r requirements.txt`
5. Set Start Command to `gunicorn app:app`
6. Add environment variable: `GROQ_API_KEY` = your Groq key
7. Deploy

Render provides HTTPS automatically, which is required for microphone access in the browser.

---

## Design Decisions Worth Noting

**No login or accounts.** History is stored in the browser's localStorage. This keeps the app completely frictionless — open it and start studying immediately. The tradeoff is that history doesn't carry across devices.

**One Flask service serves everything.** The HTML, CSS, JS, and API all come from the same Flask app. This means one service to deploy, no CORS configuration, and no separate frontend build pipeline.

**Shuffle without repeat.** When a round starts, the backend generates a shuffled pool of question IDs for the chosen section. The frontend works through that list in order. If you pick more questions than the pool has (e.g. 70 questions from a 50-question section), the pool cycles through a second shuffle before repeating — so you never see the same question twice in a row.

**Silence detection instead of a stop button.** The mic records until it detects 1.8 seconds of silence, then stops and sends automatically. This keeps the flow fast — speak your answer, pause, next question loads. No second tap required.
