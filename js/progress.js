/* ===== Progress Manager (localStorage) ===== */
const STORAGE_KEY = 'engquiz_progress';

const Progress = {
  _data: null,

  _load() {
    if (this._data) return this._data;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this._data = raw ? JSON.parse(raw) : { vocab: {}, reading: {}, translation: {} };
    } catch {
      this._data = { vocab: {}, reading: {}, translation: {} };
    }
    return this._data;
  },

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch (e) {
      console.error('진도 저장 실패:', e);
    }
  },

  getAll() {
    return this._load();
  },

  /* Vocab progress */
  saveVocabWord(lessonId, word, correct) {
    const data = this._load();
    if (!data.vocab[lessonId]) data.vocab[lessonId] = {};
    const entry = data.vocab[lessonId][word] || { mastery: 0, correct: 0, attempts: 0, lastReview: '' };
    entry.attempts++;
    if (correct) {
      entry.correct++;
      entry.mastery = Math.min(3, entry.mastery + 1);
    } else {
      entry.mastery = 0;
    }
    entry.lastReview = new Date().toISOString().slice(0, 10);
    data.vocab[lessonId][word] = entry;
    this._save();
  },

  getVocabMastery(lessonId) {
    const data = this._load();
    const lesson = data.vocab[lessonId] || {};
    return lesson;
  },

  /* Reading progress */
  saveReadingPassage(lessonId, passageId, score, total) {
    const data = this._load();
    if (!data.reading[lessonId]) data.reading[lessonId] = {};
    data.reading[lessonId][passageId] = {
      completed: true,
      score,
      total,
      date: new Date().toISOString().slice(0, 10)
    };
    this._save();
  },

  /* Translation progress */
  saveTranslation(lessonId, exerciseId, score, total) {
    const data = this._load();
    if (!data.translation[lessonId]) data.translation[lessonId] = {};
    data.translation[lessonId][exerciseId] = {
      completed: true,
      score,
      total,
      date: new Date().toISOString().slice(0, 10)
    };
    this._save();
  },

  /* Module progress summary for home screen */
  getModuleProgress(module, lessonId) {
    const data = this._load();
    const moduleData = data[module]?.[lessonId] || {};
    const count = Object.keys(moduleData).length;

    if (module === 'vocab') {
      const mastered = Object.values(moduleData).filter(v => v.mastery >= 2).length;
      return { percent: count > 0 ? Math.round((mastered / Math.max(count, 1)) * 100) : 0, text: count > 0 ? `${mastered}개 마스터` : '시작 전' };
    }
    if (module === 'reading') {
      const completed = Object.values(moduleData).filter(v => v.completed).length;
      return { percent: completed > 0 ? Math.min(100, completed * 50) : 0, text: completed > 0 ? `${completed}개 지문 완료` : '시작 전' };
    }
    if (module === 'translation') {
      const completed = Object.values(moduleData).filter(v => v.completed).length;
      return { percent: completed > 0 ? Math.min(100, completed * 10) : 0, text: completed > 0 ? `${completed}문장 완료` : '시작 전' };
    }
    return { percent: 0, text: '시작 전' };
  }
};
