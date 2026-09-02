(() => {
  // ── HISTORY ─────────────────────────────────────────────────────────────
  const HISTORY_KEY = "upq_history";

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
  }

  function saveAttempt(attempt) {
    const history = loadHistory();
    history.unshift(attempt);
    if (history.length > 10) history.splice(10);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  function renderHistory() {
    const history = loadHistory();
    const list = document.getElementById("history-list");
    const empty = document.getElementById("history-empty");
    list.innerHTML = "";
    if (!history.length) { empty.hidden = false; return; }
    empty.hidden = true;
    history.forEach(h => {
      const li = document.createElement("li");
      const timerLabel = h.timed ? `${h.timerSecs}s` : "untimed";
      li.innerHTML = `
        <span class="history-course">${h.section}</span>
        <span class="history-meta">${h.correct}/${h.total} · ${timerLabel} · ${h.date}</span>
      `;
      list.appendChild(li);
    });
  }

  // ── ICONS ────────────────────────────────────────────────────────────────
  const ICONS = {
    "Applied Mathematics": "🧮",
    "Data Analysis & Statistics": "📊",
    "Verbal Reasoning & Analogies": "💬",
    "General Knowledge & Duel Trivia": "🏆",
  };

  // ── STATE ────────────────────────────────────────────────────────────────
  const state = {
    selectedSection: null,
    roundSize: 10,
    roundTimeMins: 30,
    timed: false,
    timerSecs: 10,
    pool: [],
    poolIndex: 0,
    questionId: null,
    questionCount: 0,
    correctCount: 0,
    sessionStart: null,
    sessionInterval: null,
    qTimerInterval: null,
    answering: false,
    recording: false,
  };

  const el = id => document.getElementById(id);

  // ── SETUP SCREEN ─────────────────────────────────────────────────────────
  async function initSetup() {
    renderHistory();

    el("history-toggle").addEventListener("click", () => {
      const panel = el("history-panel");
      panel.hidden = !panel.hidden;
      renderHistory();
    });

    try {
      const sections = await API.getSections();
      const grid = el("course-grid");
      grid.innerHTML = "";
      sections.forEach(s => {
        const card = document.createElement("button");
        card.className = "course-card";
        card.type = "button";
        card.dataset.section = s.name;
        card.innerHTML = `
          <div class="course-icon">${ICONS[s.name] || "📚"}</div>
          <p class="course-name">${s.name}</p>
          <p class="course-count">${s.count} questions</p>
        `;
        card.addEventListener("click", () => selectCourse(s.name));
        grid.appendChild(card);
      });
    } catch {
      el("course-grid").innerHTML = `<p class="loading-courses">Couldn't load courses — is Flask running?</p>`;
    }

    el("round-slider").addEventListener("input", e => {
      state.roundSize = parseInt(e.target.value);
      el("round-value").textContent = state.roundSize;
    });

    el("round-time-slider").addEventListener("input", e => {
      state.roundTimeMins = parseInt(e.target.value);
      el("round-time-value").textContent = `${state.roundTimeMins} min`;
    });

    el("timed-toggle").addEventListener("change", e => {
      state.timed = e.target.checked;
      el("timed-options").hidden = !state.timed;
    });

    el("timer-slider").addEventListener("input", e => {
      state.timerSecs = parseInt(e.target.value);
      el("timer-value").textContent = `${state.timerSecs}s`;
    });

    el("start-btn").addEventListener("click", startCountdown);
  }

  function selectCourse(name) {
    state.selectedSection = name;
    document.querySelectorAll(".course-card").forEach(c => {
      c.classList.toggle("selected", c.dataset.section === name);
    });
    el("start-btn").disabled = false;
    el("start-btn").textContent = `Start — ${name.split(" ")[0]}`;
  }

  // ── COUNTDOWN OVERLAY ────────────────────────────────────────────────────
  function startCountdown() {
    el("screen-setup").hidden = true;
    el("overlay-countdown").hidden = false;
    let n = 5;
    el("countdown-number").textContent = n;

    const tick = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(tick);
        el("overlay-countdown").hidden = true;
        startPractice();
      } else {
        el("countdown-number").textContent = n;
      }
    }, 1000);
  }

  // ── PRACTICE SCREEN ──────────────────────────────────────────────────────
  async function startPractice() {
    state.questionCount = 0;
    state.correctCount = 0;
    state.answering = false;
    state.recording = false;

    try {
      const data = await API.getPool(state.selectedSection, state.roundSize);
      state.pool = data.pool;
      state.poolIndex = 0;
    } catch {
      alert("Couldn't build question pool — is Flask running?");
      showSetup();
      return;
    }

    // countdown session timer
    const totalSecs = state.roundTimeMins * 60;
    state.sessionStart = Date.now();
    clearInterval(state.sessionInterval);
    state.sessionInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.sessionStart) / 1000);
      const remaining = Math.max(0, totalSecs - elapsed);
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      el("session-timer").textContent =
        String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      if (remaining <= 0) {
        clearInterval(state.sessionInterval);
        finishRound();
      }
    }, 1000);

    el("screen-practice").hidden = false;
    el("q-timer-wrap").hidden = !state.timed;

    el("back-btn").onclick = () => {
      if (confirm("End this round and go back?")) {
        clearInterval(state.sessionInterval);
        clearInterval(state.qTimerInterval);
        showSetup();
      }
    };

    el("mic-btn").onclick = handleMicClick;

    // ── TYPING INPUT ──
    el("answer-input").value = "";
    el("answer-input").disabled = false;

    el("submit-btn").onclick = () => {
      const typed = el("answer-input").value.trim();
      if (!typed || state.answering) return;
      state.answering = true;
      clearInterval(state.qTimerInterval);
      el("answer-input").disabled = true;
      handleTranscript(typed);
    };

    el("answer-input").onkeydown = (e) => {
      if (e.key === "Enter") el("submit-btn").click();
    };

    loadNextQuestion();
  }

  // ── LOAD QUESTION ────────────────────────────────────────────────────────
  async function loadNextQuestion() {
    state.answering = false;
    state.recording = false;
    clearInterval(state.qTimerInterval);

    if (state.poolIndex >= state.pool.length) {
      finishRound();
      return;
    }

    const qId = state.pool[state.poolIndex];
    state.poolIndex++;
    state.questionCount++;

    el("card").classList.remove("is-correct", "is-incorrect");
    el("status").textContent = "";
    el("status").className = "status";
    el("hint").textContent = "Type your answer or tap the mic";
    el("score").textContent = `${state.correctCount} / ${state.questionCount - 1 || 0}`;
    el("progress").textContent = "Loading…";
    el("question-text").textContent = "Loading…";
    el("mic-btn").classList.remove("listening");
    el("answer-input").value = "";
    el("answer-input").disabled = false;
    el("answer-input").focus();

    try {
      const q = await API.getQuestion(qId);
      state.questionId = q.id;
      el("progress").textContent = `${q.section} · ${state.questionCount} of ${state.roundSize}`;
      el("question-text").textContent = q.question;

      el("options").innerHTML = "";
      if (q.options && q.options.length) {
        const letters = ["A","B","C","D","E","F"];
        q.options.forEach((opt, i) => {
          const li = document.createElement("li");
          li.innerHTML = `<span class="opt-letter">${letters[i]}</span>${opt}`;
          el("options").appendChild(li);
        });
        el("options").hidden = false;
      } else {
        el("options").hidden = true;
      }

      if (state.timed) startQTimer();
    } catch {
      el("hint").textContent = "Couldn't load question — try going back.";
    }
  }

  // ── PER-QUESTION TIMER ───────────────────────────────────────────────────
  function startQTimer() {
    const bar = el("q-timer-bar");
    bar.style.transition = "none";
    bar.style.width = "100%";
    bar.classList.remove("urgent");

    const total = state.timerSecs * 1000;
    const start = Date.now();

    requestAnimationFrame(() => {
      bar.style.transition = `width ${state.timerSecs}s linear`;
      bar.style.width = "0%";
    });

    state.qTimerInterval = setInterval(() => {
      const remaining = total - (Date.now() - start);
      if (remaining <= total * 0.3) bar.classList.add("urgent");
      if (remaining <= 0) {
        clearInterval(state.qTimerInterval);
        if (!state.answering) timeOut();
      }
    }, 200);
  }

  function timeOut() {
    state.answering = true;
    el("answer-input").disabled = true;
    el("card").classList.add("is-incorrect");
    el("status").textContent = "Time's up!";
    el("status").className = "status incorrect";
    el("hint").textContent = "Moving to next question…";
    setTimeout(loadNextQuestion, 1800);
  }

  // ── TRANSCRIPT HANDLER ───────────────────────────────────────────────────
  async function handleTranscript(transcript) {
    el("hint").textContent = `You answered: "${transcript}"`;
    try {
      const result = await API.submitAnswer(state.questionId, transcript);

      if (result.correct) {
        state.correctCount++;
        el("card").classList.add("is-correct");
        el("status").textContent = "Correct ✓";
        el("status").className = "status correct";
      } else {
        el("card").classList.add("is-incorrect");
        el("status").textContent = `Not quite — answer: ${result.correct_answer}`;
        el("status").className = "status incorrect";
      }

      el("score").textContent = `${state.correctCount} / ${state.questionCount}`;
      setTimeout(loadNextQuestion, 1800);
    } catch {
      el("hint").textContent = "Couldn't check answer — try again.";
      state.answering = false;
      el("answer-input").disabled = false;
    }
  }

  // ── MIC ──────────────────────────────────────────────────────────────────
  function handleMicClick() {
    if (state.answering) return;

    if (!Speech.isSupported()) {
      el("hint").textContent = "Microphone not supported — try Chrome or Firefox.";
      return;
    }

    if (state.recording) {
      state.recording = false;
      el("mic-btn").classList.remove("listening");
      el("hint").textContent = "Processing…";
      Speech.stopListening();
      return;
    }

    state.recording = true;
    el("mic-btn").classList.add("listening");
    el("hint").textContent = "Listening… speak now";

    Speech.startListening({
      onResult: async (transcript) => {
        state.recording = false;
        el("mic-btn").classList.remove("listening");
        if (state.answering) return;
        state.answering = true;
        clearInterval(state.qTimerInterval);
        el("answer-input").disabled = true;
        await handleTranscript(transcript);
      },
      onError: (err) => {
        state.recording = false;
        el("mic-btn").classList.remove("listening");
        const messages = {
          "not-allowed": "Mic blocked — allow microphone access in your browser and refresh.",
          "not-supported": "Microphone not supported — try Chrome or Firefox.",
          "network": "Network error sending audio — check your connection.",
          "mic-error": "Couldn't access mic — check it's not in use by another app.",
        };
        el("hint").textContent = messages[err] || `Error: ${err} — tap mic to retry.`;
      },
    });
  }

  // ── FINISH ROUND ─────────────────────────────────────────────────────────
  function finishRound() {
    clearInterval(state.sessionInterval);
    clearInterval(state.qTimerInterval);

    const pct = Math.round((state.correctCount / state.roundSize) * 100);
    const timerLabel = state.timed ? `${state.timerSecs}s timer` : "untimed";
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });

    saveAttempt({
      section: state.selectedSection,
      correct: state.correctCount,
      total: state.roundSize,
      timed: state.timed,
      timerSecs: state.timerSecs,
      date: dateStr,
    });

    el("results-score").textContent = `${state.correctCount} / ${state.roundSize}`;
    el("results-meta").textContent =
      `${pct}% accuracy · ${state.selectedSection} · ${timerLabel} · ${state.roundTimeMins}min round`;
    el("overlay-results").hidden = false;

    el("results-again").onclick = () => {
      el("overlay-results").hidden = true;
      el("screen-practice").hidden = true;
      startCountdown();
    };

    el("results-change").onclick = () => {
      el("overlay-results").hidden = true;
      el("screen-practice").hidden = true;
      showSetup();
    };
  }

  // ── SHOW SETUP ───────────────────────────────────────────────────────────
  function showSetup() {
    el("screen-setup").hidden = false;
    el("screen-practice").hidden = true;
    el("overlay-results").hidden = true;
    el("overlay-countdown").hidden = true;
    renderHistory();
  }

  initSetup();
})();