/* ===== Reading Comprehension Module (개선: 지문+문제 한 화면) ===== */
let readingState = {
  passages: [],
  vocabWords: [],
  currentPassageIndex: -1,
  currentQuestionIndex: 0,
  score: 0,
  totalQuestions: 0,
  lessonId: '',
};

async function startReading(container, lessonId) {
  const data = await loadLessonModule('reading', lessonId);
  if (!data) return;

  const vocabData = await loadLessonModule('vocab', lessonId);

  readingState = {
    passages: data.passages,
    vocabWords: vocabData ? vocabData.words : [],
    currentPassageIndex: -1,
    currentQuestionIndex: 0,
    score: 0,
    totalQuestions: 0,
    lessonId: lessonId,
  };

  renderPassageList(container);
}

function renderPassageList(container) {
  let items = readingState.passages.map((p, i) => `
    <div class="passage-item" onclick="readingSelectPassage(${i})">
      <div class="passage-title">${p.title}</div>
      <div class="passage-info">${p.questions.length}개 문제</div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="section-header">
      <h2>독해 연습</h2>
      <div class="counter">지문을 선택하세요</div>
    </div>
    <div class="passage-list">${items}</div>
    <button class="btn-secondary" onclick="navigate('#home')">← 홈으로</button>
  `;
}

function readingSelectPassage(index) {
  readingState.currentPassageIndex = index;
  readingState.currentQuestionIndex = 0;
  readingState.score = 0;

  const container = document.getElementById('main-content');
  renderPassageView(container);
}

function renderPassageView(container) {
  const p = readingState.passages[readingState.currentPassageIndex];
  readingState.totalQuestions = p.questions.length;
  if (typeof LiveChat !== 'undefined') LiveChat.trigger('start');

  // Highlight vocabulary words in passage
  let passageHtml = escapeHtml(p.text);
  if (p.highlightWords && p.highlightWords.length > 0) {
    p.highlightWords.forEach(word => {
      const re = new RegExp('\\b(' + escapeRegex(word) + '\\w*)\\b', 'gi');
      passageHtml = passageHtml.replace(re, '<span class="highlight-word" data-word="$1">$1</span>');
    });
  }

  passageHtml = passageHtml.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('');

  container.innerHTML = `
    <div class="section-header">
      <h2>${p.title}</h2>
      <div class="counter" id="reading-counter">지문 읽기</div>
    </div>

    <!-- 지문 -->
    <div class="passage-card" id="reading-passage">${passageHtml}</div>
    <div class="audio-row">
      <button class="btn-audio" onclick="readingListenPassage()">🔊 지문 듣기</button>
    </div>

    <!-- 문장별 연습 (접힘 토글) -->
    <details class="sentence-toggle">
      <summary>문장별 연습 (듣기/받아쓰기)</summary>
      <div id="reading-sentence-practice"></div>
    </details>

    <!-- 문제 (지문 아래 바로 표시) -->
    <div class="reading-questions-inline" id="reading-questions">
      <div class="quiz-label" style="margin-bottom:16px;font-size:1rem;">문제 풀기</div>
      <div id="reading-q-area"></div>
    </div>

    <!-- Tooltip -->
    <div class="word-tooltip" id="reading-tooltip"></div>

    <!-- 결과 -->
    <div class="final-screen" id="reading-results">
      <div class="final-title">독해 완료</div>
      <div class="final-subtitle">점수</div>
      <div class="final-score" id="reading-final-score"></div>
      <div style="margin-top:24px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button class="btn-restart" onclick="readingSelectPassage(readingState.currentPassageIndex)">다시 풀기</button>
        <button class="btn-restart" onclick="readingBackToList()">지문 목록</button>
        <button class="btn-restart" onclick="navigate('#home')">홈으로</button>
      </div>
    </div>
  `;

  // Event delegation for highlight words
  document.getElementById('reading-passage').addEventListener('click', function(e) {
    const hw = e.target.closest('.highlight-word');
    if (hw) readingShowTooltip(e, hw.dataset.word);
  });

  // 문장별 연습 토글 이벤트
  const detailsEl = container.querySelector('.sentence-toggle');
  detailsEl.addEventListener('toggle', function() {
    if (this.open && !readingState.sentences) {
      readingInitSentencePractice();
    }
  });

  // 문제 바로 로드
  readingState.currentQuestionIndex = 0;
  readingState.score = 0;
  readingLoadQuestion();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readingShowTooltip(event, wordText) {
  const tooltip = document.getElementById('reading-tooltip');
  const wordLower = wordText.toLowerCase();

  const match = readingState.vocabWords.find(v =>
    wordLower.startsWith(v.word.toLowerCase())
  );

  if (!match) {
    tooltip.classList.remove('show');
    return;
  }

  tooltip.innerHTML = `
    <div class="tooltip-word">${match.word}</div>
    <div class="tooltip-pron">${match.pron}</div>
    <div class="tooltip-meaning">${match.meaning}</div>
  `;

  const rect = event.target.getBoundingClientRect();
  tooltip.style.left = Math.min(rect.left, window.innerWidth - 290) + 'px';
  tooltip.style.top = (rect.bottom + 8) + 'px';
  tooltip.classList.add('show');

  setTimeout(() => {
    document.addEventListener('click', function hide(e) {
      if (!tooltip.contains(e.target) && !e.target.classList.contains('highlight-word')) {
        tooltip.classList.remove('show');
        document.removeEventListener('click', hide);
      }
    });
  }, 10);
}

function readingListenPassage() {
  const p = readingState.passages[readingState.currentPassageIndex];
  speak(p.text, 'en-US');
}

/* ===== Sentence Practice (토글 안에서 동작) ===== */
function readingInitSentencePractice() {
  const p = readingState.passages[readingState.currentPassageIndex];
  const sentences = p.text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  readingState.sentences = sentences;
  readingState.currentSentenceIndex = 0;
  readingLoadSentence();
}

function readingLoadSentence() {
  const sentences = readingState.sentences;
  const idx = readingState.currentSentenceIndex;
  const total = sentences.length;

  if (idx >= total) {
    const area = document.getElementById('reading-sentence-practice');
    area.innerHTML = '<div style="text-align:center;padding:20px;color:#34d399;font-weight:600;">문장별 연습 완료</div>';
    return;
  }

  const sentence = sentences[idx];
  const area = document.getElementById('reading-sentence-practice');

  area.innerHTML = `
    <div class="sentence-practice-card">
      <div class="sentence-number">문장 ${idx + 1} / ${total}</div>
      <div class="sentence-text" id="sp-sentence">${escapeHtml(sentence)}</div>
      <div class="sentence-translation" id="sp-translation" style="display:none;"></div>
    </div>
    <div class="sentence-controls">
      <button class="btn-audio" onclick="readingSpeakSentence()">🔊 듣기</button>
      <button class="btn-audio" onclick="readingSpeakSentenceSlow()">🐢 천천히</button>
      <button class="btn-audio" onclick="readingToggleSentenceTranslation()">🔤 해석</button>
    </div>
    <div class="speed-bar">
      <button class="speed-bar-btn${getSpeechRate()===0.6?' active':''}" data-rate="0.6" onclick="onSpeedChange(0.6);this.parentElement.querySelectorAll('.speed-bar-btn').forEach(b=>b.classList.toggle('active',parseFloat(b.dataset.rate)===0.6))">느리게</button>
      <button class="speed-bar-btn${getSpeechRate()===0.85?' active':''}" data-rate="0.85" onclick="onSpeedChange(0.85);this.parentElement.querySelectorAll('.speed-bar-btn').forEach(b=>b.classList.toggle('active',parseFloat(b.dataset.rate)===0.85))">보통</button>
      <button class="speed-bar-btn${getSpeechRate()===1.0?' active':''}" data-rate="1" onclick="onSpeedChange(1.0);this.parentElement.querySelectorAll('.speed-bar-btn').forEach(b=>b.classList.toggle('active',parseFloat(b.dataset.rate)===1.0))">빠르게</button>
    </div>
    <div class="sentence-input-area">
      <input type="text" class="sentence-input" id="sp-input"
        placeholder="들은 문장을 입력해보세요 (선택)..."
        onkeydown="if(event.key==='Enter')readingCheckSentenceInput()">
      <button class="btn-primary" style="margin-top:8px;" onclick="readingCheckSentenceInput()" id="sp-check-btn">확인</button>
      <div class="sentence-feedback" id="sp-feedback" style="display:none;"></div>
    </div>
    <div class="sentence-nav">
      ${idx > 0 ? '<button class="btn-secondary" style="flex:1;" onclick="readingPrevSentence()">← 이전</button>' : ''}
      <button class="btn-primary" style="flex:1;" onclick="readingNextSentence()">다음 →</button>
    </div>
  `;

  setTimeout(() => readingSpeakSentence(), 300);
}

function readingSpeakSentence() {
  const sentence = readingState.sentences[readingState.currentSentenceIndex];
  speak(sentence, 'en-US');
}

function readingSpeakSentenceSlow() {
  const sentence = readingState.sentences[readingState.currentSentenceIndex];
  const currentRate = getSpeechRate();
  speak(sentence, 'en-US', Math.max(0.4, currentRate - 0.25));
}

function readingToggleSentenceTranslation() {
  const el = document.getElementById('sp-translation');
  if (el.style.display === 'none') {
    const p = readingState.passages[readingState.currentPassageIndex];
    const idx = readingState.currentSentenceIndex;
    if (p.translations && p.translations[idx]) {
      el.textContent = p.translations[idx];
    } else if (p.textKr) {
      const krSentences = p.textKr.split(/(?<=[.!?。])\s*/).filter(s => s.trim());
      el.textContent = krSentences[idx] || '(해석 없음)';
    } else {
      el.textContent = '(해석 데이터 없음)';
    }
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function readingCheckSentenceInput() {
  const input = document.getElementById('sp-input');
  const feedback = document.getElementById('sp-feedback');
  const checkBtn = document.getElementById('sp-check-btn');
  if (!input || checkBtn.disabled) return;

  const answer = input.value.trim();
  if (!answer) return;

  checkBtn.disabled = true;
  input.disabled = true;

  const sentence = readingState.sentences[readingState.currentSentenceIndex];
  const normalize = s => s.toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ').trim();
  const similarity = stringSimilarity(normalize(answer), normalize(sentence));

  if (typeof LiveChat !== 'undefined') LiveChat.trigger('sentenceTry');
  feedback.style.display = 'block';
  if (similarity >= 0.8) {
    feedback.className = 'sentence-feedback good';
    feedback.textContent = '잘했습니다';
    input.style.borderColor = '#10b981';
    if (typeof LiveChat !== 'undefined') LiveChat.trigger('sentenceCorrect');
  } else if (similarity >= 0.5) {
    feedback.className = 'sentence-feedback medium';
    feedback.textContent = `거의 맞았어요 (${Math.round(similarity * 100)}%)`;
    input.style.borderColor = '#f59e0b';
  } else {
    feedback.className = 'sentence-feedback poor';
    feedback.textContent = `다시 들어보세요 (${Math.round(similarity * 100)}%)`;
    input.style.borderColor = '#ef4444';
  }

  const correctEl = document.createElement('div');
  correctEl.style.cssText = 'margin-top:8px;font-size:0.9rem;color:#94a3b8;font-weight:500;';
  correctEl.textContent = sentence;
  feedback.appendChild(correctEl);
}

function readingPrevSentence() {
  if (readingState.currentSentenceIndex > 0) {
    readingState.currentSentenceIndex--;
    readingLoadSentence();
  }
}

function readingNextSentence() {
  readingState.currentSentenceIndex++;
  readingLoadSentence();
}

/* ===== Questions (지문 아래 인라인) ===== */
function readingLoadQuestion() {
  const p = readingState.passages[readingState.currentPassageIndex];
  if (readingState.currentQuestionIndex >= p.questions.length) {
    readingShowResults();
    return;
  }

  const q = p.questions[readingState.currentQuestionIndex];
  const idx = readingState.currentQuestionIndex;
  const total = p.questions.length;

  document.getElementById('reading-counter').textContent = `문제 ${idx + 1} / ${total}`;
  updateProgress((idx / total) * 100);

  const area = document.getElementById('reading-q-area');

  if (q.type === 'mcq') {
    area.innerHTML = `
      <div class="quiz-label">Q${idx + 1}</div>
      <div class="quiz-sentence">${q.question}</div>
      <div class="quiz-sentence-kr">${q.questionKr}</div>
      <div class="quiz-options" id="reading-mcq-opts"></div>
      <div id="reading-mcq-feedback" style="text-align:center;margin-top:12px;font-weight:600;font-size:0.9rem;display:none;" aria-live="polite"></div>
      <button class="btn-next" id="reading-next-btn" onclick="readingNextQuestion()">다음 →</button>
    `;
    const optsWrap = document.getElementById('reading-mcq-opts');
    q.options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.className = 'quiz-option';
      b.textContent = opt;
      b.addEventListener('click', () => readingCheckMCQ(i, b, q.answer));
      optsWrap.appendChild(b);
    });
  } else if (q.type === 'short') {
    area.innerHTML = `
      <div class="quiz-label">Q${idx + 1}</div>
      <div class="quiz-sentence">${q.question}</div>
      <div class="quiz-sentence-kr">${q.questionKr}</div>
      <input type="text" class="short-answer-input" id="reading-short-input"
        placeholder="영어로 답을 입력하세요...">
      <button class="btn-primary" id="reading-short-submit">제출</button>
      <div class="sample-answer" id="reading-sample">
        <div class="sample-answer-label">모범 답안</div>
        <div class="sample-answer-text" id="reading-sample-text"></div>
      </div>
      <button class="btn-next" id="reading-next-btn" onclick="readingNextQuestion()">다음 →</button>
    `;
    document.getElementById('reading-short-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') readingCheckShort();
    });
    document.getElementById('reading-short-submit').addEventListener('click', readingCheckShort);
  }
}

