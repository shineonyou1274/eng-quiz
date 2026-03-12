/* ===== Live Chat (방송 댓글) ===== */
const LiveChat = {
  container: null,
  viewerCount: 0,
  viewerEl: null,
  enabled: true,
  maxVisible: 5,

  // Username pool
  usernames: [
    "영어천재", "공부중zzZ", "새벽4시공부", "영어왕초보", "수능만점가즈아",
    "내신1등급", "영포자탈출", "단어암기머신", "문법요정", "독해마스터",
    "교실뒷자리", "열공모드ON", "시험전날", "잠이온다", "카페인충전",
    "열정가득", "오늘만공부", "매일영어", "꿈을향해", "목표달성러",
    "노력충", "공부하는척", "미래의통역사", "영어덕후", "갓생러",
    "자기개발중", "오늘도성장", "끝까지간다", "불타는의지", "새벽감성"
  ],

  // Message pools by event type
  messages: {
    wordNext: [
      "오 새로운 단어다", "이거 시험에 나올 듯", "발음 어렵겠다ㅋㅋ",
      "나도 이거 몰랐어", "쉬운데?", "어려워 보인다...", "이 단어 중요해!",
      "외워야지...", "ㄹㅇ 처음 보는 단어", "집중 집중!"
    ],
    correct: [
      "오오 맞췄다!!", "천재 아님?", "대박ㅋㅋㅋ", "나도 맞음ㅋ",
      "실력 좋은데?", "완벽해!", "역시 공부했네", "멋지다 ㄷㄷ",
      "ㅊㅋㅊㅋ", "나도 저렇게 되고 싶다"
    ],
    wrong: [
      "아깝다ㅠㅠ", "괜찮아 다음에!", "나도 틀렸을 듯", "힌트 쓸 걸",
      "어려웠어 그건", "다음엔 맞추자!", "에이 아쉽", "화이팅!",
      "실수할 수 있지", "그래도 배웠잖아"
    ],
    hint: [
      "힌트 쓰는 게 이득이지", "현명한 선택ㅋㅋ",
      "나도 힌트 봤을 듯", "공부하는 거니까 OK"
    ],
    sentenceCorrect: [
      "받아쓰기 잘한다!", "귀가 좋네ㅋㅋ",
      "리스닝 마스터", "와 거의 똑같이 썼네"
    ],
    sentenceTry: [
      "도전정신 좋다!", "용기 있는 자ㅋ", "직접 써보는 게 최고지"
    ],
    start: [
      "오 시작이다!", "같이 공부하자", "라이브 시작!",
      "오늘도 화이팅", "공부 방송 시작~"
    ],
    complete: [
      "수고했어!!", "오늘도 성장했네", "다음에 또 하자!",
      "대단하다 ㄹㅇ", "목표 달성!!"
    ]
  },

  init() {
    // Create chat container if not exists
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.className = 'live-chat-overlay';
    this.container.id = 'live-chat';
    document.querySelector('.app-container').appendChild(this.container);

    // Initialize viewer count (random 30-150)
    this.viewerCount = Math.floor(Math.random() * 120) + 30;
    this.updateViewerCount();

    // Periodic idle comments every 8-18 seconds
    this.startIdleComments();
  },

  updateViewerCount() {
    // Fluctuate viewer count slightly
    const change = Math.floor(Math.random() * 5) - 2;
    this.viewerCount = Math.max(10, this.viewerCount + change);

    // Update the LIVE badge or a viewer count element
    let vcEl = document.getElementById('viewer-count');
    if (!vcEl) {
      // Create viewer count next to LIVE badge
      const badge = document.querySelector('.live-badge');
      if (badge) {
        vcEl = document.createElement('span');
        vcEl.id = 'viewer-count';
        vcEl.className = 'viewer-count';
        badge.parentElement.insertBefore(vcEl, badge.nextSibling);
      }
    }
    if (vcEl) vcEl.textContent = '\uD83D\uDC41 ' + this.viewerCount;
  },

  // Get random username
  getUsername() {
    return this.usernames[Math.floor(Math.random() * this.usernames.length)];
  },

  // Trigger event - shows 1-3 comments with slight delays
  trigger(eventType) {
    if (!this.enabled || !this.container) return;
    const pool = this.messages[eventType];
    if (!pool || pool.length === 0) return;

    // Show 1-3 comments with random delays
    const count = Math.floor(Math.random() * 3) + 1;
    const used = new Set();

    for (let i = 0; i < count; i++) {
      let msgIndex;
      do {
        msgIndex = Math.floor(Math.random() * pool.length);
      } while (used.has(msgIndex) && used.size < pool.length);
      used.add(msgIndex);

      setTimeout(() => {
        this.addComment(this.getUsername(), pool[msgIndex]);
      }, i * (Math.random() * 800 + 400));
    }

    // Update viewer count
    this.updateViewerCount();
  },

  addComment(username, message) {
    if (!this.container) return;

    const comment = document.createElement('div');
    comment.className = 'live-comment';
    comment.innerHTML =
      '<span class="comment-user">' + username + '</span> ' +
      '<span class="comment-text">' + message + '</span>';

    this.container.appendChild(comment);

    // Trigger slide-up animation
    requestAnimationFrame(() => comment.classList.add('show'));

    // Remove after 5 seconds (fade out starts at 4.5s)
    setTimeout(() => {
      comment.classList.add('fade-out');
      setTimeout(() => comment.remove(), 500);
    }, 4500);

    // Limit visible comments
    while (this.container.children.length > this.maxVisible) {
      this.container.firstChild.remove();
    }
  },

  startIdleComments() {
    const idleMessages = [
      "화이팅!", "집중!", "오늘도 열공",
      "같이 공부 중~", "라이브 재밌다ㅋ"
    ];

    const scheduleNext = () => {
      const delay = Math.random() * 10000 + 8000; // 8-18 seconds
      setTimeout(() => {
        if (this.enabled && document.visibilityState === 'visible') {
          this.addComment(
            this.getUsername(),
            idleMessages[Math.floor(Math.random() * idleMessages.length)]
          );
          this.updateViewerCount();
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }
};
