// State
let verbs = [];
let currentVerb = null;
let sentenceIndex = 0;

const SENTENCE_COUNT = 3;

// DOM Elements
const loadingEl = document.getElementById("loading");
const quizContainer = document.getElementById("quiz-container");
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

const EXPLAIN_PROMPT =
  "Translate this sentence to English and explain the grammatical structure of it briefly.";

function normalize(text) {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function currentSentence() {
  const n = sentenceIndex + 1;
  return {
    sentence: currentVerb[`sentence_${n}`],
    answer: currentVerb[`answer_${n}`],
  };
}

function renderSentence(sentence) {
  const html = sentence.replace(
    /_{2,}/g,
    '<span class="blank" aria-hidden="true"></span>',
  );
  sentencePromptEl.innerHTML = html;
}

function completedSentence(sentence, answer) {
  return sentence
    .replace(/_{2,}/g, answer)
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
  const n = sentenceIndex + 1;

  verbPromptEl.textContent = currentVerb.infinitive;
  sentenceProgressEl.textContent = `${n} / ${SENTENCE_COUNT}`;
  renderSentence(sentence);
  resetAnswerUi();
}

function loadNextVerb() {
  const randomIndex = Math.floor(Math.random() * verbs.length);
  currentVerb = verbs[randomIndex];
  sentenceIndex = 0;
  showCurrentSentence();
}

function goToNext() {
  if (sentenceIndex < SENTENCE_COUNT - 1) {
    sentenceIndex += 1;
    showCurrentSentence();
    return;
  }

  loadNextVerb();
}

async function init() {
  try {
    const response = await fetch("./french-verbes.json");
    verbs = await response.json();

    loadingEl.classList.add("hidden");
    quizContainer.classList.remove("hidden");

    loadNextVerb();
  } catch (error) {
    loadingEl.textContent =
      "Error loading verbs database. Are you running this on a server?";
    console.error(error);
  }
}

formEl.addEventListener("submit", (e) => {
  e.preventDefault();

  const { sentence, answer } = currentSentence();
  const userAnswer = normalize(inputEl.value);
  const correctAnswer = normalize(answer);
  const participe = normalize(currentVerb.participe_passe);
  const fullSentence = completedSentence(sentence, answer);

  const prompt = explainPrompt(fullSentence);
  const encodedPrompt = encodeURIComponent(prompt);

  feedbackEl.classList.remove("hidden");
  chatgptLinkEl.href = `https://chatgpt.com/?q=${encodedPrompt}`;
  aiLinksEl.classList.remove("hidden");
  translateLinkEl.href = googleTranslateUrl(fullSentence);
  translateLinkEl.classList.remove("hidden");

  if (userAnswer === correctAnswer) {
    showFeedback(`Correct! ${answer}`, "correct");
  } else if (userAnswer === participe) {
    showFeedback(
      `Almost! Don't forget the auxiliary: ${answer}`,
      "incorrect",
    );
  } else {
    showFeedback(`Incorrect. The answer is: ${answer}`, "incorrect");
  }

  inputEl.disabled = true;
  formEl.querySelector("button").classList.add("hidden");
  nextBtn.textContent =
    sentenceIndex < SENTENCE_COUNT - 1
      ? "Next sentence →"
      : "Next verb →";
  nextBtn.classList.remove("hidden");
  nextBtn.focus();
});

function showFeedback(message, status) {
  feedbackEl.textContent = message;
  feedbackEl.className = `feedback-${status}`;
}

nextBtn.addEventListener("click", goToNext);

init();
