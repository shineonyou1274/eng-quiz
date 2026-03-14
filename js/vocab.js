/* ===== Vocabulary Module (단순화: 카드 → 퀴즈 → 완료) ===== */
let vocabState = {
  words: [],
  allWordStrings: [],
  currentIndex: 0,
  quizOrder: [],
  quizIndex: 0,
  quizCorrect: 0,
  wrongWords: [],
  lessonId: '',
  // 녹음 (숨김 옵션)
  isRecording: false,
  mediaRecorder: null,
  audioChunks: [],
  recordBlob: null,
  audioUrl: null,
};

/* 녹음 모드 설정 */
function getRecordMode() {
  return localStorage.getItem('engquiz_record_mode') === 'true';
}
function setRecordMode(on) {
  localStorage.setItem('engquiz_record_mode', on ? 'true' : 'false');
}

async function startVocab(container, lessonId) {
  const data = await loadLessonModule('vocab', lessonId);
  if (!data) return;

  vocabState = {
    words: data.words,
    allWordStrings: data.words.map(w => w.word),
    currentIndex: 0,
    quizOrder: [],
    quizIndex: 0,
    quizCorrect: 0,
    wrongWords: [],
    lessonId: lessonId,
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    recordBlob: null,
    audioUrl: null,
  };

  const recordMode = getRecordMode();

  container.innerHTML = `
    <div class="section-header">
      <h2 id="vocab-title">단어 학습</h2>
      <div class="counter" id="vocab-counter"></div>
    </div>

    <!-- 카드 학습 Phase -->
    <div id="vocab-learn">
      <div class="word-card" id="vocab-card">
        <div class="word-difficulty" id="vocab-difficulty"></div>
        <div class="word-text" id="vocab-word"></div>
        <div class="word-pron" id="vocab-pron"></div>
        <div class="word-meaning" id="vocab-meaning"></div>
        <div class="word-example" id="vocab-exen"></div>
        <div class="word-example-kr" id="vocab-exkr"></div>
      </div>
      <div class="audio-row">
        <button class="btn-audio" onclick="vocabSpeakWord()" aria-label="단어 발음 듣기">🔊 단어</button>
        <button class="btn-audio" onclick="vocabSpeakExample()" aria-label="예문 발음 듣기">🔊 예문</button>
      </div>
      ${recordMode ? `
      <div class="record-section" id="vocab-record-section">
        <div class="record-word" id="vocab-rec-word"></div>
        <div class="record-note" style="font-size:0.75rem;color:#64748b;margin-bottom:8px;">녹음은 기기에만 저장됩니다</div>
        <div style="display:flex;gap:12px;justify-content:center;align-items:center;">
          <button class="btn-record" id="vocab-rec-btn" onclick="vocabToggleRecord()" aria-label="녹음 시작/중지">🎤</button>
          <button class="btn-audio" id="vocab-play-btn" onclick="vocabPlayRecord()" style="display:none;" aria-label="녹음 재생">▶ 재생</button>
        </div>
        <div class="waveform" id="vocab-waveform">
          <div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div>
          <div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div>
        </div>
        <div class="record-status" id="vocab-rec-status">발음 녹음 (선택)</div>
      </div>
      ` : ''}
      <div class="vocab-nav-row">
        <button class="btn-secondary" id="vocab-prev-btn" onclick="vocabPrevWord()" style="flex:1;">← 이전</button>
        <button class="btn-secondary" id="vocab-next-word-btn" onclick="vocabNextWord()" style="flex:1;">다음 단어 →</button>
      </div>
    </div>

    <!-- 퀴즈 Phase -->
    <div id="vocab-review" style="display:none;">
      <div style="background:rgba(255,255,255,0.03);border-radius:16px;padding:28px 24px;margin-bottom:20px;border:1px solid rgba(255,255,255,0.08);">
        <div class="quiz-label" id="vocab-review-num"></div>
        <div class="quiz-sentence" id="vocab-review-sent"></div>
        <div class="quiz-sentence-kr" id="vocab-review-kr"></div>
      </div>
      <div class="quiz-options" id="vocab-review-opts"></div>
      <div class="hint-area">
        <button class="btn-hint" id="vocab-review-hint-btn" onclick="vocabShowReviewHint()" style="display:none;">힌트</button>
        <div class="hint-text" id="vocab-review-hint-text"></div>
      </div>
      <div id="vocab-review-feedback" style="text-align:center;margin-top:12px;font-weight:700;font-size:0.95rem;display:none;" aria-live="polite"></div>
      <button class="btn-next" id="vocab-review-next" onclick="vocabNextReview()">다음 →</button>
    </div>

    <!-- 완료 화면 -->
    <div class="final-screen" id="vocab-final">
      <div class="final-title">학습 완료</div>
      <div class="final-subtitle">퀴즈 결과</div>
      <div class="final-score" id="vocab-final-score"></div>
      <div id="vocab-wrong-list" style="margin-top:20px;"></div>
      <div style="margin-top:24px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button class="btn-restart" id="vocab-retry-wrong" style="display:none;" onclick="vocabRetryWrong()">틀린 단어만 다시</button>
        <button class="btn-restart" onclick="startVocab(document.getElementById('main-content'), vocabState.lessonId)">전체 다시</button>
        <button class="btn-restart" onclick="navigate('#home')">홈으로</button>
      </div>
      <div class="ad-slot ad-slot-completion">
        <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="XXXXXXXXXX" data-ad-format="auto" data-full-width-responsive="true"></ins>
      </div>
    </div>
  `;

  if (typeof LiveChat !== 'undefined') LiveChat.trigger('start');
  vocabLoadCard();
}

