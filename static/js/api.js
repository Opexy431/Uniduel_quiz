const API = {
  async getSections() {
    const res = await fetch("/get-sections");
    if (!res.ok) throw new Error("Failed to load sections");
    return res.json();
  },

  async getPool(section, total) {
    const res = await fetch("/get-pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, total }),
    });
    if (!res.ok) throw new Error("Failed to build question pool");
    return res.json();
  },

  async getQuestion(questionId) {
    const res = await fetch(`/get-question?id=${encodeURIComponent(questionId)}`);
    if (!res.ok) throw new Error("Failed to load question");
    return res.json();
  },

  async submitAnswer(id, transcript) {
    const res = await fetch("/submit-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, transcript }),
    });
    if (!res.ok) throw new Error("Failed to submit answer");
    return res.json();
  },
};