function readingCheckMCQ(selected, el, correct) {
  const opts = document.querySelectorAll('#reading-mcq-opts .quiz-option');
  opts.forEach(b => b.disabled = true);
  const feedback = document.getElementById('reading-mcq-feedback');

  if (selected === correct) {
    el.classList.add('correct');
    readingState.score++;
    feedback.textContent = '정답입니다';
    feedback.style.color = '#34d399';
    if (typeof LiveChat !== 'undefined') LiveChat.trigger('correct');
  } else {
    el.classList.add('wrong');
    opts[correct].classList.add('correct');
    feedback.innerHTML = `정답: <strong style="color:#34d399;">${opts[correct].textContent}</strong>`;
    feedback.style.color = '#f87171';
    if (typeof LiveChat !== 'undefined') LiveChat.trigger('wrong');
  }
  feedback.style.display = 'block';
  document.getElementById('reading-next-btn').className = 'btn-next show';
}

function readingCheckShort() {
  const input = document.getElementById('reading-short-input');
  const submitBtn = document.getElementById('reading-short-submit');
  if (!input || submitBtn.disabled) return;

  const answer = input.value.trim().toLowerCase();
  const p = readingState.passages[readingState.currentPassageIndex];
  const q = p.questions[readingState.currentQuestionIndex];

  submitBtn.disabled = true;
  input.disabled = true;

  const isCorrect = q.acceptableAnswers.some(a =>
    answer.includes(a.toLowerCase()) || a.toLowerCase().includes(answer)
  );

  if (isCorrect && answer.length > 0) {
    input.style.borderColor = '#10b981';
    input.style.background = 'rgba(16,185,129,0.1)';
    readingState.score++;
    if (typeof LiveChat !== 'undefined') LiveChat.trigger('correct');
  } else {
    input.style.borderColor = '#ef4444';
    input.style.background = 'rgba(239,68,68,0.1)';
  }

  document.getElementById('reading-sample-text').textContent = q.sampleAnswer;
  document.getElementById('reading-sample').classList.add('show');
  document.getElementById('reading-next-btn').className = 'btn-next show';
}

function readingNextQuestion() {
  readingState.currentQuestionIndex++;
  readingLoadQuestion();
}

function readingShowResults() {
  document.getElementById('reading-questions').style.display = 'none';
  document.getElementById('reading-results').classList.add('show');
  updateProgress(100);

  const p = readingState.passages[readingState.currentPassageIndex];
  document.getElementById('reading-final-score').textContent =
    readingState.score + ' / ' + readingState.totalQuestions;

  Progress.saveReadingPassage(
    readingState.lessonId,
    p.id,
    readingState.score,
    readingState.totalQuestions
  );
  if (typeof LiveChat !== 'undefined') LiveChat.trigger('complete');
}

function readingBackToList() {
  readingState.sentences = null;
  const container = document.getElementById('main-content');
  renderPassageList(container);
}