function vocabLoadCard() {
  if (typeof LiveChat !== 'undefined' && vocabState.currentIndex > 0) LiveChat.trigger('wordNext');
  const w = vocabState.words[vocabState.currentIndex];

  document.getElementById('vocab-word').textContent = w.word;
  document.getElementById('vocab-pron').textContent = w.pron;
  document.getElementById('vocab-meaning').textContent = w.meaning;
  document.getElementById('vocab-exen').textContent = w.exEn;
  document.getElementById('vocab-exkr').textContent = w.exKr;

  // Difficulty stars
  let stars = '';
  for (let i = 1; i <= 3; i++) {
    stars += `<span class="star${i <= (w.difficulty || 1) ? '' : ' empty'}">★</span>`;
  }
  document.getElementById('vocab-difficulty').innerHTML = stars;

  const total = vocabState.words.length;
  const idx = vocabState.currentIndex;
  document.getElementById('vocab-counter').textContent = `단어 ${idx + 1} / ${total}`;
  updateProgress(50 * idx / total);

  // Show/hide prev button
  const prevBtn = document.getElementById('vocab-prev-btn');
  if (prevBtn) prevBtn.style.display = idx > 0 ? '' : 'none';

  // Update next word button text on last word
  const nextWordBtn = document.getElementById('vocab-next-word-btn');
  if (nextWordBtn) nextWordBtn.textContent = idx >= total - 1 ? '퀴즈 시작 →' : '다음 단어 →';

  // 녹음 모드일 때 녹음 영역 초기화
  const recWord = document.getElementById('vocab-rec-word');
  if (recWord) {
    recWord.textContent = w.word;
    const btn = document.getElementById('vocab-rec-btn');
    if (btn) { btn.className = 'btn-record'; btn.textContent = '🎤'; }
    const wf = document.getElementById('vocab-waveform');
    if (wf) wf.classList.remove('active');
    const status = document.getElementById('vocab-rec-status');
    if (status) status.textContent = '발음 녹음 (선택)';
    const playBtn = document.getElementById('vocab-play-btn');
    if (playBtn) playBtn.style.display = 'none';
    vocabState.isRecording = false;
    vocabState.recordBlob = null;
    if (vocabState.audioUrl) {
      URL.revokeObjectURL(vocabState.audioUrl);
      vocabState.audioUrl = null;
    }
  }

  // TTS 자동 재생
  vocabSpeakWord();
}

/* 단어 네비게이션 */
function vocabPrevWord() {
  if (vocabState.currentIndex > 0) {
    vocabState.currentIndex--;
    vocabLoadCard();
  }
}

function vocabNextWord() {
  vocabState.currentIndex++;
  if (vocabState.currentIndex >= vocabState.words.length) {
    vocabStartReview();
  } else {
    vocabLoadCard();
  }
}

