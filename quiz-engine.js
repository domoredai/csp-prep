/*=============================================
   CSP Exam Prep — Quiz Engine v3.0
   Powers all interactive quizzes: daily pages,
   weekly reviews, monthly exams, final review.
   Persists progress + wrong answers via localStorage.

   v3 adds:
   - spaced-repetition wrong-answer bank (learning → mastered)
   - daily activity / streak tracking
   - automatic local snapshots + restore
   - merge import / richer export
   - light/dark theme
   - global search (weeks, exams, glossary)
   - cross-page knowledge-point links
   All existing storage keys, quiz ids and question ids are preserved.
   =============================================*/

(function() {
  'use strict';

  // ============ STORAGE ============
  const STORAGE_KEY_PROGRESS = 'csp_study_progress';
  const STORAGE_KEY_WRONG = 'csp_wrong_questions';
  const STORAGE_KEY_VOCAB = 'csp_vocab_list';
  const STORAGE_KEY_ACTIVITY = 'csp_activity';
  const STORAGE_KEY_SETTINGS = 'csp_settings';
  const STORAGE_KEY_BACKUPS = 'csp_backups';
  const STORAGE_KEY_META = 'csp_meta';
  const STORAGE_KEY_SCHEMA = 'csp_schema_version';

  const SCHEMA_VERSION = 3;
  const APP_VERSION = '3.0.0';
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Spaced repetition: days until the next review for each stage.
  // stage 0 = just missed, 1..3 = increasing confidence, 3 = mastered.
  const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14];
  const MASTER_STAGE = 3;
  // Correct answers given less than this after the previous review don't
  // advance the stage (prevents "click again immediately" from mastering).
  const REVIEW_MIN_GAP_MS = 6 * 60 * 60 * 1000;
  const MAX_BACKUPS = 6;
  // Option positions are balanced deterministically per quiz. Bumping this
  // version would require a new migration for saved answer indexes.
  const OPTION_ORDER_VERSION = 3;

  // ============ SAFE STORAGE ============
  let lastStorageError = null;

  function safeGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      return true;
    } catch (e) {
      lastStorageError = e;
      // Most likely QuotaExceededError — drop the oldest backup and retry once.
      try {
        if (key !== STORAGE_KEY_BACKUPS) {
          const list = safeGet(STORAGE_KEY_BACKUPS, []);
          if (list.length > 1) {
            list.pop();
            localStorage.setItem(STORAGE_KEY_BACKUPS, JSON.stringify(list));
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
            lastStorageError = null;
            return true;
          }
        }
      } catch (e2) { /* ignore */ }
      try {
        document.dispatchEvent(new CustomEvent('csp-storage-error', { detail: { key: key, error: String(e) } }));
      } catch (e3) { /* ignore */ }
      return false;
    }
  }

  function loadProgress() {
    const v = safeGet(STORAGE_KEY_PROGRESS, {});
    return v && typeof v === 'object' ? v : {};
  }
  function saveProgress(data) { return safeSet(STORAGE_KEY_PROGRESS, data); }

  function loadWrongQuestions() {
    const v = safeGet(STORAGE_KEY_WRONG, []);
    return Array.isArray(v) ? v : [];
  }
  function saveWrongQuestions(data) { return safeSet(STORAGE_KEY_WRONG, data); }

  function loadVocabData() { return safeGet(STORAGE_KEY_VOCAB, []) || []; }
  function saveVocabData(list) { return safeSet(STORAGE_KEY_VOCAB, list); }

  function loadActivity() {
    const v = safeGet(STORAGE_KEY_ACTIVITY, {});
    return v && typeof v === 'object' ? v : {};
  }
  function saveActivity(data) { return safeSet(STORAGE_KEY_ACTIVITY, data); }

  function loadSettings() {
    const v = safeGet(STORAGE_KEY_SETTINGS, {});
    const s = v && typeof v === 'object' ? v : {};
    return {
      theme: s.theme === 'dark' || s.theme === 'light' ? s.theme : 'auto',
      dailyGoal: Number(s.dailyGoal) > 0 ? Number(s.dailyGoal) : 20,
      startDate: typeof s.startDate === 'string' ? s.startDate : '',
      reviewEnabled: s.reviewEnabled !== false
    };
  }
  function saveSettings(s) { return safeSet(STORAGE_KEY_SETTINGS, s); }

  function loadMeta() {
    const v = safeGet(STORAGE_KEY_META, {});
    return v && typeof v === 'object' ? v : {};
  }
  function saveMeta(m) { return safeSet(STORAGE_KEY_META, m); }

  // ============ DATES ============
  function pad2(n) { return String(n).padStart(2, '0'); }
  function dayKey(date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function addDays(base, days) { return new Date(base.getTime() + days * DAY_MS); }
  function startOfDay(date) {
    const d = new Date(date || Date.now());
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function parseDate(v) { const t = Date.parse(v); return isNaN(t) ? 0 : t; }

  // ============ SETTINGS / THEME ============
  function applyTheme(theme) {
    const resolved = theme === 'auto'
      ? ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light')
      : theme;
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.style.colorScheme = resolved;
    return resolved;
  }

  function setTheme(theme) {
    const s = loadSettings();
    s.theme = theme === 'dark' || theme === 'light' ? theme : 'auto';
    saveSettings(s);
    return applyTheme(s.theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    updateThemeButtons(next);
    return next;
  }

  function updateThemeButtons(theme) {
    const t = theme || (document.documentElement.getAttribute('data-theme') || 'light');
    document.querySelectorAll('.theme-toggle').forEach(function(btn) {
      btn.textContent = t === 'dark' ? '☀️' : '🌙';
      btn.title = t === 'dark' ? '切换浅色 / Light mode' : '切换深色 / Dark mode';
      btn.setAttribute('aria-label', btn.title);
    });
  }

  // ============ ACTIVITY / STREAK ============
  function bumpActivity(n) {
    const activity = loadActivity();
    const k = dayKey();
    activity[k] = (activity[k] || 0) + (n || 1);
    const cutoff = dayKey(addDays(new Date(), -550));
    for (const key of Object.keys(activity)) {
      if (key < cutoff) delete activity[key];
    }
    saveActivity(activity);
    return activity[k];
  }

  function getStreak(activity) {
    const a = activity || loadActivity();
    let streak = 0;
    let cursor = startOfDay();
    if (!a[dayKey(cursor)]) {
      cursor = addDays(cursor, -1);
      if (!a[dayKey(cursor)]) return 0;
    }
    while (a[dayKey(cursor)]) {
      streak++;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function getActivitySeries(days) {
    const a = loadActivity();
    const n = days || 14;
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = addDays(startOfDay(), -i);
      out.push({ date: dayKey(d), count: a[dayKey(d)] || 0 });
    }
    return out;
  }

  // ============ WRONG-ANSWER BANK / SPACED REPETITION ============
  function entryId(quizId, qIndex) { return String(quizId) + '#' + String(qIndex); }

  function getEntryKey(w) {
    return w.id || entryId(w.quizId, w.qIndex);
  }

  function snapshotQuestion(q) {
    return {
      text: q.text,
      options: (q.options || []).slice(),
      correct: q.correct,
      explanation: q.explanation || '',
      related: (q.related || []).slice()
    };
  }

  function scheduleAfterWrong(entry, now) {
    entry.stage = 0;
    entry.status = 'learning';
    entry.lapses = (entry.lapses || 0) + 1;
    entry.nextReviewAt = addDays(now, REVIEW_INTERVALS_DAYS[0]).toISOString();
  }

  function scheduleAfterCorrect(entry, now) {
    const last = parseDate(entry.lastReviewedAt);
    const canAdvance = !last || (now.getTime() - last) >= REVIEW_MIN_GAP_MS;
    entry.lastAttemptCorrect = true;
    entry.lastAttemptAt = now.toISOString();
    if (!canAdvance) return;
    entry.lastReviewedAt = now.toISOString();
    entry.stage = Math.min((entry.stage || 0) + 1, MASTER_STAGE);
    if (entry.stage >= MASTER_STAGE) {
      entry.status = 'mastered';
      entry.masteredAt = now.toISOString();
      entry.nextReviewAt = null;
    } else {
      entry.status = 'learning';
      entry.nextReviewAt = addDays(now, REVIEW_INTERVALS_DAYS[entry.stage] || 7).toISOString();
    }
  }

  function recordAttempt(quiz, qIndex) {
    const q = quiz.questions[qIndex];
    if (!q) return null;
    const chosen = quiz.answers[qIndex];
    const isCorrect = chosen === q.correct;
    const now = new Date();
    const id = entryId(quiz.quizId, qIndex);
    const wrongs = loadWrongQuestions();
    let entry = null;
    for (const w of wrongs) {
      if (getEntryKey(w) === id) { entry = w; break; }
    }

    if (!entry) {
      if (isCorrect) return null; // First attempt correct — nothing to track.
      entry = {
        id: id,
        quizId: quiz.quizId,
        quizTitle: quiz.quizTitle,
        quizTopic: quiz.quizTopic,
        qIndex: qIndex,
        question: truncateText(q.text, 120),
        correctAnswer: q.options[q.correct],
        yourAnswer: chosen !== null && chosen !== undefined ? q.options[chosen] : 'Unanswered',
        attempts: 1,
        lastAttemptCorrect: false,
        status: 'learning',
        stage: 0,
        lapses: 1,
        firstWrongAt: now.toISOString(),
        timestamp: now.toISOString(),
        updatedAt: now.toISOString(),
        full: snapshotQuestion(q)
      };
      scheduleAfterWrong(entry, now);
      wrongs.push(entry);
      saveWrongQuestions(wrongs);
      return entry;
    }

    entry.attempts = (entry.attempts || 1) + 1;
    entry.yourAnswer = chosen !== null && chosen !== undefined ? q.options[chosen] : 'Unanswered';
    entry.updatedAt = now.toISOString();
    if (!entry.full) entry.full = snapshotQuestion(q);
    if (!entry.firstWrongAt) entry.firstWrongAt = entry.timestamp || now.toISOString();

    if (isCorrect) {
      scheduleAfterCorrect(entry, now);
    } else {
      scheduleAfterWrong(entry, now);
      entry.lastAttemptCorrect = false;
      entry.lastAttemptAt = now.toISOString();
    }
    saveWrongQuestions(wrongs);
    return entry;
  }

  function findWrongEntry(id) {
    const wrongs = loadWrongQuestions();
    for (const w of wrongs) {
      if (getEntryKey(w) === id) return { entry: w, list: wrongs };
    }
    return null;
  }

  function isDue(entry, now) {
    if (!entry || entry.status === 'mastered') return false;
    const t = parseDate(entry.nextReviewAt);
    if (!t) return true;
    return t <= (now || Date.now());
  }

  function getDueReviews(limit) {
    const now = Date.now();
    const due = loadWrongQuestions()
      .filter(function(w) { return isDue(w, now); })
      .sort(function(a, b) { return parseDate(a.nextReviewAt) - parseDate(b.nextReviewAt); });
    return typeof limit === 'number' ? due.slice(0, limit) : due;
  }

  function getReviewStats() {
    const now = Date.now();
    const list = loadWrongQuestions();
    let learning = 0, mastered = 0, due = 0, dueToday = 0, overdue = 0;
    let nextAt = 0;
    for (const w of list) {
      if (w.status === 'mastered') { mastered++; continue; }
      learning++;
      const t = parseDate(w.nextReviewAt);
      if (!t || t <= now) {
        due++;
        if (!t || t < startOfDay(now).getTime()) overdue++;
      }
      if (t && t > now && t <= now + DAY_MS) dueToday++;
      if (t && (!nextAt || t < nextAt)) nextAt = t;
    }
    return {
      total: list.length,
      learning: learning,
      mastered: mastered,
      due: due,
      dueToday: dueToday,
      overdue: overdue,
      nextReviewAt: nextAt ? new Date(nextAt).toISOString() : null
    };
  }

  function reviewAnswer(id, optionIndex) {
    const found = findWrongEntry(id);
    if (!found) return { ok: false, error: 'not-found' };
    const entry = found.entry;
    const full = entry.full;
    if (!full || !Array.isArray(full.options)) return { ok: false, error: 'no-question-data' };
    const now = new Date();
    const isCorrect = optionIndex === full.correct;

    entry.attempts = (entry.attempts || 1) + 1;
    entry.yourAnswer = optionIndex !== null && optionIndex !== undefined ? full.options[optionIndex] : 'Unanswered';
    entry.updatedAt = now.toISOString();
    if (!entry.firstWrongAt) entry.firstWrongAt = entry.timestamp || now.toISOString();
    if (!Array.isArray(entry.history)) entry.history = [];
    entry.history.push({ at: now.toISOString(), ok: isCorrect ? 1 : 0 });
    if (entry.history.length > 20) entry.history = entry.history.slice(-20);

    if (isCorrect) {
      entry.lastReviewedAt = now.toISOString();
      entry.stage = Math.min((entry.stage || 0) + 1, MASTER_STAGE);
      entry.lastAttemptCorrect = true;
      entry.lastAttemptAt = now.toISOString();
      if (entry.stage >= MASTER_STAGE) {
        entry.status = 'mastered';
        entry.masteredAt = now.toISOString();
        entry.nextReviewAt = null;
      } else {
        entry.status = 'learning';
        entry.nextReviewAt = addDays(now, REVIEW_INTERVALS_DAYS[entry.stage] || 7).toISOString();
      }
    } else {
      scheduleAfterWrong(entry, now);
      entry.lastAttemptCorrect = false;
      entry.lastAttemptAt = now.toISOString();
    }
    saveWrongQuestions(found.list);
    bumpActivity(1);
    maybeAutoBackup();
    return {
      ok: true,
      correct: isCorrect,
      correctIndex: full.correct,
      explanation: full.explanation || '',
      related: full.related || [],
      entry: entry
    };
  }

  function markMastered(id) {
    const found = findWrongEntry(id);
    if (!found) return false;
    found.entry.status = 'mastered';
    found.entry.stage = MASTER_STAGE;
    found.entry.masteredAt = new Date().toISOString();
    found.entry.nextReviewAt = null;
    found.entry.updatedAt = new Date().toISOString();
    saveWrongQuestions(found.list);
    return true;
  }

  function snoozeReview(id, days) {
    const found = findWrongEntry(id);
    if (!found) return false;
    found.entry.status = 'learning';
    found.entry.nextReviewAt = addDays(new Date(), days || 1).toISOString();
    found.entry.updatedAt = new Date().toISOString();
    saveWrongQuestions(found.list);
    return true;
  }

  function removeWrongEntry(id) {
    const list = loadWrongQuestions().filter(function(w) { return getEntryKey(w) !== id; });
    saveWrongQuestions(list);
    return true;
  }

  // ============ BACKUPS ============
  function loadBackups() {
    const v = safeGet(STORAGE_KEY_BACKUPS, []);
    return Array.isArray(v) ? v : [];
  }

  function backupNow(reason) {
    const snap = {
      at: new Date().toISOString(),
      reason: reason || 'manual',
      appVersion: APP_VERSION,
      schema: SCHEMA_VERSION,
      progress: loadProgress(),
      wrong: loadWrongQuestions(),
      vocab: loadVocabData(),
      activity: loadActivity(),
      settings: loadSettings()
    };
    let list = loadBackups();
    list.unshift(snap);
    while (list.length > MAX_BACKUPS) list.pop();
    let json = JSON.stringify(list);
    while (json.length > 3.2 * 1024 * 1024 && list.length > 1) {
      list.pop();
      json = JSON.stringify(list);
    }
    const ok = safeSet(STORAGE_KEY_BACKUPS, json);
    const meta = loadMeta();
    meta.lastBackupAt = snap.at;
    meta.answeredSinceBackup = 0;
    saveMeta(meta);
    if (ok) {
      try { document.dispatchEvent(new CustomEvent('csp-backup-created', { detail: { at: snap.at } })); } catch (e) {}
    }
    return ok ? snap : null;
  }

  function maybeAutoBackup() {
    const meta = loadMeta();
    meta.answeredSinceBackup = (meta.answeredSinceBackup || 0) + 1;
    saveMeta(meta);
    const last = parseDate(meta.lastBackupAt);
    const stale = !last || (Date.now() - last) > 12 * 60 * 60 * 1000;
    if (meta.answeredSinceBackup >= 25 || stale) {
      backupNow('auto');
    }
  }

  function restoreBackup(index) {
    const list = loadBackups();
    const snap = list[index];
    if (!snap) return { ok: false, error: 'not-found' };
    backupNow('before-restore');
    saveProgress(snap.progress || {});
    saveWrongQuestions(snap.wrong || []);
    saveVocabData(snap.vocab || []);
    saveActivity(snap.activity || {});
    if (snap.settings) {
      const cur = loadSettings();
      saveSettings({
        theme: cur.theme,
        dailyGoal: snap.settings.dailyGoal || cur.dailyGoal,
        startDate: snap.settings.startDate || cur.startDate,
        reviewEnabled: snap.settings.reviewEnabled !== false
      });
    }
    return { ok: true, at: snap.at, progress: Object.keys(snap.progress || {}).length, wrong: (snap.wrong || []).length };
  }

  // ============ MIGRATION ============
  function migrate() {
    const v = parseInt(safeGet(STORAGE_KEY_SCHEMA, 0), 10) || 0;
    if (v >= SCHEMA_VERSION) return;
    const now = Date.now();

    // 1. Wrong-answer bank → add ids, status, stage, nextReviewAt.
    const wrongs = loadWrongQuestions();
    let changed = false;
    for (const w of wrongs) {
      if (!w.id) { w.id = entryId(w.quizId, w.qIndex); changed = true; }
      if (w.status !== 'mastered' && w.status !== 'learning') {
        w.status = 'learning';
        changed = true;
      }
      if (typeof w.stage !== 'number') {
        w.stage = w.lastAttemptCorrect ? 1 : 0;
        changed = true;
      }
      if (!w.nextReviewAt && w.status !== 'mastered') {
        w.nextReviewAt = new Date(now + REVIEW_INTERVALS_DAYS[Math.min(w.stage, REVIEW_INTERVALS_DAYS.length - 1)] * DAY_MS).toISOString();
        changed = true;
      }
      if (!w.updatedAt) { w.updatedAt = w.lastAttemptAt || w.timestamp || new Date().toISOString(); changed = true; }
      if (!w.firstWrongAt) { w.firstWrongAt = w.timestamp || w.updatedAt; changed = true; }
    }
    if (changed) saveWrongQuestions(wrongs);

    // 2. Activity: seed from quiz lastUpdated so the streak isn't empty.
    const activity = loadActivity();
    if (Object.keys(activity).length === 0) {
      const progress = loadProgress();
      for (const p of Object.values(progress)) {
        if (!p || !p.lastUpdated) continue;
        const k = dayKey(new Date(p.lastUpdated));
        const answered = (p.answers || []).filter(function(a) { return a !== null && a !== undefined; }).length;
        activity[k] = (activity[k] || 0) + answered;
      }
      if (Object.keys(activity).length) saveActivity(activity);
    }

    safeSet(STORAGE_KEY_SCHEMA, SCHEMA_VERSION);
  }

  // ============ QUIZ CLASS ============
  // The source question bank was written with the correct answer at B far too
  // often (~58% of 1,018 questions), which teaches "when in doubt pick B".
  // Rotate each question's options deterministically so correct answers are
  // spread evenly, while keeping question ids and order untouched.
  // Saved answer indexes are re-mapped once (see loadSavedState) so the
  // learner's previous choices and score are preserved.
  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  function buildOptionOrder(quizId, questions) {
    const seed = hashString(quizId) % 97;
    const rotations = [];
    const out = questions.map(function(q, i) {
      const opts = Array.isArray(q.options) ? q.options : [];
      const n = opts.length;
      if (n < 2) { rotations.push(0); return q; }
      const target = (seed + i) % n;                  // desired position of the correct option
      const k = ((q.correct - target) % n + n) % n;   // rotate left by k
      rotations.push(k);
      if (!k) return q;
      return Object.assign({}, q, {
        options: opts.slice(k).concat(opts.slice(0, k)),
        correct: target
      });
    });
    return { questions: out, rotations: rotations };
  }

  class Quiz {
    constructor(config) {
      this.quizId = config.quizId || 'unknown';
      this.quizTitle = config.quizTitle || 'Quiz';
      this.quizTopic = config.quizTopic || '';
      const ordered = buildOptionOrder(this.quizId, config.questions || []);
      this.questions = ordered.questions;
      this.rotations = ordered.rotations;
      this.totalQuestions = this.questions.length;
      this.answers = new Array(this.totalQuestions).fill(null);
      this.correctCount = 0;
      this.completed = false;
      this.containerEl = document.getElementById(config.containerId || 'quiz-root');
      this.loadSavedState();
    }

    loadSavedState() {
      const progress = loadProgress();
      if (progress[this.quizId]) {
        const saved = progress[this.quizId];
        if (Array.isArray(saved.answers)) {
          // Answers from before option balancing are in the original option
          // order; shift them so they still point at the same option text.
          const needsShift = saved.optionOrder !== OPTION_ORDER_VERSION;
          this.answers = new Array(this.totalQuestions).fill(null);
          for (let i = 0; i < this.totalQuestions; i++) {
            const a = saved.answers[i];
            const n = (this.questions[i].options || []).length;
            if (typeof a !== 'number' || a < 0 || a >= n) continue;
            this.answers[i] = needsShift ? ((a - (this.rotations[i] || 0)) % n + n) % n : a;
          }
        }
        if (saved.correctCount !== undefined) this.correctCount = saved.correctCount;
        if (saved.completed !== undefined) this.completed = saved.completed;
        this.recountIfNeeded(saved);
      }
    }

    recountIfNeeded(saved) {
      const recomputed = this.answers.reduce((acc, a, i) => acc + (a !== null && a === this.questions[i].correct ? 1 : 0), 0);
      if (recomputed !== this.correctCount) this.correctCount = recomputed;
      if (saved && saved.totalQuestions !== this.totalQuestions) {
        this.completed = this.answers.every(function(a) { return a !== null; });
      }
    }

    persist() {
      const progress = loadProgress();
      progress[this.quizId] = {
        quizTitle: this.quizTitle,
        quizTopic: this.quizTopic,
        answers: this.answers,
        correctCount: this.correctCount,
        totalQuestions: this.totalQuestions,
        completed: this.completed,
        optionOrder: OPTION_ORDER_VERSION,
        lastUpdated: new Date().toISOString()
      };
      saveProgress(progress);
    }

    answer(qIndex, optionIndex) {
      if (this.completed) return;
      if (qIndex < 0 || qIndex >= this.totalQuestions) return;
      this.answers[qIndex] = optionIndex;
      this.correctCount = 0;
      for (let i = 0; i < this.totalQuestions; i++) {
        if (this.answers[i] === this.questions[i].correct) this.correctCount++;
      }
      recordAttempt(this, qIndex);
      if (this.answers.every(function(a) { return a !== null; })) this.completed = true;
      this.persist();
      bumpActivity(1);
      maybeAutoBackup();
      this.render();
      setTimeout(() => {
        const fb = document.getElementById('fb-' + qIndex);
        if (fb) fb.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }

    reset() {
      this.answers = new Array(this.totalQuestions).fill(null);
      this.correctCount = 0;
      this.completed = false;
      this.persist();
      this.render();
    }

    calculateScore() {
      if (this.totalQuestions === 0) return { pct: 0, correct: 0, total: 0 };
      return {
        pct: Math.round((this.correctCount / this.totalQuestions) * 100),
        correct: this.correctCount,
        total: this.totalQuestions
      };
    }

    render() {
      if (!this.containerEl) return;
      const score = this.calculateScore();
      const allAnswered = this.answers.every(function(a) { return a !== null; });
      let html = '';

      html += '<div class="quiz-section" data-quiz-id="' + escapeAttr(this.quizId) + '">';
      html += '<h2>📝 ' + escapeHtml(this.quizTitle) + '</h2>';
      html += '<p class="quiz-instruction">Select the best answer for each question. Feedback appears immediately after each choice.</p>';

      const answeredCount = this.answers.filter(function(a) { return a !== null; }).length;
      const pctDone = this.totalQuestions > 0 ? Math.round((answeredCount / this.totalQuestions) * 100) : 0;
      html += '<div class="quiz-progress">';
      html += '<span class="qp-label">Progress</span>';
      html += '<div class="bar-bg"><div class="bar-fill" style="width:' + pctDone + '%"></div></div>';
      html += '<span class="bar-label">' + answeredCount + '/' + this.totalQuestions + '</span>';
      html += '</div>';

      const grouped = {};
      for (let i = 0; i < this.totalQuestions; i++) {
        const g = this.questions[i].group || 0;
        if (!grouped[g]) grouped[g] = [];
        grouped[g].push(i);
      }

      for (const g of Object.keys(grouped).map(Number).sort(function(a, b) { return a - b; })) {
        if (g !== 0) continue;
        for (const i of grouped[g]) html += this.renderQuestionCard(i);
      }

      if (allAnswered) {
        let gradeClass = 'poor';
        if (score.pct >= 90) gradeClass = 'great';
        else if (score.pct >= 75) gradeClass = 'good';
        else if (score.pct >= 60) gradeClass = 'ok';

        html += '<div class="score-summary show">';
        html += '<h3>Quiz Complete!</h3>';
        html += '<div class="big-score ' + gradeClass + '">' + score.correct + '/' + score.total + '</div>';
        html += '<div class="score-detail">' + score.pct + '% correct</div>';

        if (score.pct >= 90) html += '<p style="color:var(--correct);font-weight:600;">Excellent! You\'ve mastered this topic.</p>';
        else if (score.pct >= 75) html += '<p style="color:var(--accent);font-weight:600;">Good work! Review the incorrect answers below.</p>';
        else if (score.pct >= 60) html += '<p style="color:var(--warning);font-weight:600;">Keep studying. Focus on the areas you missed.</p>';
        else html += '<p style="color:var(--incorrect);font-weight:600;">This topic needs more attention. Review the knowledge content and retry.</p>';

        html += '<button class="btn btn-outline" onclick="CSPQuiz.resetQuiz(\'' + escapeAttr(this.quizId) + '\')" style="margin-top:12px;">↻ Retry Quiz</button>';
        html += '</div>';
      }

      html += '</div>';
      this.containerEl.innerHTML = html;

      for (const g of Object.keys(grouped).map(Number).sort(function(a, b) { return a - b; })) {
        if (g === 0) continue;
        const target = document.getElementById('quiz-group-' + g);
        if (target) target.innerHTML = this.renderGroup(g, grouped[g]);
      }
    }

    renderGroup(g, indices) {
      let html = '<div class="quiz-section">';
      html += '<div class="quiz-group-bar">';
      html += '<span class="quiz-group-label" data-group="' + g + '"></span>';
      html += '<span class="collapse-toggle qg-toggle">▸ 展开 / Expand</span>';
      html += '</div>';
      html += '<div class="quiz-group-body">';
      html += '<p class="quiz-instruction">解答本知识点的例题。Answer the practice questions for this topic.</p>';
      for (const i of indices) html += this.renderQuestionCard(i);
      html += '</div>';
      html += '</div>';
      return html;
    }

    renderQuestionCard(i) {
      const q = this.questions[i];
      const userAns = this.answers[i];
      const isAnswered = userAns !== null && userAns !== undefined;
      const isCorrect = isAnswered && userAns === q.correct;

      let cardClass = 'question-card';
      if (isAnswered) cardClass += isCorrect ? ' answered-correct' : ' answered-incorrect';

      let html = '';
      html += '<div class="' + cardClass + '" data-qindex="' + i + '">';
      html += '<div class="q-number">Question ' + (i + 1) + ' of ' + this.totalQuestions + '</div>';
      html += '<div class="q-text">' + escapeHtml(q.text) + '</div>';
      html += '<ul class="options-list">';

      const letters = ['A', 'B', 'C', 'D', 'E'];
      for (let j = 0; j < q.options.length; j++) {
        let btnClass = 'option-btn';
        let disabledAttr = '';
        if (isAnswered) {
          disabledAttr = ' disabled';
          if (j === q.correct) btnClass += ' correct-choice';
          else if (j === userAns && !isCorrect) btnClass += ' wrong-choice';
        }
        html += '<li>';
        html += '<button class="' + btnClass + '"' + disabledAttr + ' onclick="CSPQuiz.answerQuiz(\'' + escapeAttr(this.quizId) + '\',' + i + ',' + j + ')">';
        html += '<span class="option-letter">' + letters[j] + '</span>';
        html += '<span>' + escapeHtml(q.options[j]) + '</span>';
        html += '</button>';
        html += '</li>';
      }
      html += '</ul>';

      let fbClass = 'feedback-box';
      let fbShow = '';
      if (isAnswered) {
        fbClass += isCorrect ? ' correct' : ' incorrect';
        fbShow = ' show';
      }
      html += '<div class="' + fbClass + fbShow + '" id="fb-' + i + '">';
      if (isAnswered) {
        html += '<div class="fb-label">' + (isCorrect ? '✓ Correct!' : '✗ Incorrect') + '</div>';
        if (q.explanation) html += '<div>' + formatExplanation(q.explanation) + '</div>';
        if (q.related && q.related.length) {
          html += '<div class="related-kp">';
          html += '<span class="rk-label">🔗 关联知识点 / Related:</span> ';
          for (let k = 0; k < q.related.length; k++) {
            const r = q.related[k];
            html += '<a href="javascript:void(0)" class="rk-link" onclick="CSPQuiz.scrollToCard(\'' + escapeAttr(r.n) + '\')">' +
                    escapeHtml(r.n) + ' ' + escapeHtml(r.t) + '</a> ';
          }
          html += '</div>';
        }
      }
      html += '</div>';
      html += '</div>';
      return html;
    }
  }

  // ============ GLOBAL INSTANCES ============
  const quizzes = {};
  let kpNavigationConsumed = false;

  function refreshQuizGroups() {
    document.querySelectorAll('[id^="quiz-group-"]').forEach(function(group) {
      var body = group.querySelector('.quiz-group-body');
      var toggle = group.querySelector('.qg-toggle');
      if (!body || !toggle) return;
      if (!group.dataset.wired) { wireQuizGroup(group); return; }
      applyGroupState(group);
    });
  }

  function refreshProgress() {
    var bodyHtml = document.body ? document.body.innerHTML : '';
    var m2 = /quizId:\s*'([^']+)'/.exec(bodyHtml);
    if (!m2) return;
    var pageQuizId = m2[1];

    var progress = null;
    try { progress = JSON.parse(localStorage.getItem(STORAGE_KEY_PROGRESS) || '{}'); }
    catch (e) { return; }
    var p = progress[pageQuizId];
    var total = p && p.totalQuestions ? p.totalQuestions : 0;
    var answers = p && p.answers ? p.answers : [];
    var answered = answers.filter(function(a) { return a !== null && a !== undefined; }).length;
    var correct = p && p.correctCount ? p.correctCount : 0;

    var header = document.querySelector('.page-header');
    if (header) {
      var chip = header.querySelector('.week-progress-chip');
      if (!chip) {
        chip = document.createElement('div');
        chip.className = 'week-progress-chip';
        header.appendChild(chip);
      }
      var due = getReviewStats().due;
      chip.innerHTML = '<span>📊 进度 / Progress</span> <strong>' + answered + '/' + total + '</strong> 题 answered · ' +
        '<strong>' + correct + '/' + total + '</strong> 对 correct' +
        (due ? ' · <a href="review-wrong.html" style="color:#fff;text-decoration:underline;">🔁 ' + due + ' 题待复习</a>' : '');
    }

    if (!p || !p.answers) return;

    document.querySelectorAll('[id^="quiz-group-"]').forEach(function(group) {
      var section = group.querySelector('.quiz-section');
      if (!section) return;
      var cards = section.querySelectorAll('.question-card');
      var allCorrect = cards.length > 0;
      cards.forEach(function(card) {
        if (!card.classList.contains('answered-correct')) allCorrect = false;
      });
      var prev = group.previousElementSibling;
      while (prev && !(prev.classList && prev.classList.contains('knowledge-card'))) {
        prev = prev.previousElementSibling;
      }
      if (prev) {
        if (allCorrect) prev.classList.add('card-complete');
        else prev.classList.remove('card-complete');
      }
    });
  }

  window.CSPQuiz = {
    VERSION: APP_VERSION,
    SCHEMA_VERSION: SCHEMA_VERSION,

    init: function(config) {
      const quiz = new Quiz(config);
      quizzes[config.quizId] = quiz;
      // Older wrong-answer records only kept the question stem. Now that the
      // full question is available, backfill the snapshot so it can be
      // retried from the review page without leaving this one.
      backfillWrongSnapshots(quiz);
      quiz.render();
      quiz.persist();
      return quiz;
    },

    getQuiz: function(quizId) { return quizzes[quizId] || null; },

    answerQuiz: function(quizId, qIndex, optionIndex) {
      const quiz = quizzes[quizId];
      if (quiz) {
        quiz.answer(qIndex, optionIndex);
        refreshQuizGroups();
        refreshProgress();
      }
    },

    resetQuiz: function(quizId) {
      const quiz = quizzes[quizId];
      if (quiz) {
        quiz.reset();
        refreshQuizGroups();
        refreshProgress();
      }
    },

    // ---- progress ----
    getProgress: function() { return loadProgress(); },
    getWrongQuestions: function() { return loadWrongQuestions(); },

    clearAllProgress: function() {
      backupNow('before-reset');
      localStorage.removeItem(STORAGE_KEY_PROGRESS);
      localStorage.removeItem(STORAGE_KEY_WRONG);
      localStorage.removeItem(STORAGE_KEY_ACTIVITY);
      const meta = loadMeta();
      meta.answeredSinceBackup = 0;
      saveMeta(meta);
    },

    // ---- wrong-answer review (spaced repetition) ----
    getReviewStats: getReviewStats,
    getDueReviews: getDueReviews,
    getAllReviews: function() { return loadWrongQuestions(); },
    reviewAnswer: reviewAnswer,
    markMastered: markMastered,
    snoozeReview: snoozeReview,
    removeWrong: removeWrongEntry,
    entryId: entryId,

    // ---- activity ----
    getActivity: function() { return loadActivity(); },
    getActivitySeries: getActivitySeries,
    getStreak: function() { return getStreak(); },
    getTodayCount: function() {
      const a = loadActivity();
      return a[dayKey()] || 0;
    },

    // ---- settings ----
    getSettings: loadSettings,
    setSetting: function(key, value) {
      const s = loadSettings();
      s[key] = value;
      saveSettings(s);
      if (key === 'theme') applyTheme(value);
      return s;
    },
    applyTheme: applyTheme,
    setTheme: setTheme,
    toggleTheme: toggleTheme,

    // ---- backups ----
    getBackups: function() {
      return loadBackups().map(function(b, i) {
        return {
          index: i,
          at: b.at,
          reason: b.reason,
          progress: Object.keys(b.progress || {}).length,
          wrong: (b.wrong || []).length,
          vocab: (b.vocab || []).length
        };
      });
    },
    backupNow: backupNow,
    restoreBackup: restoreBackup,

    // ---- export / import ----
    exportData: function() {
      const data = {
        app: 'csp-prep',
        version: 3,
        schema: SCHEMA_VERSION,
        appVersion: APP_VERSION,
        exportedAt: new Date().toISOString(),
        progress: loadProgress(),
        wrongQuestions: loadWrongQuestions(),
        vocabList: loadVocabData(),
        activity: loadActivity(),
        settings: loadSettings()
      };
      return JSON.stringify(data, null, 2);
    },

    downloadExport: function() {
      const json = this.exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'csp-progress-' + dayKey() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    },

    importData: function(json, opts) {
      let data;
      try { data = JSON.parse(json); }
      catch (e) { return { ok: false, error: 'not-json' }; }
      if (!data || typeof data !== 'object') return { ok: false, error: 'invalid' };
      if (!data.progress && !data.wrongQuestions && !data.vocabList) {
        return { ok: false, error: 'empty-file' };
      }
      const mode = opts && opts.mode === 'merge' ? 'merge' : 'replace';

      backupNow('before-import');

      if (mode === 'replace') {
        saveProgress(data.progress || {});
        saveWrongQuestions(data.wrongQuestions || []);
        if (data.vocabList) saveVocabData(data.vocabList);
        if (data.activity) saveActivity(data.activity);
      } else {
        saveProgress(mergeProgress(loadProgress(), data.progress || {}));
        saveWrongQuestions(mergeWrong(loadWrongQuestions(), data.wrongQuestions || []));
        saveVocabData(mergeVocab(loadVocabData(), data.vocabList || []));
        const act = loadActivity();
        for (const [k, v] of Object.entries(data.activity || {})) {
          act[k] = Math.max(act[k] || 0, Number(v) || 0);
        }
        saveActivity(act);
      }

      const s = loadSettings();
      if (data.settings) {
        if (!s.startDate && data.settings.startDate) s.startDate = data.settings.startDate;
        if (data.settings.dailyGoal) s.dailyGoal = Number(data.settings.dailyGoal) || s.dailyGoal;
        saveSettings(s);
      }

      const progress = loadProgress();
      const wrong = loadWrongQuestions();
      return {
        ok: true,
        mode: mode,
        counts: {
          progress: Object.keys(progress).length,
          wrong: wrong.length,
          vocab: loadVocabData().length,
          importedWrong: (data.wrongQuestions || []).length
        }
      };
    },

    // ---- knowledge point jumps ----
    scrollToCard: function(sectionNum) {
      if (!sectionNum) return false;
      const cards = document.querySelectorAll('.knowledge-card');
      let target = null;
      for (const card of cards) {
        const h = card.querySelector('h2, h3');
        if (!h) continue;
        const txt = (h.textContent || '').trim();
        if (txt.indexOf(sectionNum + ' ') === 0 || txt.indexOf(sectionNum + '.') === 0 ||
            txt.indexOf(sectionNum + '\u00a0') === 0 || txt === sectionNum ||
            txt.indexOf(sectionNum) === 0) {
          target = card;
          break;
        }
      }

      if (!target) {
        if (!kpNavigationConsumed) {
          const page = pageForSection(sectionNum);
          if (page) {
            kpNavigationConsumed = true;
            location.href = page + '?kp=' + encodeURIComponent(sectionNum);
            return true;
          }
        }
        toast('本页没有 ' + sectionNum + ' 这个知识点', 'warn');
        return false;
      }

      const wrapper = target.querySelector('.collapse-body');
      const btn = target.querySelector('.collapse-toggle');
      if (wrapper && wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        if (btn) btn.textContent = '▾ 收起 / Collapse';
        target.classList.remove('collapsed');
      }
      const returnY = window.scrollY || document.documentElement.scrollTop;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.add('card-flash');
      setTimeout(function() { target.classList.remove('card-flash'); }, 1800);
      showReturnButton(returnY);
      return true;
    },

    // ---- search / ui helpers ----
    openSearch: openSearch,
    toast: toast
  };

  function backfillWrongSnapshots(quiz) {
    const wrongs = loadWrongQuestions();
    let changed = false;
    for (const w of wrongs) {
      if (w.quizId !== quiz.quizId || w.full) continue;
      const q = quiz.questions[w.qIndex];
      if (!q || !Array.isArray(q.options)) continue;
      w.full = snapshotQuestion(q);
      w.correctAnswer = q.options[q.correct];
      w.updatedAt = w.updatedAt || new Date().toISOString();
      changed = true;
    }
    if (changed) saveWrongQuestions(wrongs);
  }

  // ============ MERGE HELPERS ============
  function mergeProgress(current, incoming) {
    const out = Object.assign({}, current);
    for (const [id, p] of Object.entries(incoming)) {
      const cur = out[id];
      if (!cur) { out[id] = p; continue; }
      const a = parseDate(cur.lastUpdated);
      const b = parseDate(p.lastUpdated);
      if (b >= a) out[id] = p;
    }
    return out;
  }

  function mergeWrong(current, incoming) {
    const map = new Map();
    for (const w of current) map.set(getEntryKey(w), w);
    for (const w of incoming) {
      const key = getEntryKey(w);
      const cur = map.get(key);
      if (!cur) { map.set(key, w); continue; }
      const a = parseDate(cur.updatedAt || cur.lastAttemptAt);
      const b = parseDate(w.updatedAt || w.lastAttemptAt);
      const winner = b >= a ? w : cur;
      const merged = Object.assign({}, winner);
      const firstA = parseDate(cur.firstWrongAt || cur.timestamp);
      const firstB = parseDate(w.firstWrongAt || w.timestamp);
      if (firstA && firstB) merged.firstWrongAt = new Date(Math.min(firstA, firstB)).toISOString();
      if (!merged.full && (cur.full || w.full)) merged.full = cur.full || w.full;
      map.set(key, merged);
    }
    return Array.from(map.values());
  }

  function mergeVocab(current, incoming) {
    const map = new Map();
    for (const v of current) map.set(v.en, v);
    for (const v of incoming) if (!map.has(v.en)) map.set(v.en, v);
    return Array.from(map.values());
  }

  // ============ UTILS ============
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  function formatExplanation(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function truncateText(text, maxLen) {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  }

  function pageForSection(sectionNum) {
    const m = /^(\d+)\./.exec(String(sectionNum));
    if (!m) return null;
    const week = parseInt(m[1], 10);
    if (week >= 1 && week <= 24) return 'week-' + pad2(week) + '.html';
    return null;
  }

  function toast(message, type) {
    let el = document.getElementById('csp-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'csp-toast';
      el.className = 'csp-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = 'csp-toast show' + (type ? ' ' + type : '');
    clearTimeout(el._timer);
    el._timer = setTimeout(function() { el.classList.remove('show'); }, 3200);
  }

  // ============ COLLAPSE / EXPAND ============
  function initCollapse() {
    document.querySelectorAll('.knowledge-card').forEach(function(card) {
      if (card.dataset.collapseInit) return;
      card.dataset.collapseInit = '1';

      var heading = card.querySelector('h2, h3');
      if (!heading) return;

      var contentEls = [];
      var node = heading.nextSibling;
      while (node) {
        contentEls.push(node);
        node = node.nextSibling;
      }
      if (contentEls.length === 0) return;

      var wrapper = document.createElement('div');
      wrapper.className = 'collapse-body';
      contentEls.forEach(function(n) { wrapper.appendChild(n); });
      card.appendChild(wrapper);

      var btn = document.createElement('span');
      btn.className = 'collapse-toggle';
      btn.textContent = '▾ 收起 / Collapse';
      btn.title = 'Click to collapse / expand';
      heading.appendChild(btn);

      heading.style.cursor = 'pointer';
      heading.addEventListener('click', function(e) {
        if (e.target.closest('.vocab-star')) return;
        toggleCollapse(card, wrapper, btn);
      });
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleCollapse(card, wrapper, btn);
      });
    });

    var groupObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.addedNodes.length) {
          var group = m.target;
          if (group.id && group.id.indexOf('quiz-group-') === 0) wireQuizGroup(group);
        }
      });
    });

    document.querySelectorAll('[id^="quiz-group-"]').forEach(function(group) {
      groupObserver.observe(group, { childList: true, subtree: true });
      wireQuizGroup(group);
    });
  }

  function wireQuizGroup(group) {
    if (group.dataset.wired) return;
    var body = group.querySelector('.quiz-group-body');
    var toggle = group.querySelector('.qg-toggle');
    if (!body || !toggle) return;
    group.dataset.wired = '1';
    group.dataset.open = '0';
    applyGroupState(group);

    group.addEventListener('click', function(e) {
      if (e.target.closest('.vocab-star')) return;
      if (e.target.closest('.qg-toggle') || e.target.closest('.quiz-group-bar')) {
        group.dataset.open = group.dataset.open === '1' ? '0' : '1';
        applyGroupState(group);
      }
    });
  }

  function applyGroupState(group) {
    var body = group.querySelector('.quiz-group-body');
    var toggle = group.querySelector('.qg-toggle');
    var label = group.querySelector('.quiz-group-label');
    if (!body || !toggle) return;
    var open = group.dataset.open === '1';
    body.style.display = open ? 'block' : 'none';
    toggle.textContent = open ? '▾ 收起 / Collapse' : '▸ 展开 / Expand';
    var numLabel = getSectionLabel(group);
    if (label && numLabel) label.textContent = '📝 例题 ' + numLabel + ' / Practice';
  }

  function getSectionLabel(group) {
    var prev = group.previousElementSibling;
    while (prev) {
      if (prev.classList && prev.classList.contains('knowledge-card')) {
        var h = prev.querySelector('h2, h3');
        if (h) {
          var txt = h.textContent || '';
          var m = txt.match(/(\d+\.\d+|\d+)/);
          if (m) return m[1];
        }
        return '';
      }
      prev = prev.previousElementSibling;
    }
    return '';
  }

  function toggleCollapse(card, wrapper, btn) {
    var isHidden = wrapper.style.display === 'none';
    wrapper.style.display = isHidden ? 'block' : 'none';
    btn.textContent = isHidden ? '▾ 收起 / Collapse' : '▸ 展开 / Expand';
    card.classList.toggle('collapsed', !isHidden);
  }

  // ============ RETURN-TO-POSITION BUTTON ============
  function showReturnButton(returnY) {
    var existing = document.getElementById('csp-return-btn');
    if (existing) existing.remove();

    var btn = document.createElement('button');
    btn.id = 'csp-return-btn';
    btn.className = 'return-btn';
    btn.innerHTML = '↩ 返回原位 / Back';
    btn.addEventListener('click', function() {
      window.scrollTo({ top: returnY, behavior: 'smooth' });
      btn.remove();
    });
    document.body.appendChild(btn);
    setTimeout(function() { btn.classList.add('show'); }, 20);
    setTimeout(function() { if (btn.parentNode) btn.remove(); }, 20000);
  }

  // ============ FLOATING ACTION BUTTONS ============
  function initFloatingButtons() {
    if (document.getElementById('csp-float-btns')) return;

    var container = document.createElement('div');
    container.id = 'csp-float-btns';

    if (document.querySelector('.knowledge-card')) {
      var collapseBtn = document.createElement('button');
      collapseBtn.className = 'float-btn collapse-all';
      collapseBtn.textContent = '📚';
      collapseBtn.title = '收起全部知识点 / Collapse all';
      collapseBtn.setAttribute('aria-label', collapseBtn.title);
      collapseBtn.addEventListener('click', function() {
        var anyOpen = false;
        document.querySelectorAll('.knowledge-card').forEach(function(card) {
          var wrapper = card.querySelector('.collapse-body');
          if (wrapper && wrapper.style.display !== 'none') anyOpen = true;
        });
        document.querySelectorAll('.knowledge-card').forEach(function(card) {
          var wrapper = card.querySelector('.collapse-body');
          var btn = card.querySelector('.collapse-toggle');
          if (!wrapper) return;
          if (anyOpen) {
            wrapper.style.display = 'none';
            if (btn) btn.textContent = '▸ 展开 / Expand';
            card.classList.add('collapsed');
          } else {
            wrapper.style.display = 'block';
            if (btn) btn.textContent = '▾ 收起 / Collapse';
            card.classList.remove('collapsed');
          }
        });
        collapseBtn.textContent = anyOpen ? '📖' : '📚';
      });
      container.appendChild(collapseBtn);
    }

    var searchBtn = document.createElement('button');
    searchBtn.className = 'float-btn search-btn';
    searchBtn.textContent = '🔍';
    searchBtn.title = '搜索 / Search (Ctrl+K)';
    searchBtn.setAttribute('aria-label', searchBtn.title);
    searchBtn.addEventListener('click', openSearch);
    container.appendChild(searchBtn);

    var themeBtn = document.createElement('button');
    themeBtn.className = 'float-btn theme-toggle';
    themeBtn.textContent = '🌙';
    themeBtn.addEventListener('click', toggleTheme);
    container.appendChild(themeBtn);

    var topBtn = document.createElement('button');
    topBtn.className = 'float-btn scroll-top';
    topBtn.textContent = '⬆';
    topBtn.title = 'Back to top';
    topBtn.setAttribute('aria-label', topBtn.title);
    topBtn.addEventListener('click', function() { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    container.appendChild(topBtn);

    document.body.appendChild(container);

    var onScroll = function() {
      var y = window.scrollY || document.documentElement.scrollTop;
      topBtn.classList.toggle('visible', y > 300);
      searchBtn.classList.toggle('visible', y > 120);
      themeBtn.classList.toggle('visible', y > 120);
      container.querySelectorAll('.collapse-all').forEach(function(b) { b.classList.toggle('visible', y > 300); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    updateThemeButtons();
  }

  // ============ MOBILE: SCROLLABLE TABLES ============
  // Wide content tables (3+ columns) are unreadable on phones. Wrapping them
  // in a scroll container keeps the card layout intact and lets users swipe.
  function initTableScroll() {
    document.querySelectorAll('.knowledge-card table, .quiz-section table').forEach(function(table) {
      var parent = table.parentElement;
      if (parent && parent.classList.contains('table-scroll')) return;
      var wrap = document.createElement('div');
      wrap.className = 'table-scroll';
      parent.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  // ============ STICKY PAGE TITLE ============
  function initStickyHeader() {
    var header = document.querySelector('.page-header');
    if (!header || header.dataset.sticky) return;
    header.dataset.sticky = '1';
    header.classList.add('sticky-header');
  }

  // ============ SCENARIO QUESTIONS ============
  function initScenarios() {
    var scenarios = document.querySelectorAll('.exam-scenario[data-options]');
    scenarios.forEach(function(sc) {
      if (sc.dataset.wired) return;
      sc.dataset.wired = '1';

      var correct = parseInt(sc.getAttribute('data-correct'), 10);
      var options;
      try { options = JSON.parse(sc.getAttribute('data-options')); }
      catch (e) { return; }
      if (!options || !options.length) return;

      var letters = ['A', 'B', 'C', 'D', 'E'];
      var list = document.createElement('ul');
      list.className = 'options-list scenario-options';

      options.forEach(function(opt, j) {
        var li = document.createElement('li');
        var btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.type = 'button';
        btn.innerHTML = '<span class="option-letter">' + letters[j] + '</span><span>' + escapeHtml(opt) + '</span>';
        btn.addEventListener('click', function() {
          if (list.dataset.answered) return;
          list.dataset.answered = '1';
          var isRight = (j === correct);
          Array.prototype.forEach.call(list.querySelectorAll('.option-btn'), function(b, k) {
            b.classList.add('disabled');
            if (k === correct) b.classList.add('correct-choice');
            else if (k === j && !isRight) b.classList.add('wrong-choice');
          });
          var fb = sc.querySelector('.scenario-feedback');
          if (fb) {
            fb.classList.add('show', isRight ? 'correct' : 'incorrect');
            var label = fb.querySelector('.scenario-fb-label');
            if (label) label.textContent = isRight ? '✓ Correct!' : '✗ Incorrect';
          }
        });
        li.appendChild(btn);
        list.appendChild(li);
      });

      var fb = sc.querySelector('.scenario-feedback');
      if (fb) sc.insertBefore(list, fb);
      else sc.appendChild(list);

      var modelBtn = sc.querySelector('.scenario-model-answer');
      if (modelBtn) {
        modelBtn.addEventListener('click', function() {
          var body = sc.querySelector('.scenario-answer-body');
          if (body) {
            var hidden = body.style.display === 'none' || !body.style.display;
            body.style.display = hidden ? 'block' : 'none';
            modelBtn.textContent = hidden ? '▾ 收起参考答案 / Hide' : '▸ 查看参考答案 / Show';
          }
        });
      }
    });
  }

  // ============ SEARCH ============
  const WEEK_INDEX = [
    [1, 'Hierarchy of Controls & PtD', '安全原理', '1'],
    [2, 'Process Safety Management', '工艺安全管理', '1'],
    [3, 'Workplace Hazards (Electrical, Falls)', '作业危害', '1'],
    [4, 'Confined Space, LOTO, Excavation', '密闭空间 上锁挂牌', '1'],
    [5, 'Management Systems & Audit (ISO 45001)', '管理体系 审核', '2'],
    [6, 'Performance Measurement', '绩效测量 KPI', '2'],
    [7, 'Incident Investigation & RCA', '事故调查 根源分析', '2'],
    [8, 'Finance, Leadership & Compliance', '财务 领导力 合规', '2'],
    [9, 'Risk Assessment Process', '风险评估', '3'],
    [10, 'FMEA, FTA, ETA', '故障模式 故障树', '3'],
    [11, 'HAZOP, Bow-Tie, Risk Finance', '危险与可操作性 领结', '3'],
    [12, 'Emergency Response Plans', '应急响应', '4'],
    [13, 'Fire Protection & Hazmat Transport', '消防 危化品运输', '4'],
    [14, 'Pollution Prevention & Hazmat Mgmt', '污染防治', '5'],
    [15, 'Waste Mgmt & Sustainability', '废物管理 可持续', '5'],
    [16, 'Exposure Assessment & IH Sampling', '暴露评估 采样', '6'],
    [17, 'Noise, Radiation, Toxicology', '噪声 辐射 毒理', '6'],
    [18, 'Ergonomics & Ventilation', '人机工程 通风', '6'],
    [19, 'Training Needs & Design (ADDIE)', '培训需求 ADDIE', '7'],
    [20, 'Adult Learning & Evaluation', '成人学习 评估', '7'],
    [21, 'Comprehensive Review (D1-D4)', '综合复习', 'review'],
    [22, 'Comprehensive Review (D5-D7)', '综合复习', 'review'],
    [23, 'Mini Mock Exam', '迷你模拟考', 'review'],
    [24, 'Final Sprint & Readiness', '冲刺 备考', 'review']
  ];

  const EXAM_INDEX = [
    [1, 'Monthly Exam 1 · Domain 1 Safety Principles', 'D1 模拟考'],
    [2, 'Monthly Exam 2 · Domain 2 Program Management', 'D2 模拟考'],
    [3, 'Monthly Exam 3 · Domains 3-4 Risk & Emergency', 'D3-4 模拟考'],
    [4, 'Monthly Exam 4 · Domains 5-7 Env, Health, Training', 'D5-7 模拟考'],
    [5, 'Monthly Exam 5 · Comprehensive Mock', '综合模拟考'],
    [6, 'Monthly Exam 6 · Final Full Simulation', '全真模拟考']
  ];

  const PAGE_INDEX = [
    ['学习仪表盘 / Dashboard', '总览、进度、今日计划', 'index.html'],
    ['错题本与今日复习 / Wrong Answers', '错题掌握、间隔复习', 'review-wrong.html'],
    ['术语表 / Glossary', '中英术语查询', 'glossary.html'],
    ['词汇闪卡 / Flashcards', '翻转记忆、按领域筛选', 'vocab-flashcards.html'],
    ['手机端预览 / Mobile Preview', '模拟手机屏幕', 'preview-mobile.html']
  ];

  let searchEls = null;
  let searchIndex = [];
  let searchResults = [];
  let searchActive = -1;

  function buildSearchIndex() {
    const idx = [];
    for (const item of WEEK_INDEX) {
      const num = item[0], topic = item[1], zh = item[2], dom = item[3];
      idx.push({
        cat: '周次 Weeks',
        title: 'Week ' + num + ' · ' + topic,
        sub: zh + ' · ' + (dom === 'review' ? 'Review' : 'Domain ' + dom) + ' · 第 ' + num + ' 周',
        href: 'week-' + pad2(num) + '.html',
        key: ('week ' + num + ' ' + topic + ' ' + zh + ' ' + dom).toLowerCase()
      });
    }
    for (const item of EXAM_INDEX) {
      const num = item[0], name = item[1], zh = item[2];
      idx.push({
        cat: '模拟考 Mock Exams',
        title: name,
        sub: zh,
        href: 'exam-month-' + pad2(num) + '.html',
        key: ('exam ' + num + ' ' + name + ' ' + zh).toLowerCase()
      });
    }
    for (const item of PAGE_INDEX) {
      idx.push({ cat: '页面 Pages', title: item[0], sub: item[1], href: item[2], key: (item[0] + ' ' + item[1]).toLowerCase() });
    }
    if (window.CSPVocab && window.CSPVocab.getGlossary) {
      for (const g of window.CSPVocab.getGlossary()) {
        idx.push({
          cat: '术语 Glossary',
          title: g.en + ' · ' + g.zh,
          sub: (g.desc || '').slice(0, 90),
          href: 'glossary.html?q=' + encodeURIComponent(g.en),
          key: (g.en + ' ' + g.zh + ' D' + g.domain).toLowerCase()
        });
      }
    }
    return idx;
  }

  function searchRun(query) {
    const q = (query || '').trim().toLowerCase();
    let results;
    if (!q) {
      results = searchIndex.filter(function(x) { return x.cat !== '术语 Glossary'; }).slice(0, 12);
    } else {
      const words = q.split(/\s+/).filter(Boolean);
      results = searchIndex
        .map(function(x) {
          let score = 0;
          for (const w of words) {
            if (x.title.toLowerCase().indexOf(w) === 0) score += 8;
            else if (x.title.toLowerCase().indexOf(w) >= 0) score += 5;
            else if (x.key.indexOf(w) >= 0) score += 2;
            else { score = -1; break; }
          }
          return { x: x, score: score };
        })
        .filter(function(r) { return r.score > 0; })
        .sort(function(a, b) { return b.score - a.score; })
        .slice(0, 30)
        .map(function(r) { return r.x; });
    }
    renderSearchResults(results, q);
  }

  function renderSearchResults(results, q) {
    searchResults = results;
    searchActive = results.length ? 0 : -1;
    const list = searchEls.results;
    if (!results.length) {
      list.innerHTML = '<div class="csp-search-empty">没有匹配结果 / No results for “' + escapeHtml(q) + '”</div>';
      return;
    }
    let html = '';
    let lastCat = '';
    results.forEach(function(r, i) {
      if (r.cat !== lastCat) {
        html += '<div class="csp-search-cat">' + escapeHtml(r.cat) + '</div>';
        lastCat = r.cat;
      }
      html += '<a class="csp-search-item' + (i === 0 ? ' active' : '') + '" data-index="' + i + '" href="' + escapeHtml(r.href) + '">';
      html += '<span class="csp-search-title">' + escapeHtml(r.title) + '</span>';
      html += '<span class="csp-search-sub">' + escapeHtml(r.sub || '') + '</span>';
      html += '</a>';
    });
    list.innerHTML = html;
    list.querySelectorAll('.csp-search-item').forEach(function(el) {
      el.addEventListener('mouseenter', function() { setActive(parseInt(el.dataset.index, 10)); });
    });
  }

  function setActive(i) {
    if (!searchResults.length) return;
    searchActive = Math.max(0, Math.min(i, searchResults.length - 1));
    const items = searchEls.results.querySelectorAll('.csp-search-item');
    items.forEach(function(el, k) { el.classList.toggle('active', k === searchActive); });
    const cur = items[searchActive];
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }

  function openSearch() {
    ensureSearch();
    searchEls.overlay.hidden = false;
    searchEls.overlay.classList.add('show');
    searchEls.input.value = '';
    searchRun('');
    setTimeout(function() { searchEls.input.focus(); }, 30);
  }

  function closeSearch() {
    if (!searchEls) return;
    searchEls.overlay.classList.remove('show');
    searchEls.overlay.hidden = true;
  }

  function ensureSearch() {
    if (searchEls) return;
    const overlay = document.createElement('div');
    overlay.id = 'csp-search';
    overlay.className = 'csp-search';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="csp-search-backdrop"></div>' +
      '<div class="csp-search-panel" role="dialog" aria-modal="true" aria-label="Search">' +
      '  <div class="csp-search-box">' +
      '    <span class="csp-search-icon">🔍</span>' +
      '    <input id="csp-search-input" type="search" autocomplete="off" placeholder="搜索周次、考点、术语… / Search weeks, topics, terms" />' +
      '    <button class="csp-search-close" title="关闭 / Close">✕</button>' +
      '  </div>' +
      '  <div class="csp-search-results" id="csp-search-results"></div>' +
      '  <div class="csp-search-hint">↑ ↓ 选择 · Enter 打开 · Esc 关闭</div>' +
      '</div>';
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#csp-search-input');
    const results = overlay.querySelector('#csp-search-results');
    searchEls = { overlay: overlay, input: input, results: results };
    searchIndex = buildSearchIndex();

    overlay.querySelector('.csp-search-backdrop').addEventListener('click', closeSearch);
    overlay.querySelector('.csp-search-close').addEventListener('click', closeSearch);

    input.addEventListener('input', function() { searchRun(input.value); });
    input.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(searchActive + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(searchActive - 1); }
      else if (e.key === 'Enter') {
        const r = searchResults[searchActive];
        if (r) { location.href = r.href; }
      } else if (e.key === 'Escape') { closeSearch(); }
    });
  }

  // ============ KEYBOARD SHORTCUTS ============
  function initShortcuts() {
    document.addEventListener('keydown', function(e) {
      const tag = (e.target && e.target.tagName) || '';
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.key === '/' && !typing) {
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.key === 'Escape' && searchEls && !searchEls.overlay.hidden) closeSearch();
    });
  }

  // ============ KNOWLEDGE-POINT DEEP LINK (?kp=21.8) ============
  function initKpParam() {
    let kp = '';
    try { kp = new URLSearchParams(location.search).get('kp') || ''; }
    catch (e) { kp = ''; }
    if (!kp) return;
    setTimeout(function() {
      kpNavigationConsumed = true;
      window.CSPQuiz.scrollToCard(kp);
    }, 250);
  }

  // ============ AUTO-INIT ============
  migrate();
  applyTheme(loadSettings().theme);
  // Allow shareable/testable theme links: index.html?theme=dark
  try {
    const _tp = new URLSearchParams(location.search).get('theme');
    if (_tp === 'dark' || _tp === 'light') setTheme(_tp);
  } catch (e) { /* ignore */ }

  document.addEventListener('DOMContentLoaded', function() {
    initCollapse();
    initTableScroll();
    initFloatingButtons();
    initStickyHeader();
    initScenarios();
    initShortcuts();
    initKpParam();
    refreshProgress();
    setTimeout(refreshProgress, 400);
    setTimeout(refreshProgress, 1200);
    updateThemeButtons();
  });

  document.addEventListener('csp-storage-error', function() {
    toast('浏览器存储空间不足，进度可能无法保存。请到仪表盘导出备份。', 'error');
  });

  console.log('📚 CSP Quiz Engine v' + APP_VERSION + ' loaded.');
})();
