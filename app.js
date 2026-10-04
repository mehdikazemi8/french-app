import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Replace these with your project's URL and anon key before publishing.
const SUPABASE_URL = "https://mvzyyejtdcmfjwulcong.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZQ0WeRz9hrRuxVYaR-xrFQ_MZuIJoYl";

const SENTENCE_COUNT = 3;
const DAILY_VERB_COUNT = 10;
const DAILY_START = "2026-10-04";
const POINTS_PER_CORRECT = 10;
const USERNAME_KEY = "username";
const LEVEL_RANK = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

let verbs = [];
let currentVerb = null;
let sentenceIndex = 0;
let mode = "practice";
let dailyQuestions = [];
let dailyQuestionIndex = 0;
let score = 0;
let username = "";

const loadingEl = document.getElementById("loading");
const usernameScreen = document.getElementById("username-screen");
const usernameForm = document.getElementById("username-form");
const usernameInput = document.getElementById("username-input");
const homeEl = document.getElementById("home");
const currentUsernameEl = document.getElementById("current-username");
const changeNameBtn = document.getElementById("change-name");
const dailyBtn = document.getElementById("daily-btn");
const practiceBtn = document.getElementById("practice-btn");
const quizContainer = document.getElementById("quiz-container");
const quitBtn = document.getElementById("quit-btn");
const scoreLine = document.getElementById("score-line");
const verbPromptEl = document.getElementById("verb-prompt");
const sentenceProgressEl = document.getElementById("sentence-progress");
const sentencePromptEl = document.getElementById("sentence-prompt");
const formEl = document.getElementById("answer-form");
const inputEl = document.getElementById("user-input");
const feedbackEl = document.getElementById("feedback");
const aiLinksEl = document.getElementById("ai-links");
const chatgptLinkEl = document.getElementById("chatgpt-link");
const translateLinkEl = document.getElementById("translate-link");
const nextBtn = document.getElementById("next-btn");
const leaderboardEl = document.getElementById("leaderboard");
const leaderboardDateEl = document.getElementById("leaderboard-date");
const leaderboardStatusEl = document.getElementById("leaderboard-status");
const leaderboardListEl = document.getElementById("leaderboard-list");
const leaderboardHomeBtn = document.getElementById("leaderboard-home");

const EXPLAIN_PROMPT =
  "Translate this sentence to English and explain the grammatical structure of it briefly.";

function isSupabaseConfigured() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("YOUR_PROJECT") &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes("YOUR_ANON_KEY")
  );
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function levelRank(level) {
  return LEVEL_RANK[level] ?? 99;
}

function sortVerbsByLevel(list) {
  return list
    .slice()
    .sort((a, b) => levelRank(a.level) - levelRank(b.level));
}

function daysSinceDailyStart(date) {
  const start = Date.parse(`${DAILY_START}T00:00:00Z`);
  const current = Date.parse(`${date}T00:00:00Z`);
  return Math.floor((current - start) / 86400000);
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, random) {
  const items = list.slice();
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = items[i];
    items[i] = items[j];
    items[j] = swap;
  }
  return items;
}

function pickDailyVerbs(list, date, count) {
  if (!list.length) return [];

  const windows = Math.ceil(list.length / count);
  const day =
    ((daysSinceDailyStart(date) % windows) + windows) % windows;
  const start = day * count;
  const picked = [];

  for (let i = 0; i < count && i < list.length; i++) {
    picked.push(list[(start + i) % list.length]);
  }

  return picked;
}

function buildDailyQuestions(pickedVerbs, date) {
  const random = mulberry32(hashString(`passe-compose-questions:${date}`));
  const groups = pickedVerbs.map((verb) => ({
    verb,
    sentences: shuffle(
      Array.from({ length: SENTENCE_COUNT }, (_, index) => index),
      random,
    ),
  }));
  const questions = [];
  const total = pickedVerbs.length * SENTENCE_COUNT;

  while (questions.length < total) {
    const lastVerb = questions.at(-1)?.verb;
    const remaining = groups.filter((group) => group.sentences.length);
    const maxCount = Math.max(
      ...remaining.map((group) => group.sentences.length),
    );
    let pool = remaining.filter(
      (group) => group.sentences.length === maxCount && group.verb !== lastVerb,
    );
    if (!pool.length) {
      pool = remaining.filter((group) => group.verb !== lastVerb);
    }
    if (!pool.length) pool = remaining;

    const group = pool[Math.floor(random() * pool.length)];
    questions.push({
      verb: group.verb,
      sentenceIndex: group.sentences.pop(),
    });
  }

  return questions;
}

