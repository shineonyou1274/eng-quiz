/* ===== Vocabulary Module ===== */
let vocabState = {
  words: [],
  allWordStrings: [],
  currentIndex: 0,
  isRecording: false,
  mediaRecorder: null,
  audioChunks: [],
  recordBlob: null,
  audioUrl: null,
  quizOrder: [],
  quizIndex: 0,
  quizCorrect: 0,
  lessonId: '',
};

async function startVocab(container, lessonId) {
  const data = await loadLessonModule('vocab', lessonId);
  if (!data) return;

  vocabState = {
    words: data.words,
    allWordStrings: data.words.map(w => w.word),
    currentIndex: 0,
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    recordBlob: null,
    audioUrl: null,
    quizOrder: [],
    quizIndex: 0,
    quizCorrect: 0,
    lessonId: lessonId,
  };

  container.innerHTML = `
    <div class="section-header">
      <h2 id="vocab-title">단어 학습</h2>
      <div class="counter" id="vocab-counter"></div>
    </div>

    <!-- Learning Phase -->
    <div id="vocab-learn">
      <!-- Step 1: Word Card (스캐폴딩: 단계적 공개) -->
      <div class="step active" id="vocab-s1">
        <div class="word-card" id="vocab-card" style="cursor:pointer;" onclick="vocabRevealNext()">
          <div class="word-difficulty" id="vocab-difficulty"></div>
          <div class="word-text" id="vocab-word"></div>
          <div class="word-pron" id="vocab-pron" style="display:none;"></div>
          <div class="word-meaning" id="vocab-meaning" style="display:none;"></div>
          <div class="word-example" id="vocab-exen" style="display:none;"></div>
          <div class="word-example-kr" id="vocab-exkr" style="display:none;"></div>
          <div id="vocab-reveal-hint" style="margin-top:16px;font-size:0.8rem;color:#64748b;font-weight:600;">탭하여 발음 보기 →</div>
        </div>
        <div class="audio-row">
          <button class="btn-audio" onclick="vocabSpeakWord()" aria-label="단어 발음 듣기">🔊 단어</button>
          <button class="btn-audio" onclick="vocabSpeakExample()" aria-label="예문 발음 듣기">🔊 예문</button>
        </div>
        <button class="btn-primary" onclick="vocabGoStep(2)">퀴즈 풀기 →</button>
      </div>

      <!-- Step 2: Quiz -->
      <div class="step" id="vocab-s2">
        <div class="quiz-label">빈칸에 알맞은 단어는?</div>
        <div class="quiz-sentence" id="vocab-quiz-sent"></div>
        <div class="quiz-sentence-kr" id="vocab-quiz-kr"></div>
        <div class="quiz-options" id="vocab-quiz-opts"></div>
        <div class="hint-area">
          <button class="btn-hint" id="vocab-hint-btn" onclick="vocabShowHint()">💡 힌트</button>
          <div class="hint-text" id="vocab-hint-text"></div>
        </div>
        <div id="vocab-quiz-feedback" style="text-align:center;margin-top:12px;font-weight:700;font-size:0.95rem;display:none;" aria-live="polite"></div>
        <button class="btn-primary" id="vocab-quiz-next" style="display:none;margin-top:16px;" onclick="vocabGoStep(3)">다음 단계 →</button>
      </div>

      <!-- Step 3: Record (선택사항) -->
      <div class="step" id="vocab-s3">
        <div class="record-section">
          <div class="record-prompt">발음을 연습하시겠습니까? (선택)</div>
          <div class="record-word" id="vocab-rec-word"></div>
          <div class="record-note">🎙️ Chrome / Safari에서 마이크 허용이 필요합니다<br>녹음은 기기에만 저장되며 외부로 전송되지 않습니다.</div>
          <button class="btn-record" id="vocab-rec-btn" onclick="vocabToggleRecord()" aria-label="녹음 시작/중지">🎤</button>
          <div class="waveform" id="vocab-waveform">
            <div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div>
            <div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div><div class="wave-bar"></div>
          </div>
          <div class="record-status" id="vocab-rec-status">버튼을 눌러 녹음 시작</div>
        </div>
        <button class="btn-primary" id="vocab-rec-next" style="display:none;margin-top:16px;" onclick="vocabGoStep(4)">녹음 재생 →</button>
        <button class="btn-primary" onclick="vocabNext()" style="margin-top:12px;">녹음 없이 다음 →</button>
      </div>

      <!-- Step 4: Playback -->
      <div class="step" id="vocab-s4">
        <div class="play-section">
          <div class="play-prompt">🎧 내 녹음 듣기</div>
          <div class="play-word" id="vocab-play-word"></div>
          <button class="btn-play" onclick="vocabPlayRecord()" aria-label="녹음 재생">▶</button>
        </div>
        <button class="btn-primary" onclick="vocabNext()">다음 →</button>
      </div>
    </div>

    <!-- Review Quiz Phase -->
    <div id="vocab-review" style="display:none;">
      <div style="background:#f8fafc;border-radius:16px;padding:28px 24px;margin-bottom:20px;border:2px solid #e5e7eb;">
        <div class="quiz-label" id="vocab-review-num"></div>
        <div class="quiz-sentence" id="vocab-review-sent"></div>
        <div class="quiz-sentence-kr" id="vocab-review-kr"></div>
      </div>
      <div class="quiz-options" id="vocab-review-opts"></div>
      <button class="btn-next" id="vocab-review-next" onclick="vocabNextReview()">다음 →</button>
    </div>

    <!-- Final Screen -->
    <div class="final-screen" id="vocab-final">
      <div class="final-emoji">🎉</div>
      <div class="final-title">완료!</div>
      <div class="final-subtitle">최종 점수</div>
      <div class="final-score" id="vocab-final-score"></div>
      <br><br>
      <button class="btn-restart" onclick="startVocab(document.getElementById('main-content'), vocabState.lessonId)">다시 풀기</button>
      <button class="btn-restart" style="margin-left:8px;" onclick="navigate('#home')">홈으로</button>
    </div>
  `;

  vocabLoadCard();
}

