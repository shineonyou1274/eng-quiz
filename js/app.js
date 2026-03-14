/* ===== App State ===== */
const AppState = {
  currentLesson: null,
  currentModule: null,
  lessons: [],
  lessonData: {},
};

/* ===== PWA Install Prompt ===== */
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  // 이미 설치됐거나 배너가 이미 있으면 무시
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (document.getElementById('pwa-install-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'install-banner';
  banner.innerHTML = `
    <div class="install-banner-text">
      <strong>ENG LIVE</strong> 앱을 설치하면 더 빠르게 학습할 수 있습니다
    </div>
    <div class="install-banner-actions">
      <button class="install-btn" onclick="installApp()">설치</button>
      <button class="install-dismiss" onclick="dismissInstall()">닫기</button>
    </div>
  `;
  document.body.prepend(banner);
}

async function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const result = await deferredInstallPrompt.userChoice;
  if (result.outcome === 'accepted') {
    console.log('앱 설치 완료');
  }
  deferredInstallPrompt = null;
  dismissInstall();
}

function dismissInstall() {
  const banner = document.getElementById('pwa-install-banner');
  if (banner) banner.remove();
}

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
  // Stop any playing TTS on navigation
  synth.cancel();

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

  // 선택된 레슨의 데이터를 미리 로드 (진도 표시를 위해)
  await Promise.all([
    loadLessonModule('vocab', selectedLesson),
    loadLessonModule('reading', selectedLesson),
    loadLessonModule('translation', selectedLesson),
  ]).catch(() => {});

  let lessonOptions = AppState.lessons.map(l =>
    `<option value="${l.id}" ${l.id === selectedLesson ? 'selected' : ''}>${l.title}</option>`
  ).join('');

  const lesson = AppState.lessons.find(l => l.id === selectedLesson);

  // 온보딩 (첫 방문)
  if (!localStorage.getItem('engquiz_onboarded')) {
    container.innerHTML = `
      <div class="onboarding" id="onboarding">
        <div class="onboarding-slide active" data-slide="0">
          <div style="font-size:2.5rem;margin-bottom:16px;">📡</div>
          <h2 style="font-size:1.5rem;font-weight:900;margin-bottom:8px;">ENG LIVE</h2>
          <p style="color:#94a3b8;line-height:1.7;">실시간 방송 스타일의<br>영어 학습 앱에 오신 것을 환영합니다</p>
        </div>
        <div class="onboarding-slide" data-slide="1">
          <div style="display:flex;gap:16px;justify-content:center;margin-bottom:20px;">
            <div style="text-align:center;"><div style="font-size:1.5rem;">📚</div><div style="font-size:0.8rem;color:#94a3b8;margin-top:4px;">단어</div></div>
            <div style="text-align:center;"><div style="font-size:1.5rem;">📖</div><div style="font-size:0.8rem;color:#94a3b8;margin-top:4px;">독해</div></div>
            <div style="text-align:center;"><div style="font-size:1.5rem;">✏️</div><div style="font-size:0.8rem;color:#94a3b8;margin-top:4px;">번역</div></div>
          </div>
          <p style="color:#94a3b8;line-height:1.7;">단어 카드 학습, 독해 연습, 번역 연습<br>3가지 모드로 영어 실력을 키우세요</p>
        </div>
        <div class="onboarding-slide" data-slide="2">
          <div style="font-size:2rem;margin-bottom:16px;">🎯</div>
          <p style="color:#94a3b8;line-height:1.7;margin-bottom:20px;">설치 없이 바로 시작할 수 있습니다<br>학습 기록은 이 기기에 자동 저장됩니다</p>
          <button class="btn-primary" onclick="onboardingComplete()" style="max-width:200px;margin:0 auto;">시작하기</button>
        </div>
        <div class="onboarding-dots">
          <span class="dot active" onclick="onboardingGo(0)"></span>
          <span class="dot" onclick="onboardingGo(1)"></span>
          <span class="dot" onclick="onboardingGo(2)"></span>
        </div>
        <button class="onboarding-skip" onclick="onboardingComplete()">건너뛰기</button>
      </div>
    `;
    return;
  }

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
    <div class="settings-area">
      <div class="speed-selector">
        <label>SPEED</label>
        <div class="speed-options" id="speed-options">
          <button class="speed-btn${getSpeechRate() === 0.6 ? ' active' : ''}" data-rate="0.6" onclick="onSpeedChange(0.6)">느리게</button>
          <button class="speed-btn${getSpeechRate() === 0.85 ? ' active' : ''}" data-rate="0.85" onclick="onSpeedChange(0.85)">보통</button>
          <button class="speed-btn${getSpeechRate() === 1.0 ? ' active' : ''}" data-rate="1" onclick="onSpeedChange(1.0)">빠르게</button>
        </div>
      </div>
      <div class="record-toggle">
        <label>발음 녹음</label>
        <div class="toggle-switch" onclick="onRecordToggle()">
          <input type="checkbox" id="record-mode-toggle" ${getRecordMode() ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </div>
        <span style="font-size:0.75rem;color:#64748b;">단어 학습 시 녹음 기능 표시</span>
      </div>
    </div>
    <div style="margin-top:32px;text-align:center;display:flex;justify-content:center;gap:12px;flex-wrap:wrap;">
      <a href="help.html" style="color:#64748b;font-size:0.85rem;font-weight:600;text-decoration:none;border:1px solid rgba(255,255,255,0.08);padding:10px 20px;border-radius:8px;display:inline-block;transition:all 0.2s;"
         onmouseover="this.style.color='#e2e8f0';this.style.borderColor='rgba(255,255,255,0.2)'"
         onmouseout="this.style.color='#64748b';this.style.borderColor='rgba(255,255,255,0.08)'">
        📖 도움말
      </a>
      <a href="admin.html" style="color:#64748b;font-size:0.85rem;font-weight:600;text-decoration:none;border:1px solid rgba(255,255,255,0.08);padding:10px 20px;border-radius:8px;display:inline-block;transition:all 0.2s;"
         onmouseover="this.style.color='#e2e8f0';this.style.borderColor='rgba(255,255,255,0.2)'"
         onmouseout="this.style.color='#64748b';this.style.borderColor='rgba(255,255,255,0.08)'">
        ⚙️ 관리자 페이지
      </a>
    </div>
    <div class="ad-slot ad-slot-home" id="ad-home">
      <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-6730377739026332" data-ad-slot="9325911662" data-ad-format="auto" data-full-width-responsive="true"></ins>
    </div>
    <div style="margin-top:24px;text-align:center;font-size:0.75rem;color:#475569;line-height:1.6;padding:0 12px;">
      이 앱은 개인정보를 수집하지 않습니다. 학습 기록은 기기에만 저장됩니다.
    </div>
  `;

  AppState.currentLesson = selectedLesson;
  // AdSense 광고 로드
  tryLoadAd();
}

/* ===== AdSense Helper ===== */
function tryLoadAd() {
  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  } catch (e) { /* AdSense 미로드 시 무시 */ }
}

function renderModuleCards(lessonId, progress) {
  // 전체 항목 수를 데이터에서 가져옴
  const vocabData = AppState.lessonData['vocab/' + lessonId];
  const readingData = AppState.lessonData['reading/' + lessonId];
  const translationData = AppState.lessonData['translation/' + lessonId];

  const vocabTotal = vocabData?.words?.length || 0;
  const readingTotal = readingData?.passages?.length || 0;
  const translationTotal = translationData?.exercises?.length || 0;

  const vocabProgress = Progress.getModuleProgress('vocab', lessonId, vocabTotal);
  const readingProgress = Progress.getModuleProgress('reading', lessonId, readingTotal);
  const translationProgress = Progress.getModuleProgress('translation', lessonId, translationTotal);

  return `
    <div class="module-card" onclick="navigate('#vocab/${lessonId}')" role="button" tabindex="0" aria-label="단어 학습 시작 - ${vocabProgress.text}" onkeydown="if(event.key==='Enter')navigate('#vocab/${lessonId}')">
      <div class="module-icon" aria-hidden="true">📚</div>
      <div class="module-name">단어 학습</div>
      <div class="module-desc">단어 카드, 발음 듣기, 퀴즈</div>
      <div class="module-progress" role="progressbar" aria-valuenow="${vocabProgress.percent}" aria-valuemin="0" aria-valuemax="100"><div class="module-progress-fill" style="width:${vocabProgress.percent}%"></div></div>
      <div class="module-progress-text">${vocabProgress.text}</div>
    </div>
    <div class="module-card" onclick="navigate('#reading/${lessonId}')" role="button" tabindex="0" aria-label="독해 연습 시작 - ${readingProgress.text}" onkeydown="if(event.key==='Enter')navigate('#reading/${lessonId}')">
      <div class="module-icon" aria-hidden="true">📖</div>
      <div class="module-name">독해 연습</div>
      <div class="module-desc">지문 읽기, 단어 하이라이트, 문제 풀기</div>
      <div class="module-progress" role="progressbar" aria-valuenow="${readingProgress.percent}" aria-valuemin="0" aria-valuemax="100"><div class="module-progress-fill" style="width:${readingProgress.percent}%"></div></div>
      <div class="module-progress-text">${readingProgress.text}</div>
    </div>
    <div class="module-card" onclick="navigate('#translation/${lessonId}')" role="button" tabindex="0" aria-label="번역 연습 시작 - ${translationProgress.text}" onkeydown="if(event.key==='Enter')navigate('#translation/${lessonId}')">
      <div class="module-icon" aria-hidden="true">✏️</div>
      <div class="module-name">번역 연습</div>
      <div class="module-desc">한↔영 번역, 힌트, 채점</div>
      <div class="module-progress" role="progressbar" aria-valuenow="${translationProgress.percent}" aria-valuemin="0" aria-valuemax="100"><div class="module-progress-fill" style="width:${translationProgress.percent}%"></div></div>
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

function onRecordToggle() {
  const cb = document.getElementById('record-mode-toggle');
  cb.checked = !cb.checked;
  setRecordMode(cb.checked);
}

function getRecordMode() {
  return localStorage.getItem('engquiz_record_mode') === 'true';
}
function setRecordMode(on) {
  localStorage.setItem('engquiz_record_mode', on ? 'true' : 'false');
}

async function onLessonChange(lessonId) {
  AppState.currentLesson = lessonId;
  await Promise.all([
    loadLessonModule('vocab', lessonId),
    loadLessonModule('reading', lessonId),
    loadLessonModule('translation', lessonId),
  ]).catch(() => {});
  const progress = Progress.getAll();
  document.getElementById('module-cards').innerHTML = renderModuleCards(lessonId, progress);
}

/* ===== Onboarding ===== */
function onboardingGo(idx) {
  document.querySelectorAll('.onboarding-slide').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.onboarding-dots .dot').forEach(d => d.classList.remove('active'));
  document.querySelector(`.onboarding-slide[data-slide="${idx}"]`).classList.add('active');
  document.querySelectorAll('.onboarding-dots .dot')[idx].classList.add('active');
}

function onboardingComplete() {
  localStorage.setItem('engquiz_onboarded', 'true');
  renderHome(document.getElementById('main-content'));
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
  // Initialize live chat
  if (typeof LiveChat !== 'undefined') LiveChat.init();
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
