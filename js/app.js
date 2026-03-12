/* ===== App State ===== */
const AppState = {
  currentLesson: null,
  currentModule: null,
  lessons: [],
  lessonData: {},
};

/* ===== Content Storage (localStorage) ===== */
const CONTENT_KEY = 'engquiz_content';

const ContentStore = {
  _get() {
    try {
      const raw = localStorage.getItem(CONTENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  save(type, lessonId, data) {
    // type: 'lessons' | 'vocab' | 'reading' | 'translation'
    const store = this._get() || {};
    if (type === 'lessons') {
      store.lessons = data;
    } else {
      if (!store[type]) store[type] = {};
      store[type][lessonId] = data;
    }
    localStorage.setItem(CONTENT_KEY, JSON.stringify(store));
  },

  getLessons() {
    const store = this._get();
    return store?.lessons || null;
  },

  getModule(type, lessonId) {
    const store = this._get();
    return store?.[type]?.[lessonId] || null;
  }
};

/* ===== JSON Loader (localStorage first, then fetch) ===== */
async function loadJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('데이터 로딩 실패:', path, e);
    showError('데이터 파일을 불러올 수 없습니다: ' + path);
    return null;
  }
}

function showError(msg) {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div style="text-align:center;padding:40px 20px;">
      <div style="font-size:3rem;margin-bottom:16px;">⚠️</div>
      <div style="font-size:1.1rem;color:#991b1b;font-weight:600;margin-bottom:12px;">${msg}</div>
      <button class="btn-primary" onclick="navigate('#home')" style="max-width:200px;margin:0 auto;">홈으로</button>
    </div>`;
}

/* ===== Router ===== */
function navigate(hash) {
  window.location.hash = hash;
}

async function handleRoute() {
  const hash = window.location.hash || '#home';
  const parts = hash.slice(1).split('/');
  const route = parts[0];

  const main = document.getElementById('main-content');
  const navTitle = document.getElementById('nav-title');
  const navBack = document.getElementById('nav-back');
  const progressBar = document.getElementById('progress-fill');

  // Reset progress bar
  if (progressBar) progressBar.style.width = '0%';

  if (route === 'home' || route === '') {
    navTitle.textContent = '영어 학습';
    navBack.style.display = 'none';
    await renderHome(main);
  } else if (route === 'vocab' && parts[1]) {
    const lessonId = parts[1];
    navTitle.textContent = getLessonTitle(lessonId) + ' > 단어 학습';
    navBack.style.display = '';
    await startVocab(main, lessonId);
  } else if (route === 'reading' && parts[1]) {
    const lessonId = parts[1];
    navTitle.textContent = getLessonTitle(lessonId) + ' > 독해 연습';
    navBack.style.display = '';
    await startReading(main, lessonId);
  } else if (route === 'translation' && parts[1]) {
    const lessonId = parts[1];
    navTitle.textContent = getLessonTitle(lessonId) + ' > 번역 연습';
    navBack.style.display = '';
    await startTranslation(main, lessonId);
  } else {
    navigate('#home');
  }
}

function getLessonTitle(lessonId) {
  const lesson = AppState.lessons.find(l => l.id === lessonId);
  return lesson ? lesson.title : lessonId;
}

/* ===== Home Screen ===== */
async function renderHome(container) {
  if (AppState.lessons.length === 0) {
    // localStorage first, then fetch
    const storedLessons = ContentStore.getLessons();
    if (storedLessons) {
      AppState.lessons = storedLessons;
    } else {
      const data = await loadJSON('data/lessons.json');
      if (!data) return;
      AppState.lessons = data.lessons;
    }
  }

  const progress = Progress.getAll();
  const selectedLesson = AppState.currentLesson || AppState.lessons[0]?.id || '';

  let lessonOptions = AppState.lessons.map(l =>
    `<option value="${l.id}" ${l.id === selectedLesson ? 'selected' : ''}>${l.title}</option>`
  ).join('');

  const lesson = AppState.lessons.find(l => l.id === selectedLesson);

  container.innerHTML = `
    <div class="home-header">
      <h1>ENG LIVE</h1>
      <p>실시간 영어 학습 방송</p>
    </div>
    <div class="info-ticker">
      <span class="ticker-label">NOW</span>
      <span class="ticker-text">단어 학습 · 독해 연습 · 번역 연습 — 고등학생을 위한 맞춤 영어 학습 프로그램 📡</span>
    </div>
    <div class="lesson-selector">
      <label>CHANNEL SELECT</label>
      <select id="lesson-select" onchange="onLessonChange(this.value)">
        ${lessonOptions}
      </select>
    </div>
    <div class="module-cards" id="module-cards">
      ${renderModuleCards(selectedLesson, progress)}
    </div>
    <div class="speed-selector">
      <label>SPEED</label>
      <div class="speed-options" id="speed-options">
        <button class="speed-btn${getSpeechRate() === 0.6 ? ' active' : ''}" data-rate="0.6" onclick="onSpeedChange(0.6)">느리게</button>
        <button class="speed-btn${getSpeechRate() === 0.85 ? ' active' : ''}" data-rate="0.85" onclick="onSpeedChange(0.85)">보통</button>
        <button class="speed-btn${getSpeechRate() === 1.0 ? ' active' : ''}" data-rate="1" onclick="onSpeedChange(1.0)">빠르게</button>
      </div>
    </div>
    <div style="margin-top:32px;text-align:center;">
      <a href="admin.html" style="color:#64748b;font-size:0.85rem;font-weight:600;text-decoration:none;border:1px solid rgba(255,255,255,0.08);padding:10px 20px;border-radius:8px;display:inline-block;transition:all 0.2s;"
         onmouseover="this.style.color='#e2e8f0';this.style.borderColor='rgba(255,255,255,0.2)'"
         onmouseout="this.style.color='#64748b';this.style.borderColor='rgba(255,255,255,0.08)'">
        ⚙️ 관리자 페이지
      </a>
    </div>
    <div style="margin-top:24px;text-align:center;font-size:0.75rem;color:#475569;line-height:1.6;padding:0 12px;">
      이 앱은 개인정보를 수집하지 않습니다. 학습 기록은 기기에만 저장됩니다.
    </div>
  `;

  AppState.currentLesson = selectedLesson;
}

function renderModuleCards(lessonId, progress) {
  const vocabProgress = Progress.getModuleProgress('vocab', lessonId);
  const readingProgress = Progress.getModuleProgress('reading', lessonId);
  const translationProgress = Progress.getModuleProgress('translation', lessonId);

  return `
    <div class="module-card" onclick="navigate('#vocab/${lessonId}')">
      <div class="module-icon">📚</div>
      <div class="module-name">단어 학습</div>
      <div class="module-desc">단어 카드, 발음 듣기, 퀴즈, 녹음</div>
      <div class="module-progress"><div class="module-progress-fill" style="width:${vocabProgress.percent}%"></div></div>
      <div class="module-progress-text">${vocabProgress.text}</div>
    </div>
    <div class="module-card" onclick="navigate('#reading/${lessonId}')">
      <div class="module-icon">📖</div>
      <div class="module-name">독해 연습</div>
      <div class="module-desc">지문 읽기, 단어 하이라이트, 문제 풀기</div>
      <div class="module-progress"><div class="module-progress-fill" style="width:${readingProgress.percent}%"></div></div>
      <div class="module-progress-text">${readingProgress.text}</div>
    </div>
    <div class="module-card" onclick="navigate('#translation/${lessonId}')">
      <div class="module-icon">✏️</div>
      <div class="module-name">번역 연습</div>
      <div class="module-desc">한↔영 번역, 힌트, 채점</div>
      <div class="module-progress"><div class="module-progress-fill" style="width:${translationProgress.percent}%"></div></div>
      <div class="module-progress-text">${translationProgress.text}</div>
    </div>
  `;
}

function onSpeedChange(rate) {
  setSpeechRate(rate);
  document.querySelectorAll('.speed-btn').forEach(b => {
    b.classList.toggle('active', parseFloat(b.dataset.rate) === rate);
  });
}

function onLessonChange(lessonId) {
  AppState.currentLesson = lessonId;
  const progress = Progress.getAll();
  document.getElementById('module-cards').innerHTML = renderModuleCards(lessonId, progress);
}

/* ===== Utility ===== */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function updateProgress(percent) {
  const fill = document.getElementById('progress-fill');
  if (fill) fill.style.width = percent + '%';
  const bar = fill?.parentElement;
  if (bar) bar.setAttribute('aria-valuenow', Math.round(percent));
}

/* ===== TTS ===== */
const synth = window.speechSynthesis;

/* Speech rate: saved in localStorage */
function getSpeechRate() {
  const saved = localStorage.getItem('engquiz_speech_rate');
  return saved ? parseFloat(saved) : 0.85;
}
function setSpeechRate(rate) {
  localStorage.setItem('engquiz_speech_rate', rate);
}

function speak(text, lang, rate) {
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang || 'en-US';
  u.rate = rate || getSpeechRate();
  synth.speak(u);
}

/* ===== Load Lesson Data (localStorage > fetch, cached) ===== */
async function loadLessonModule(module, lessonId) {
  const key = `${module}/${lessonId}`;
  if (AppState.lessonData[key]) return AppState.lessonData[key];

  // 1) Try localStorage first (admin에서 저장한 데이터)
  const stored = ContentStore.getModule(module, lessonId);
  if (stored) {
    AppState.lessonData[key] = stored;
    return stored;
  }

  // 2) Fallback to fetch from JSON file
  const lesson = AppState.lessons.find(l => l.id === lessonId);
  if (!lesson) return null;

  const path = lesson.modules[module];
  if (!path) return null;

  const data = await loadJSON(path);
  if (data) AppState.lessonData[key] = data;
  return data;
}

/* ===== Init ===== */
window.addEventListener('hashchange', handleRoute);
window.addEventListener('DOMContentLoaded', async () => {
  // localStorage first
  const storedLessons = ContentStore.getLessons();
  if (storedLessons) {
    AppState.lessons = storedLessons;
  } else {
    const data = await loadJSON('data/lessons.json');
    if (data) AppState.lessons = data.lessons;
  }
  handleRoute();
});