function vocabLoadCard() {
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

  // Reset scaffolding (hide details, show only word)
  vocabState.revealStep = 0;
  document.getElementById('vocab-pron').style.display = 'none';
  document.getElementById('vocab-meaning').style.display = 'none';
  document.getElementById('vocab-exen').style.display = 'none';
  document.getElementById('vocab-exkr').style.display = 'none';
  document.getElementById('vocab-reveal-hint').textContent = '탭하여 발음 보기 →';
  document.getElementById('vocab-reveal-hint').style.display = '';

  const total = vocabState.words.length;
  const idx = vocabState.currentIndex;
  document.getElementById('vocab-counter').textContent = `단어 ${idx + 1} / ${total}`;
  updateProgress(50 * idx / total);
}

/* Scaffolding: 탭할 때마다 정보 단계적 공개 */
function vocabRevealNext() {
  vocabState.revealStep = (vocabState.revealStep || 0) + 1;
  const hint = document.getElementById('vocab-reveal-hint');

  switch (vocabState.revealStep) {
    case 1:
      document.getElementById('vocab-pron').style.display = '';
      hint.textContent = '탭하여 뜻 보기 →';
      vocabSpeakWord(); // 발음 공개 시 자동 재생
      break;
    case 2:
      document.getElementById('vocab-meaning').style.display = '';
      hint.textContent = '탭하여 예문 보기 →';
      break;
    case 3:
      document.getElementById('vocab-exen').style.display = '';
      document.getElementById('vocab-exkr').style.display = '';
      hint.style.display = 'none';
      break;
  }
}

function vocabSpeakWord() {
  speak(vocabState.words[vocabState.currentIndex].word, 'en-US');
}

function vocabSpeakExample() {
  speak(vocabState.words[vocabState.currentIndex].exEn, 'en-US');
}

function vocabGoStep(n) {
  document.querySelectorAll('#vocab-learn .step').forEach(s => s.classList.remove('active'));
  document.getElementById('vocab-s' + n).classList.add('active');

  if (n === 2) vocabLoadQuiz();
  if (n === 3) {
    const w = vocabState.words[vocabState.currentIndex];
    document.getElementById('vocab-rec-word').textContent = w.word;
    document.getElementById('vocab-rec-status').textContent = '버튼을 눌러 녹음 시작';
    const btn = document.getElementById('vocab-rec-btn');
    btn.className = 'btn-record';
    btn.textContent = '🎤';
    document.getElementById('vocab-waveform').classList.remove('active');
    vocabState.isRecording = false;
    vocabState.recordBlob = null;
    // Release previous Blob URL to prevent memory leak
    if (vocabState.audioUrl) {
      URL.revokeObjectURL(vocabState.audioUrl);
      vocabState.audioUrl = null;
    }
  }
  if (n === 4) {
    document.getElementById('vocab-play-word').textContent = vocabState.words[vocabState.currentIndex].word;
  }
}

