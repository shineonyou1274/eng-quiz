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
      // 완화된 감소: 한 번에 0으로 리셋하지 않고 1단계만 감소
      entry.mastery = Math.max(0, entry.mastery - 1);
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

  /* Module progress summary for home screen
     totalItems: 전체 항목 수 (데이터에서 전달) */
  getModuleProgress(module, lessonId, totalItems) {
    const data = this._load();
    const moduleData = data[module]?.[lessonId] || {};

    if (module === 'vocab') {
      const mastered = Object.values(moduleData).filter(v => v.mastery >= 2).length;
      const total = totalItems || Object.keys(moduleData).length || 1;
      const percent = Math.round((mastered / total) * 100);
      return { percent, text: mastered > 0 ? `${mastered}/${total} 마스터` : '시작 전' };
    }
    if (module === 'reading') {
      const completed = Object.values(moduleData).filter(v => v.completed).length;
      const total = totalItems || 1;
      const percent = Math.round((completed / total) * 100);
      return { percent, text: completed > 0 ? `${completed}/${total} 완료` : '시작 전' };
    }
    if (module === 'translation') {
      const completed = Object.values(moduleData).filter(v => v.completed).length;
      const total = totalItems || 1;
      const percent = Math.round((completed / total) * 100);
      return { percent, text: completed > 0 ? `${completed}/${total} 완료` : '시작 전' };
    }
    return { percent: 0, text: '시작 전' };
  }
};