function vocabSpeakWord() {
  speak(vocabState.words[vocabState.currentIndex].word, 'en-US');
}

function vocabSpeakExample() {
  speak(vocabState.words[vocabState.currentIndex].exEn, 'en-US');
}

/* ===== 녹음 (숨김 옵션) ===== */
async function vocabToggleRecord() {
  const btn = document.getElementById('vocab-rec-btn');
  const status = document.getElementById('vocab-rec-status');
  const wf = document.getElementById('vocab-waveform');

  if (!vocabState.isRecording) {
    if (!navigator.mediaDevices) { alert('녹음 미지원 브라우저'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      vocabState.mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
      vocabState.audioChunks = [];

      vocabState.mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) vocabState.audioChunks.push(e.data);
      };
      vocabState.mediaRecorder.onstop = () => {
        vocabState.recordBlob = new Blob(vocabState.audioChunks, { type: mime });
        if (vocabState.audioUrl) URL.revokeObjectURL(vocabState.audioUrl);
        vocabState.audioUrl = URL.createObjectURL(vocabState.recordBlob);
        stream.getTracks().forEach(t => t.stop());
        wf.classList.remove('active');
        btn.className = 'btn-record done';
        btn.textContent = '✅';
        status.textContent = '녹음 완료';
        const playBtn = document.getElementById('vocab-play-btn');
        if (playBtn) playBtn.style.display = '';
      };

      vocabState.mediaRecorder.start(100);
      vocabState.isRecording = true;
      btn.className = 'btn-record recording';
      btn.textContent = '⏹';
      wf.classList.add('active');
      status.textContent = '녹음 중...';
    } catch {
      alert('마이크 권한이 필요합니다');
    }
  } else {
    if (vocabState.mediaRecorder && vocabState.mediaRecorder.state === 'recording') {
      vocabState.mediaRecorder.stop();
      vocabState.isRecording = false;
    }
  }
}

function vocabPlayRecord() {
  if (vocabState.audioUrl) new Audio(vocabState.audioUrl).play();
}

/* ===== 퀴즈 Phase ===== */
function vocabStartReview() {
  document.getElementById('vocab-learn').style.display = 'none';
  document.getElementById('vocab-review').style.display = 'block';
  document.getElementById('vocab-title').textContent = '퀴즈';
  updateProgress(50);

  vocabState.quizOrder = shuffle(vocabState.words);
  vocabState.quizIndex = 0;
  vocabState.quizCorrect = 0;
  vocabState.wrongWords = [];
  vocabLoadReviewQ();
}

function vocabLoadReviewQ() {
  if (vocabState.quizIndex >= vocabState.quizOrder.length) {
    vocabShowFinal();
    return;
  }

  const w = vocabState.quizOrder[vocabState.quizIndex];
  const total = vocabState.quizOrder.length;
  const idx = vocabState.quizIndex;

  document.getElementById('vocab-counter').textContent = `퀴즈 ${idx + 1} / ${total}`;
  document.getElementById('vocab-review-num').textContent = `Q${idx + 1}`;
  updateProgress(50 + (idx / total) * 50);

  const re = new RegExp('\\b' + w.word + '\\w*\\b', 'i');
  document.getElementById('vocab-review-sent').innerHTML =
    w.exEn.replace(re, '<span class="blank">______</span>');
  document.getElementById('vocab-review-kr').textContent = w.exKr;

  let opts = [w.word];
  const pool = shuffle(vocabState.allWordStrings.filter(x => x !== w.word));
  for (let i = 0; i < Math.min(3, pool.length); i++) opts.push(pool[i]);
  opts = shuffle(opts);

  const wrap = document.getElementById('vocab-review-opts');
  wrap.innerHTML = '';
  opts.forEach(o => {
    const b = document.createElement('button');
    b.className = 'quiz-option';
    b.textContent = o;
    b.onclick = () => vocabCheckReview(o, b, w.word);
    wrap.appendChild(b);
  });

  // 힌트 초기화
  const hintBtn = document.getElementById('vocab-review-hint-btn');
  const hintText = document.getElementById('vocab-review-hint-text');
  hintBtn.style.display = w.hint ? '' : 'none';
  hintText.classList.remove('show');
  hintText.textContent = '';

  // 피드백 초기화
  document.getElementById('vocab-review-feedback').style.display = 'none';
  document.getElementById('vocab-review-next').className = 'btn-next';
}

