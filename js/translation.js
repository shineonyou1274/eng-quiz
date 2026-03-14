/* ===== Translation Practice Module ===== */
let transState = {
  exercises: [],
  currentIndex: 0,
  hintsUsed: 0,
  score: 0,
  totalScore: 0,
  lessonId: '',
  answered: false,
};

async function startTranslation(container, lessonId) {
  const data = await loadLessonModule('translation', lessonId);
  if (!data) return;

  transState = {
    exercises: data.exercises,
    currentIndex: 0,
    hintsUsed: 0,
    score: 0,
    totalScore: 0,
    lessonId: lessonId,
    answered: false,
  };

  container.innerHTML = `
    <div class="section-header">
      <h2>번역 연습</h2>
      <div class="counter" id="trans-counter"></div>
    </div>
    <div id="trans-exercise"></div>
    <div class="final-screen" id="trans-final">
      <div class="final-title">번역 연습 완료</div>
      <div class="final-subtitle">총점</div>
      <div class="final-score" id="trans-final-score"></div>
      <div style="margin-top:24px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button class="btn-restart" onclick="startTranslation(document.getElementById('main-content'), transState.lessonId)">다시 풀기</button>
        <button class="btn-restart" onclick="navigate('#home')">홈으로</button>
      </div>
      <div class="ad-slot ad-slot-completion">
        <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-6730377739026332" data-ad-slot="9325911662" data-ad-format="auto" data-full-width-responsive="true"></ins>
      </div>
    </div>
  `;

  transLoadExercise();
}

function transLoadExercise() {
  if (transState.currentIndex >= transState.exercises.length) {
    transShowFinal();
    return;
  }

  const ex = transState.exercises[transState.currentIndex];
  const idx = transState.currentIndex;
  const total = transState.exercises.length;

  document.getElementById('trans-counter').textContent = `문장 ${idx + 1} / ${total}`;
  updateProgress((idx / total) * 100);
  transState.hintsUsed = 0;
  transState.answered = false;

  const dirLabel = ex.direction === 'kr2en' ? '한국어 → English' : 'English → 한국어';
  const placeholder = ex.direction === 'kr2en'
    ? '영어로 번역하세요...'
    : '한국어로 번역하세요...';

  const area = document.getElementById('trans-exercise');
  area.innerHTML = `
    <div class="translation-direction">
      <span class="direction-badge">${dirLabel}</span>
    </div>
    <div class="source-card">
      <div class="source-text">${escapeHtmlTrans(ex.source)}</div>
    </div>
    ${ex.direction === 'kr2en' ? `<div class="audio-row"><button class="btn-audio" id="trans-listen-btn" style="display:none;">🔊 정답 듣기</button></div>` : ''}
    <textarea class="translation-input" id="trans-input" placeholder="${placeholder}" onkeydown="if(event.key==='Enter'&&event.ctrlKey)transSubmit()"></textarea>
    <div class="translation-buttons">
      <button class="btn-primary" id="trans-submit-btn" onclick="transSubmit()">제출</button>
      <button class="btn-hint" id="trans-hint-btn" onclick="transShowHint()">💡 힌트</button>
    </div>
    <div class="hint-counter" id="trans-hint-counter"></div>
    <div class="hint-text" id="trans-hint-text"></div>
    <div class="translation-feedback" id="trans-feedback"></div>
    <button class="btn-next" id="trans-next-btn" onclick="transNext()">다음 →</button>
  `;

  // Safe event listener for listen button (avoids inline script injection)
  const listenBtn = document.getElementById('trans-listen-btn');
  if (listenBtn) {
    listenBtn.addEventListener('click', () => speak(ex.acceptableAnswers[0], 'en-US'));
  }
}

