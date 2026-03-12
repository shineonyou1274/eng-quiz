/* ===== Reading Comprehension Module ===== */
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

  // Also load vocab for tooltip lookups
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
      <div class="passage-title">📄 ${p.title}</div>
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

  // Highlight vocabulary words in passage (XSS-safe: use data attributes, not inline onclick)
  let passageHtml = escapeHtml(p.text);
  if (p.highlightWords && p.highlightWords.length > 0) {
    p.highlightWords.forEach(word => {
      const re = new RegExp('\\b(' + escapeRegex(word) + '\\w*)\\b', 'gi');
      passageHtml = passageHtml.replace(re, '<span class="highlight-word" data-word="$1">$1</span>');
    });
  }

  // Convert newlines to paragraphs
  passageHtml = passageHtml.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('');

  container.innerHTML = `
    <div class="section-header">
      <h2>${p.title}</h2>
      <div class="counter" id="reading-counter">지문 읽기</div>
    </div>
    <div class="passage-card" id="reading-passage">${passageHtml}</div>
    <div class="audio-row">
      <button class="btn-audio" onclick="readingListenPassage()">🔊 지문 듣기</button>
    </div>
    <button class="btn-primary" onclick="readingStartQuestions()">문제 풀기 →</button>

    <!-- Tooltip -->
    <div class="word-tooltip" id="reading-tooltip"></div>

    <!-- Questions Area (hidden initially) -->
    <div id="reading-questions" style="display:none;"></div>

    <!-- Results -->
    <div class="final-screen" id="reading-results">
      <div class="final-emoji">📖</div>
      <div class="final-title">독해 완료!</div>
      <div class="final-subtitle">점수</div>
      <div class="final-score" id="reading-final-score"></div>
      <br><br>
      <button class="btn-restart" onclick="readingSelectPassage(readingState.currentPassageIndex)">다시 풀기</button>
      <button class="btn-restart" style="margin-left:8px;" onclick="readingBackToList()">지문 목록</button>
      <button class="btn-restart" style="margin-left:8px;" onclick="navigate('#home')">홈으로</button>
    </div>
  `;

  // Event delegation for highlight words (XSS-safe)
  document.getElementById('reading-passage').addEventListener('click', function(e) {
    const hw = e.target.closest('.highlight-word');
    if (hw) readingShowTooltip(e, hw.dataset.word);
  });
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

  // Find in vocab
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

  // Position near click
  const rect = event.target.getBoundingClientRect();
  tooltip.style.left = Math.min(rect.left, window.innerWidth - 290) + 'px';
  tooltip.style.top = (rect.bottom + 8) + 'px';
  tooltip.classList.add('show');

  // Hide on click elsewhere
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
  speak(p.text, 'en-US', 0.85);
}

function readingStartQuestions() {
  document.getElementById('reading-passage').style.display = 'none';
  document.querySelector('.audio-row').style.display = 'none';
  document.querySelector('#main-content > .btn-primary').style.display = 'none';

  document.getElementById('reading-questions').style.display = 'block';
  readingState.currentQuestionIndex = 0;
  readingState.score = 0;
  readingLoadQuestion();
}

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

  const area = document.getElementById('reading-questions');

  if (q.type === 'mcq') {
    let optsHtml = q.options.map((opt, i) => `
      <button class="quiz-option" onclick="readingCheckMCQ(${i}, this, ${q.answer})">${opt}</button>
    `).join('');

    area.innerHTML = `
      <div class="quiz-label">Question ${idx + 1}</div>
      <div class="quiz-sentence">${q.question}</div>
      <div class="quiz-sentence-kr">${q.questionKr}</div>
      <div class="quiz-options" id="reading-mcq-opts">${optsHtml}</div>
      <button class="btn-next" id="reading-next-btn" onclick="readingNextQuestion()">다음 →</button>
    `;
  } else if (q.type === 'short') {
    area.innerHTML = `
      <div class="quiz-label">Question ${idx + 1}</div>
      <div class="quiz-sentence">${q.question}</div>
      <div class="quiz-sentence-kr">${q.questionKr}</div>
      <input type="text" class="short-answer-input" id="reading-short-input"
        placeholder="영어로 답을 입력하세요..." onkeydown="if(event.key==='Enter')readingCheckShort()">
      <button class="btn-primary" id="reading-short-submit" onclick="readingCheckShort()">제출</button>
      <div class="sample-answer" id="reading-sample">
        <div class="sample-answer-label">모범 답안</div>
        <div class="sample-answer-text" id="reading-sample-text"></div>
      </div>
      <button class="btn-next" id="reading-next-btn" onclick="readingNextQuestion()">다음 →</button>
    `;
  }
}

function readingCheckMCQ(selected, el, correct) {
  document.querySelectorAll('#reading-mcq-opts .quiz-option').forEach(b => b.disabled = true);
  if (selected === correct) {
    el.classList.add('correct');
    readingState.score++;
  } else {
    el.classList.add('wrong');
    document.querySelectorAll('#reading-mcq-opts .quiz-option')[correct].classList.add('correct');
  }
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

  // Check against acceptable answers
  const isCorrect = q.acceptableAnswers.some(a =>
    answer.includes(a.toLowerCase()) || a.toLowerCase().includes(answer)
  );

  if (isCorrect && answer.length > 0) {
    input.style.borderColor = '#10b981';
    input.style.background = '#d1fae5';
    readingState.score++;
  } else {
    input.style.borderColor = '#ef4444';
    input.style.background = '#fee2e2';
  }

  // Show sample answer
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
}

function readingBackToList() {
  const container = document.getElementById('main-content');
  renderPassageList(container);
}