function vocabShowReviewHint() {
  if (typeof LiveChat !== 'undefined') LiveChat.trigger('hint');
  const w = vocabState.quizOrder[vocabState.quizIndex];
  if (w.hint) {
    const el = document.getElementById('vocab-review-hint-text');
    el.textContent = w.hint;
    el.classList.add('show');
  }
}

function vocabCheckReview(selected, el, correct) {
  document.querySelectorAll('#vocab-review-opts .quiz-option').forEach(b => b.disabled = true);
  const w = vocabState.quizOrder[vocabState.quizIndex];
  const feedback = document.getElementById('vocab-review-feedback');

  if (selected === correct) {
    el.classList.add('correct');
    vocabState.quizCorrect++;
    Progress.saveVocabWord(vocabState.lessonId, correct, true);
    feedback.textContent = '정답입니다';
    feedback.style.color = '#34d399';
    if (typeof LiveChat !== 'undefined') LiveChat.trigger('correct');
  } else {
    el.classList.add('wrong');
    document.querySelectorAll('#vocab-review-opts .quiz-option').forEach(b => {
      if (b.textContent === correct) b.classList.add('correct');
    });
    Progress.saveVocabWord(vocabState.lessonId, correct, false);
    vocabState.wrongWords.push(w);

    const selectedWord = vocabState.words.find(v => v.word === selected);
    let msg = `정답: <strong style="color:#34d399;">${correct}</strong> (${w.meaning})`;
    if (selectedWord && selectedWord.word !== correct) {
      msg += `<br><span style="color:#94a3b8;font-size:0.85rem;">${selected}은(는) "${selectedWord.meaning}"이라는 뜻입니다</span>`;
    }
    feedback.innerHTML = msg;
    feedback.style.color = '#f87171';
    if (typeof LiveChat !== 'undefined') LiveChat.trigger('wrong');
  }

  feedback.style.display = 'block';
  document.getElementById('vocab-review-next').className = 'btn-next show';
}

function vocabNextReview() {
  vocabState.quizIndex++;
  vocabLoadReviewQ();
}

function vocabShowFinal() {
  document.getElementById('vocab-review').style.display = 'none';
  document.getElementById('vocab-final').classList.add('show');
  updateProgress(100);

  const total = vocabState.quizOrder.length;
  const correct = vocabState.quizCorrect;
  document.getElementById('vocab-final-score').textContent = `${correct} / ${total}`;

  // 틀린 단어 목록 표시
  const wrongList = document.getElementById('vocab-wrong-list');
  if (vocabState.wrongWords.length > 0) {
    let html = '<div style="text-align:left;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:12px;padding:16px;">';
    html += '<div style="font-weight:700;color:#f87171;margin-bottom:10px;font-size:0.9rem;">틀린 단어 (' + vocabState.wrongWords.length + '개)</div>';
    vocabState.wrongWords.forEach(w => {
      html += `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.88rem;">
        <span style="font-weight:600;color:#e2e8f0;">${w.word}</span>
        <span style="color:#94a3b8;">${w.meaning}</span>
      </div>`;
    });
    html += '</div>';
    wrongList.innerHTML = html;
    document.getElementById('vocab-retry-wrong').style.display = '';
  } else {
    wrongList.innerHTML = '<div style="color:#34d399;font-weight:600;font-size:0.95rem;">모두 맞혔습니다</div>';
  }

  if (typeof LiveChat !== 'undefined') LiveChat.trigger('complete');
}

/* 틀린 단어만 재학습 */
function vocabRetryWrong() {
  const wrongWords = vocabState.wrongWords.slice();
  if (wrongWords.length === 0) return;

  document.getElementById('vocab-final').classList.remove('show');
  document.getElementById('vocab-review').style.display = 'block';
  document.getElementById('vocab-title').textContent = '오답 복습';
  updateProgress(50);

  vocabState.quizOrder = shuffle(wrongWords);
  vocabState.quizIndex = 0;
  vocabState.quizCorrect = 0;
  vocabState.wrongWords = [];
  vocabLoadReviewQ();
}