function cleanUsername(value) {
  return value.trim().replace(/\s+/g, " ").slice(0, 32);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalize(text) {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function showScreen(screen) {
  for (const el of [
    loadingEl,
    usernameScreen,
    homeEl,
    quizContainer,
    leaderboardEl,
  ]) {
    el.classList.add("hidden");
  }
  screen.classList.remove("hidden");
}

function showHome() {
  currentUsernameEl.textContent = username;
  showScreen(homeEl);
}

function currentSentence() {
  const n = sentenceIndex + 1;
  return {
    sentence: currentVerb[`sentence_${n}`],
    answer: currentVerb[`answer_${n}`],
  };
}

function dailyQuestionNumber() {
  return dailyQuestionIndex + 1;
}

function dailyQuestionTotal() {
  return dailyQuestions.length;
}

function isLastDailyQuestion() {
  return mode === "daily" && dailyQuestionIndex === dailyQuestions.length - 1;
}

function renderSentence(sentence) {
  const html = sentence.replace(
    /_{2,}/g,
    '<span class="blank" aria-hidden="true"></span>',
  );
  sentencePromptEl.innerHTML = html;
}

function completedSentence(sentence, answer) {
  const parts = answer.trim().split(/\s+/);
  const blanks = sentence.match(/_{2,}/g) || [];
  let partIndex = 0;
  const filled =
    blanks.length === parts.length
      ? sentence.replace(/_{2,}/g, () => parts[partIndex++])
      : sentence.replace(/_{2,}/, answer);

  return filled
    .replace(/\s*\([^)]+\)/g, "")
    .replace(/J'\s+/gi, "J'")
    .replace(/\s+/g, " ")
    .trim();
}

function googleTranslateUrl(text) {
  const encoded = encodeURIComponent(text);
  return `https://translate.google.com/?sl=fr&tl=en&text=${encoded}&op=translate`;
}

function explainPrompt(sentence) {
  return `${EXPLAIN_PROMPT}\n\n"${sentence}"`;
}

function resetAnswerUi() {
  inputEl.value = "";
  inputEl.disabled = false;
  formEl.querySelector("button").classList.remove("hidden");
  feedbackEl.classList.add("hidden");
  aiLinksEl.classList.add("hidden");
  chatgptLinkEl.removeAttribute("href");
  translateLinkEl.classList.add("hidden");
  translateLinkEl.removeAttribute("href");
  nextBtn.classList.add("hidden");
  inputEl.focus();
}

function showCurrentSentence() {
  const { sentence } = currentSentence();

  verbPromptEl.textContent = currentVerb.infinitive;
  if (mode === "daily") {
    sentenceProgressEl.textContent = `${dailyQuestionNumber()} / ${dailyQuestionTotal()}`;
    scoreLine.textContent = `Score: ${score}`;
    scoreLine.classList.remove("hidden");
  } else {
    sentenceProgressEl.textContent = `${sentenceIndex + 1} / ${SENTENCE_COUNT}`;
    scoreLine.classList.add("hidden");
  }

  renderSentence(sentence);
  resetAnswerUi();
}

function loadNextVerb() {
  const randomIndex = Math.floor(Math.random() * verbs.length);
  currentVerb = verbs[randomIndex];
  sentenceIndex = 0;
  showCurrentSentence();
}

function startPractice() {
  mode = "practice";
  showScreen(quizContainer);
  loadNextVerb();
}

async function findTodayScore() {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("daily_scores")
    .select("score")
    .eq("date", todayUtc())
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  return data;
}

async function startDaily() {
  dailyBtn.disabled = true;
  try {
    const existing = await findTodayScore();
    if (existing) {
      await showLeaderboard(`You already scored ${existing.score} today.`);
      return;
    }

    mode = "daily";
    score = 0;
    dailyQuestions = buildDailyQuestions(
      pickDailyVerbs(verbs, todayUtc(), DAILY_VERB_COUNT),
      todayUtc(),
    );
    dailyQuestionIndex = 0;
    showScreen(quizContainer);
    showDailyQuestion();
  } finally {
    dailyBtn.disabled = false;
  }
}

function showDailyQuestion() {
  const question = dailyQuestions[dailyQuestionIndex];
  currentVerb = question.verb;
  sentenceIndex = question.sentenceIndex;
  showCurrentSentence();
}

function goToNext() {
  if (mode === "daily") {
    if (dailyQuestionIndex < dailyQuestions.length - 1) {
      dailyQuestionIndex += 1;
      showDailyQuestion();
    }
    return;
  }

  if (sentenceIndex < SENTENCE_COUNT - 1) {
    sentenceIndex += 1;
    showCurrentSentence();
    return;
  }

  loadNextVerb();
}

async function renderLeaderboard() {
  leaderboardListEl.innerHTML = "";

  if (!supabase) return;

  const { data, error } = await supabase
    .from("daily_scores")
    .select("username, score")
    .eq("date", todayUtc())
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(10);

  if (error || !data) {
    leaderboardStatusEl.textContent = "Could not load the leaderboard.";
    console.error(error);
    return;
  }

  if (!data.length) {
    leaderboardListEl.innerHTML = "<li class='empty'>No scores yet.</li>";
    return;
  }

  leaderboardListEl.innerHTML = data
    .map((row, index) => {
      const mine = row.username === username ? " me" : "";
      return `<li class="${mine.trim()}"><span>${index + 1}. ${escapeHtml(row.username)}</span><span>${row.score}</span></li>`;
    })
    .join("");
}

async function showLeaderboard(message) {
  leaderboardDateEl.textContent = todayUtc();
  leaderboardStatusEl.textContent = message;
  leaderboardListEl.innerHTML = "";
  showScreen(leaderboardEl);
  await renderLeaderboard();
}

async function finishDaily() {
  leaderboardDateEl.textContent = todayUtc();
  leaderboardListEl.innerHTML = "";
  showScreen(leaderboardEl);

  if (!supabase) {
    leaderboardStatusEl.textContent = `Your score: ${score}. Add your Supabase URL and anon key in app.js to publish it.`;
    return;
  }

  leaderboardStatusEl.textContent = "Saving your score…";

  const { error } = await supabase.from("daily_scores").insert({
    username,
    score,
    date: todayUtc(),
  });

  if (error?.code === "23505") {
    leaderboardStatusEl.textContent =
      "You already submitted a score for today.";
  } else if (error) {
    leaderboardStatusEl.textContent =
      "Could not save your score. The leaderboard is below.";
    console.error(error);
  } else {
    leaderboardStatusEl.textContent = `Your score: ${score}`;
  }

  await renderLeaderboard();
}

function showFeedback(message, status) {
  feedbackEl.textContent = message;
  feedbackEl.className = `feedback-${status}`;
}

usernameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const nextName = cleanUsername(usernameInput.value);
  if (!nextName) return;

  username = nextName;
  localStorage.setItem(USERNAME_KEY, username);
  showHome();
});