function vocabLoadQuiz() {
  const w = vocabState.words[vocabState.currentIndex];
  const re = new RegExp('\\b' + w.word + '\\w*\\b', 'i');
  document.getElementById('vocab-quiz-sent').innerHTML =
    w.exEn.replace(re, '<span class="blank">______</span>');
  document.getElementById('vocab-quiz-kr').textContent = w.exKr;

  let opts = [w.word];
  const pool = shuffle(vocabState.allWordStrings.filter(x => x !== w.word));
  for (let i = 0; i < Math.min(3, pool.length); i++) opts.push(pool[i]);
  opts = shuffle(opts);

  const wrap = document.getElementById('vocab-quiz-opts');
  wrap.innerHTML = '';
  opts.forEach(o => {
    const b = document.createElement('button');
    b.className = 'quiz-option';
    b.textContent = o;
    b.onclick = () => vocabCheckAnswer(o, b, w.word);
    wrap.appendChild(b);
  });

  // Reset hint & feedback
  document.getElementById('vocab-hint-text').classList.remove('show');
  document.getElementById('vocab-hint-text').textContent = '';
  document.getElementById('vocab-hint-btn').style.display = w.hint ? '' : 'none';
  document.getElementById('vocab-quiz-feedback').style.display = 'none';
  document.getElementById('vocab-quiz-next').style.display = 'none';
}

function vocabShowHint() {
  const w = vocabState.words[vocabState.currentIndex];
  if (w.hint) {
    const el = document.getElementById('vocab-hint-text');
    el.textContent = '💡 ' + w.hint;
    el.classList.add('show');
  }
}

function vocabCheckAnswer(selected, el, correct) {
  document.querySelectorAll('#vocab-quiz-opts .quiz-option').forEach(b => b.disabled = true);
  const isCorrect = selected === correct;
  const feedback = document.getElementById('vocab-quiz-feedback');

  if (isCorrect) {
    el.classList.add('correct');
    Progress.saveVocabWord(vocabState.lessonId, correct, true);
    feedback.textContent = '정답입니다!';
    feedback.style.color = '#34d399';
  } else {
    el.classList.add('wrong');
    document.querySelectorAll('#vocab-quiz-opts .quiz-option').forEach(b => {
      if (b.textContent === correct) b.classList.add('correct');
    });
    Progress.saveVocabWord(vocabState.lessonId, correct, false);
    const w = vocabState.words[vocabState.currentIndex];
    feedback.innerHTML = `오답입니다. 정답은 <strong style="color:#34d399;">${correct}</strong> (${w.meaning})`;
    feedback.style.color = '#f87171';
  }

  feedback.style.display = 'block';
  document.getElementById('vocab-quiz-next').style.display = 'block';
}

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
        vocabState.audioUrl = URL.createObjectURL(vocabState.recordBlob);
        stream.getTracks().forEach(t => t.stop());
        wf.classList.remove('active');
        btn.className = 'btn-record done';
        btn.textContent = '✅';
        status.textContent = '완료! 아래 버튼을 눌러 재생하세요.';
        document.getElementById('vocab-rec-next').style.display = 'block';
      };

      vocabState.mediaRecorder.start(100);
      vocabState.isRecording = true;
      btn.className = 'btn-record recording';
      btn.textContent = '⏹';
      wf.classList.add('active');
      status.textContent = '🎙️ 녹음중...';
    } catch {
      alert('마이크 권한 필요');
    }
  } else {
    if (vocabState.mediaRecorder && vocabState.mediaRecorder.state === 'recording') {
      vocabState.mediaRecorder.stop();
      vocabState.isRecording = false;
    }
  }
}

function vocabSkipRecord() {
  vocabState.recordBlob = null;
  if (vocabState.audioUrl) {
    URL.revokeObjectURL(vocabState.audioUrl);
    vocabState.audioUrl = null;
  }
  vocabGoStep(4);
}

function vocabPlayRecord() {
  if (vocabState.audioUrl) new Audio(vocabState.audioUrl).play();
  else alert('녹음 없음');
}

function vocabNext() {
  vocabState.currentIndex++;
  if (vocabState.currentIndex >= vocabState.words.length) {
    vocabStartReview();
  } else {
    vocabGoStep(1);
    vocabLoadCard();
  }
}

/* ===== Review Quiz ===== */
function vocabStartReview() {
  document.getElementById('vocab-learn').style.display = 'none';
  document.getElementById('vocab-review').style.display = 'block';
  document.getElementById('vocab-title').textContent = '🎯 복습 퀴즈';
  updateProgress(50);

  vocabState.quizOrder = shuffle(vocabState.words);
  vocabState.quizIndex = 0;
  vocabState.quizCorrect = 0;
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
  document.getElementById('vocab-review-num').textContent = `Question ${idx + 1}`;
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

  document.getElementById('vocab-review-next').className = 'btn-next';
}

function vocabCheckReview(selected, el, correct) {
  document.querySelectorAll('#vocab-review-opts .quiz-option').forEach(b => b.disabled = true);
  if (selected === correct) {
    el.classList.add('correct');
    vocabState.quizCorrect++;
  } else {
    el.classList.add('wrong');
    document.querySelectorAll('#vocab-review-opts .quiz-option').forEach(b => {
      if (b.textContent === correct) b.classList.add('correct');
    });
  }
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
  document.getElementById('vocab-final-score').textContent =
    vocabState.quizCorrect + ' / ' + vocabState.quizOrder.length;
}