function escapeHtmlTrans(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function transShowHint() {
  if (typeof LiveChat !== 'undefined') LiveChat.trigger('hint');
  const ex = transState.exercises[transState.currentIndex];
  if (transState.hintsUsed >= ex.hints.length) return;

  transState.hintsUsed++;
  const hint = ex.hints[transState.hintsUsed - 1];

  const hintEl = document.getElementById('trans-hint-text');
  hintEl.textContent = '💡 ' + hint;
  hintEl.classList.add('show');

  document.getElementById('trans-hint-counter').textContent =
    `힌트 ${transState.hintsUsed} / ${ex.hints.length}`;

  if (transState.hintsUsed >= ex.hints.length) {
    document.getElementById('trans-hint-btn').disabled = true;
    document.getElementById('trans-hint-btn').style.opacity = '0.5';
  }
}

function transSubmit() {
  if (transState.answered) return;
  transState.answered = true;

  const ex = transState.exercises[transState.currentIndex];
  const input = document.getElementById('trans-input');
  const answer = input.value.trim();

  if (!answer) {
    transState.answered = false;
    input.style.borderColor = '#ef4444';
    return;
  }

  input.disabled = true;
  document.getElementById('trans-submit-btn').disabled = true;

  // Score calculation (힌트 감점 제거: 힌트는 학습 도구)
  const result = transScoreAnswer(answer, ex);
  const maxPoints = 10;
  const rawScore = Math.round(result.matchPercent * maxPoints);
  const finalScore = rawScore;

  transState.score += finalScore;
  transState.totalScore += maxPoints;

  // Save progress
  Progress.saveTranslation(transState.lessonId, ex.id, finalScore, maxPoints);

  // Feedback — 자연어 피드백으로 전환
  const feedback = document.getElementById('trans-feedback');

  // 키워드 매칭 상세 분석
  const keywordResults = ex.keyWords.map(kw => {
    const found = answer.toLowerCase().includes(kw.toLowerCase());
    return { word: kw, found };
  });
  const matchedCount = keywordResults.filter(k => k.found).length;
  const totalKeywords = keywordResults.length;

  let level, message;
  if (result.matchPercent >= 0.8) {
    level = 'good';
    message = matchedCount === totalKeywords ? '잘했습니다' : '거의 완벽합니다';
    if (typeof LiveChat !== 'undefined') LiveChat.trigger('correct');
  } else if (result.matchPercent >= 0.5) {
    level = 'medium';
    message = '기본 구조는 맞았습니다';
  } else {
    level = 'poor';
    message = '모범 답안을 확인해보세요';
    if (typeof LiveChat !== 'undefined') LiveChat.trigger('wrong');
  }

  // 키워드 O/X 시각화 (놓친 키워드에 한국어 뜻 추가)
  const keywordHtml = keywordResults.map(k => {
    if (k.found) {
      return `<span class="kw-match">✓ ${k.word}</span>`;
    } else {
      // 단어의 한국어 뜻 찾기 (vocab 데이터에서)
      const vocabMatch = (AppState.lessonData['vocab/' + transState.lessonId]?.words || [])
        .find(v => v.word.toLowerCase() === k.word.toLowerCase());
      const hint = vocabMatch ? ` (${vocabMatch.meaning})` : '';
      return `<span class="kw-miss">✗ ${k.word}${hint}</span>`;
    }
  }).join('');

  feedback.className = `translation-feedback show ${level}`;
  feedback.innerHTML = `
    <div class="feedback-message">${message}</div>
    <div class="feedback-keywords-summary">핵심 표현 ${matchedCount} / ${totalKeywords}개 포함</div>
    <div class="feedback-keywords-detail">${keywordHtml}</div>
    <div class="feedback-answer-label">모범 답안</div>
    <div class="feedback-answer">${ex.acceptableAnswers[0]}</div>
  `;

  // Show listen button for kr2en
  const listenBtn = document.getElementById('trans-listen-btn');
  if (listenBtn) listenBtn.style.display = '';

  document.getElementById('trans-next-btn').className = 'btn-next show';
}

function transScoreAnswer(answer, ex) {
  const normalize = s => s.toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ').trim();
  const normalizedAnswer = normalize(answer);

  // Exact match check
  for (const acceptable of ex.acceptableAnswers) {
    if (normalizedAnswer === normalize(acceptable)) {
      return { matchPercent: 1.0 };
    }
  }

  // Keyword matching
  let matched = 0;
  for (const kw of ex.keyWords) {
    if (normalizedAnswer.includes(kw.toLowerCase())) {
      matched++;
    }
  }

  const keywordScore = ex.keyWords.length > 0 ? matched / ex.keyWords.length : 0;

  // Levenshtein-based similarity for best match
  let bestSimilarity = 0;
  for (const acceptable of ex.acceptableAnswers) {
    const sim = stringSimilarity(normalizedAnswer, normalize(acceptable));
    if (sim > bestSimilarity) bestSimilarity = sim;
  }

  // Combine: 60% keyword + 40% similarity
  const combined = keywordScore * 0.6 + bestSimilarity * 0.4;
  return { matchPercent: Math.min(1.0, combined) };
}

function stringSimilarity(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  // Simple bigram similarity
  const getBigrams = s => {
    const bigrams = new Set();
    for (let i = 0; i < s.length - 1; i++) bigrams.add(s.slice(i, i + 2));
    return bigrams;
  };

  const aBigrams = getBigrams(a);
  const bBigrams = getBigrams(b);
  let intersection = 0;
  for (const bg of aBigrams) {
    if (bBigrams.has(bg)) intersection++;
  }
  return (2 * intersection) / (aBigrams.size + bBigrams.size);
}

function transNext() {
  transState.currentIndex++;
  transLoadExercise();
}

function transShowFinal() {
  document.getElementById('trans-exercise').style.display = 'none';
  document.getElementById('trans-final').classList.add('show');
  if (typeof LiveChat !== 'undefined') LiveChat.trigger('complete');
  updateProgress(100);
  document.getElementById('trans-final-score').textContent =
    transState.score + ' / ' + transState.totalScore;
  if (typeof tryLoadAd === 'function') tryLoadAd();
}