changeNameBtn.addEventListener("click", () => {
  usernameInput.value = username;
  showScreen(usernameScreen);
  usernameInput.focus();
});

practiceBtn.addEventListener("click", startPractice);
dailyBtn.addEventListener("click", () => {
  startDaily();
});
quitBtn.addEventListener("click", showHome);
leaderboardHomeBtn.addEventListener("click", showHome);

formEl.addEventListener("submit", (event) => {
  event.preventDefault();

  const { sentence, answer } = currentSentence();
  const userAnswer = normalize(inputEl.value);
  const correctAnswer = normalize(answer);
  const participe = normalize(currentVerb.participe_passe);
  const fullSentence = completedSentence(sentence, answer);
  const encodedPrompt = encodeURIComponent(explainPrompt(fullSentence));
  const correct = userAnswer === correctAnswer;

  if (mode === "daily" && correct) {
    score += POINTS_PER_CORRECT;
    scoreLine.textContent = `Score: ${score}`;
  }

  feedbackEl.classList.remove("hidden");
  chatgptLinkEl.href = `https://chatgpt.com/?q=${encodedPrompt}`;
  aiLinksEl.classList.remove("hidden");
  translateLinkEl.href = googleTranslateUrl(fullSentence);
  translateLinkEl.classList.remove("hidden");

  if (correct) {
    const points = mode === "daily" ? " +10." : "";
    showFeedback(`Correct!${points} ${answer}`, "correct");
  } else if (userAnswer === participe) {
    showFeedback(`Almost! Don't forget the auxiliary: ${answer}`, "incorrect");
  } else {
    showFeedback(`Incorrect. The answer is: ${answer}`, "incorrect");
  }

  inputEl.disabled = true;
  formEl.querySelector("button").classList.add("hidden");

  if (isLastDailyQuestion()) {
    finishDaily();
    return;
  }

  nextBtn.textContent =
    mode === "daily" || sentenceIndex < SENTENCE_COUNT - 1
      ? "Next sentence →"
      : "Next verb →";

  nextBtn.classList.remove("hidden");
  nextBtn.focus();
});

nextBtn.addEventListener("click", goToNext);

async function init() {
  try {
    const response = await fetch("./french-verbes.json");
    verbs = sortVerbsByLevel(await response.json());
    loadingEl.classList.add("hidden");

    username = cleanUsername(localStorage.getItem(USERNAME_KEY) || "");
    if (!username) {
      showScreen(usernameScreen);
      usernameInput.focus();
      return;
    }

    showHome();
  } catch (error) {
    loadingEl.textContent =
      "Error loading verbs database. Are you running this on a server?";
    console.error(error);
  }
}

init();
