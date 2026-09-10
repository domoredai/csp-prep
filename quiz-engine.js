/*=============================================
   CSP Exam Prep — Quiz Engine v1.0
   Powers all interactive quizzes: daily pages,
   weekly reviews, monthly exams, final review.
   Persists progress + wrong answers via localStorage.
   =============================================*/

(function() {
  'use strict';

  // ============ STORAGE ============
  const STORAGE_KEY_PROGRESS = 'csp_study_progress';
  const STORAGE_KEY_WRONG = 'csp_wrong_questions';

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_PROGRESS)) || {}; }
    catch(e) { return {}; }
  }
  function saveProgress(data) {
    localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(data));
  }
  function loadWrongQuestions() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_WRONG)) || []; }
    catch(e) { return []; }
  }
  function saveWrongQuestions(data) {
    localStorage.setItem(STORAGE_KEY_WRONG, JSON.stringify(data));
  }

  // ============ QUIZ CLASS ============
  class Quiz {
    constructor(config) {
      this.quizId = config.quizId || 'unknown';
      this.quizTitle = config.quizTitle || 'Quiz';
      this.quizTopic = config.quizTopic || '';
      this.questions = config.questions || [];
      this.totalQuestions = this.questions.length;
      this.answers = new Array(this.totalQuestions).fill(null);  // null | index of chosen option
      this.correctCount = 0;
      this.completed = false;
      this.containerEl = document.getElementById(config.containerId || 'quiz-root');
      this.loadSavedState();
    }

    loadSavedState() {
      const progress = loadProgress();
      if (progress[this.quizId]) {
        const saved = progress[this.quizId];
        if (saved.answers) this.answers = saved.answers;
        if (saved.correctCount !== undefined) this.correctCount = saved.correctCount;
        if (saved.completed !== undefined) this.completed = saved.completed;
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
        lastUpdated: new Date().toISOString()
      };
      saveProgress(progress);
    }

    recordWrong(qIndex) {
      const wrongs = loadWrongQuestions();
      const isCorrect = this.answers[qIndex] === this.questions[qIndex].correct;
      const idx = wrongs.findIndex(w => w.quizId === this.quizId && w.qIndex === qIndex);

      if (idx >= 0) {
        // First attempt was WRONG → keep in wrong bank forever.
        // Update yourAnswer/lastAnswer to reflect latest attempt for reference.
        wrongs[idx].yourAnswer = this.answers[qIndex] !== null ? this.questions[qIndex].options[this.answers[qIndex]] : 'Unanswered';
        wrongs[idx].lastAttemptCorrect = isCorrect;
        wrongs[idx].attempts = (wrongs[idx].attempts || 1) + 1;
        wrongs[idx].lastAttemptAt = new Date().toISOString();
      } else {
        // First attempt — only record if answered WRONG.
        if (!isCorrect) {
          wrongs.push({
            quizId: this.quizId,
            quizTitle: this.quizTitle,
            quizTopic: this.quizTopic,
            qIndex: qIndex,
            question: truncateText(this.questions[qIndex].text, 120),
            correctAnswer: this.questions[qIndex].options[this.questions[qIndex].correct],
            yourAnswer: this.answers[qIndex] !== null ? this.questions[qIndex].options[this.answers[qIndex]] : 'Unanswered',
            attempts: 1,
            lastAttemptCorrect: false,
            firstWrongAt: new Date().toISOString(),
            timestamp: new Date().toISOString()
          });
        }
      }
      saveWrongQuestions(wrongs);
    }

    answer(qIndex, optionIndex) {
      if (this.completed) return;
      this.answers[qIndex] = optionIndex;

      const q = this.questions[qIndex];
      const isCorrect = optionIndex === q.correct;

      // Update correctCount
      this.correctCount = 0;
      for (let i = 0; i < this.totalQuestions; i++) {
        if (this.answers[i] === this.questions[i].correct) this.correctCount++;
      }

      // Record wrong answer
      this.recordWrong(qIndex);

      // Check if all answered
      const allAnswered = this.answers.every(a => a !== null);
      if (allAnswered) this.completed = true;

      this.persist();
      this.render();

      // Scroll to feedback
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
      const allAnswered = this.answers.every(a => a !== null);
      let html = '';

      // Header
      html += '<div class="quiz-section">';
      html += '<h2>📝 ' + escapeHtml(this.quizTitle) + '</h2>';
      html += '<p class="quiz-instruction">Select the best answer for each question. Feedback appears immediately after each choice.</p>';

      // Progress bar
      const answeredCount = this.answers.filter(a => a !== null).length;
      const pctDone = this.totalQuestions > 0 ? Math.round((answeredCount / this.totalQuestions) * 100) : 0;
      html += '<div class="quiz-progress">';
      html += '<span style="font-size:0.85rem;font-weight:600;">Progress</span>';
      html += '<div class="bar-bg"><div class="bar-fill" style="width:' + pctDone + '%"></div></div>';
      html += '<span class="bar-label">' + answeredCount + '/' + this.totalQuestions + '</span>';
      html += '</div>';

      // Questions — group 0 renders into quiz-root, other groups render into #quiz-group-N
      const grouped = {};
      for (let i = 0; i < this.totalQuestions; i++) {
        const g = this.questions[i].group || 0;
        if (!grouped[g]) grouped[g] = [];
        grouped[g].push(i);
      }

      // Render each group
      for (const g of Object.keys(grouped).map(Number).sort((a,b) => a-b)) {
        const indices = grouped[g];
        if (g === 0) {
          // Render into main quiz-root (inside current html)
          for (const i of indices) {
            html += this.renderQuestionCard(i);
          }
        }
      }

      // Score summary (shown when all answered)
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

        html += '<button class="btn btn-outline" onclick="CSPQuiz.resetQuiz(\'' + this.quizId + '\')" style="margin-top:12px;">↻ Retry Quiz</button>';
        html += '</div>';
      }

      html += '</div>'; // quiz-section
      this.containerEl.innerHTML = html;

      // Render non-zero groups into their containers
      for (const g of Object.keys(grouped).map(Number).sort((a,b) => a-b)) {
        if (g === 0) continue;
        const target = document.getElementById('quiz-group-' + g);
        if (target) {
          let ghtml = '<div class="quiz-section">';
          ghtml += '<div class="quiz-group-bar">';
          ghtml += '<span class="quiz-group-label" data-group="' + g + '"></span>';
          ghtml += '<span class="collapse-toggle qg-toggle">▸ 展开 / Expand</span>';
          ghtml += '</div>';
          ghtml += '<div class="quiz-group-body">';
          ghtml += '<p class="quiz-instruction">解答本知识点的例题。Answer the practice questions for this topic.</p>';
          for (const i of grouped[g]) {
            ghtml += this.renderQuestionCard(i);
          }
          ghtml += '</div>';
          ghtml += '</div>';
          target.innerHTML = ghtml;
        }
      }
    }

    renderQuestionCard(i) {
      const q = this.questions[i];
      const userAns = this.answers[i];
      const isAnswered = userAns !== null;
      const isCorrect = isAnswered && userAns === q.correct;

      let cardClass = 'question-card';
      if (isAnswered) {
        cardClass += isCorrect ? ' answered-correct' : ' answered-incorrect';
      }

      let html = '';
      html += '<div class="' + cardClass + '">';
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
        html += '<button class="' + btnClass + '"' + disabledAttr + ' onclick="CSPQuiz.answerQuiz(\'' + this.quizId + '\',' + i + ',' + j + ')">';
        html += '<span class="option-letter">' + letters[j] + '</span>';
        html += '<span>' + escapeHtml(q.options[j]) + '</span>';
        html += '</button>';
        html += '</li>';
      }

      html += '</ul>';

      // Feedback
      let fbClass = 'feedback-box';
      let fbShow = '';
      if (isAnswered) {
        fbClass += isCorrect ? ' correct' : ' incorrect';
        fbShow = ' show';
      }
      html += '<div class="' + fbClass + fbShow + '" id="fb-' + i + '">';
      if (isAnswered) {
        html += '<div class="fb-label">' + (isCorrect ? '✓ Correct!' : '✗ Incorrect') + '</div>';
        if (q.explanation) {
          html += '<div>' + formatExplanation(q.explanation) + '</div>';
        }
        // Related knowledge points: clickable jump links
        if (q.related && q.related.length) {
          html += '<div class="related-kp">';
          html += '<span class="rk-label">🔗 关联知识点 / Related:</span> ';
          for (let k = 0; k < q.related.length; k++) {
            const r = q.related[k];
            html += '<a href="javascript:void(0)" class="rk-link" onclick="CSPQuiz.scrollToCard(\'' + escapeAttr(r.n) + '\')">' +
                    escapeHtml(r.n) + ' ' + escapeHtml(r.t) + '</a>';
            if (k < q.related.length - 1) html += ' ';
          }
          html += '</div>';
        }
      }
      html += '</div>';

      html += '</div>'; // question-card
      return html;
    }
  }

  // ============ GLOBAL INSTANCES ============
  const quizzes = {};

  window.CSPQuiz = {
    init: function(config) {
      const quiz = new Quiz(config);
      quizzes[config.quizId] = quiz;
      quiz.render();
      // Persist immediately so totalQuestions is available even before answering
      quiz.persist();
      return quiz;
    },

    getQuiz: function(quizId) {
      return quizzes[quizId] || null;
    },

    answerQuiz: function(quizId, qIndex, optionIndex) {
      const quiz = quizzes[quizId];
      if (quiz) {
        quiz.answer(qIndex, optionIndex);
        // Refresh progress chip + card completion after answering
        refreshProgress();
      }
    },

    resetQuiz: function(quizId) {
      const quiz = quizzes[quizId];
      if (quiz) quiz.reset();
    },

    getProgress: function() {
      return loadProgress();
    },

    getWrongQuestions: function() {
      return loadWrongQuestions();
    },

    clearAllProgress: function() {
      localStorage.removeItem(STORAGE_KEY_PROGRESS);
      localStorage.removeItem(STORAGE_KEY_WRONG);
    },

    // Jump to a knowledge card by its section number (e.g. "1.7").
    // Finds the .knowledge-card whose <h2> starts with that number,
    // scrolls to it, and briefly highlights it.
    scrollToCard: function(sectionNum) {
      if (!sectionNum) return;
      const cards = document.querySelectorAll('.knowledge-card');
      let target = null;
      for (const card of cards) {
        const h = card.querySelector('h2, h3');
        if (!h) continue;
        const txt = (h.textContent || '').trim();
        if (txt.indexOf(sectionNum + ' ') === 0 || txt.indexOf(sectionNum + '.') === 0 ||
            txt.indexOf(sectionNum + ' ') === 0 || txt === sectionNum ||
            txt.startsWith(sectionNum)) {
          target = card;
          break;
        }
      }
      if (!target) return;
      // Expand if collapsed
      const wrapper = target.querySelector('.collapse-body');
      const btn = target.querySelector('.collapse-toggle');
      if (wrapper && wrapper.style.display === 'none') {
        wrapper.style.display = 'block';
        if (btn) btn.textContent = '▾ 收起 / Collapse';
        target.classList.remove('collapsed');
      }
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.add('card-flash');
      setTimeout(function() { target.classList.remove('card-flash'); }, 1800);
    },

    // ============ EXPORT / IMPORT (manual sync) ============
    // Bundle all progress into a JSON file for transfer between devices.

    exportData: function() {
      const data = {
        version: 2,
        exportedAt: new Date().toISOString(),
        progress: loadProgress(),
        wrongQuestions: loadWrongQuestions(),
        vocabList: loadVocabData()
      };
      return JSON.stringify(data, null, 2);
    },

    downloadExport: function() {
      const json = this.exportData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().substring(0, 10);
      a.download = 'csp-progress-' + date + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    },

    importData: function(json) {
      try {
        const data = JSON.parse(json);
        if (!data || typeof data !== 'object') throw new Error('invalid');
        if (data.progress) saveProgress(data.progress);
        if (data.wrongQuestions) saveWrongQuestions(data.wrongQuestions);
        if (data.vocabList) saveVocabData(data.vocabList);
        return { ok: true, counts: {
          progress: data.progress ? Object.keys(data.progress).length : 0,
          wrong: data.wrongQuestions ? data.wrongQuestions.length : 0,
          vocab: data.vocabList ? data.vocabList.length : 0
        }};
      } catch(e) {
        return { ok: false, error: e.message };
      }
    }
  };

  // Load/save vocab list (shared with vocab-engine.js key)
  function loadVocabData() {
    try { return JSON.parse(localStorage.getItem('csp_vocab_list')) || []; }
    catch(e) { return []; }
  }
  function saveVocabData(list) {
    localStorage.setItem('csp_vocab_list', JSON.stringify(list));
  }

  // ============ UTILS ============
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  // Explanation text: escape HTML but preserve line breaks (\n -> <br>)
  function formatExplanation(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function truncateText(text, maxLen) {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  }

  // ============ COLLAPSE / EXPAND ============
  // Knowledge cards: default expanded, click heading to collapse.
  // Quiz groups: default collapsed, click to expand.
  function initCollapse() {
    // --- Knowledge cards ---
    document.querySelectorAll('.knowledge-card').forEach(function(card) {
      if (card.dataset.collapseInit) return;
      card.dataset.collapseInit = '1';

      // Add toggle affordance to card heading
      var heading = card.querySelector('h2, h3');
      if (!heading) return;

      // Wrap content (everything after the heading) for collapse
      var contentEls = [];
      var node = heading.nextSibling;
      while (node) {
        contentEls.push(node);
        node = node.nextSibling;
      }
      if (contentEls.length === 0) return;

      // Create a wrapper div for the content (move nodes into it)
      var wrapper = document.createElement('div');
      wrapper.className = 'collapse-body';
      contentEls.forEach(function(n) {
        wrapper.appendChild(n);
      });
      card.appendChild(wrapper);

      // Add collapse button to heading
      var btn = document.createElement('span');
      btn.className = 'collapse-toggle';
      btn.textContent = '▾ 收起 / Collapse';
      btn.title = 'Click to collapse / expand';
      heading.appendChild(btn);

      heading.style.cursor = 'pointer';
      heading.addEventListener('click', function(e) {
        // Don't toggle when clicking the vocab star
        if (e.target.closest('.vocab-star')) return;
        toggleCollapse(card, wrapper, btn);
      });
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        toggleCollapse(card, wrapper, btn);
      });
    });

    // --- Quiz groups (default collapsed) ---
    // Wiring is handled by wireQuizGroup() below + MutationObserver.
    // IMPORTANT: do NOT also bind here, or toggles get double-bound
    // (click would expand then immediately collapse = no visible effect).

    // Observe quiz-group containers: when engine injects content, wire up collapse
    var groupObserver = new MutationObserver(function(mutations) {
      mutations.forEach(function(m) {
        if (m.addedNodes.length) {
          var group = m.target;
          if (group.id && group.id.indexOf('quiz-group-') === 0) {
            wireQuizGroup(group);
          }
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
    var section = group.querySelector('.quiz-section');
    var bar = group.querySelector('.quiz-group-bar');
    var body = group.querySelector('.quiz-group-body');
    var toggle = group.querySelector('.qg-toggle');
    var label = group.querySelector('.quiz-group-label');

    if (!section || !bar || !body || !toggle) return;
    group.dataset.wired = '1';

    var numLabel = getSectionLabel(group);

    // Default collapsed
    body.style.display = 'none';
    toggle.textContent = '▸ 展开 / Expand';
    if (label) label.textContent = '📝 例题 ' + numLabel + ' / Practice';

    var doToggle = function() {
      var isHidden = body.style.display === 'none';
      body.style.display = isHidden ? 'block' : 'none';
      toggle.textContent = isHidden ? '▾ 收起 / Collapse' : '▸ 展开 / Expand';
    };

    toggle.addEventListener('click', function(e) {
      e.stopPropagation();
      doToggle();
    });
    bar.addEventListener('click', function(e) {
      if (e.target.closest('.vocab-star')) return;
      doToggle();
    });
  }

  function getSectionLabel(group) {
    // Walk backwards from the group to find the preceding knowledge-card's h2,
    // extract the leading number like "1.1".
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

  // ============ FLOATING ACTION BUTTONS ============
  // Scroll-to-top button + collapse-all button, floating bottom-right.
  function initFloatingButtons() {
    if (document.getElementById('csp-float-btns')) return;

    var container = document.createElement('div');
    container.id = 'csp-float-btns';

    // Collapse-all button
    var collapseBtn = document.createElement('button');
    collapseBtn.className = 'float-btn collapse-all';
    collapseBtn.textContent = '📚 收起';
    collapseBtn.title = 'Collapse all knowledge cards';
    collapseBtn.addEventListener('click', function() {
      document.querySelectorAll('.knowledge-card').forEach(function(card) {
        var wrapper = card.querySelector('.collapse-body');
        var btn = card.querySelector('.collapse-toggle');
        if (wrapper && wrapper.style.display !== 'none') {
          wrapper.style.display = 'none';
          if (btn) btn.textContent = '▸ 展开 / Expand';
          card.classList.add('collapsed');
        }
      });
    });

    // Scroll-to-top button
    var topBtn = document.createElement('button');
    topBtn.className = 'float-btn scroll-top';
    topBtn.textContent = '⬆';
    topBtn.title = 'Back to top';
    topBtn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    container.appendChild(collapseBtn);
    container.appendChild(topBtn);
    document.body.appendChild(container);

    // Show/hide scroll-top button based on scroll position
    var onScroll = function() {
      var y = window.scrollY || document.documentElement.scrollTop;
      topBtn.classList.toggle('visible', y > 300);
      collapseBtn.classList.toggle('visible', y > 300);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ============ WEEK PROGRESS BAR + CARD COMPLETION ============
  // Shows "completed X knowledge cards / Y questions" in the page header,
  // and marks each knowledge card with a ✓ when its practice group is done.
  function initProgressTracking() {
    // Determine quiz id from the page
    var bodyHtml = document.body.innerHTML;
    var m2 = /quizId:\s*'([^']+)'/.exec(bodyHtml);
    if (!m2) return;

    // Initial render
    refreshProgress();
  }

  function refreshProgress() {
    var bodyHtml = document.body.innerHTML;
    var m2 = /quizId:\s*'([^']+)'/.exec(bodyHtml);
    if (!m2) return;
    var pageQuizId = m2[1];

    var progress = null;
    try { progress = JSON.parse(localStorage.getItem('csp_study_progress') || '{}'); }
    catch(e) { return; }
    var p = progress[pageQuizId];
    var total = p && p.totalQuestions ? p.totalQuestions : 0;
    var answers = p && p.answers ? p.answers : [];
    var answered = answers.filter(function(a){ return a !== null; }).length;
    var completed = p && p.correctCount ? p.correctCount : 0;

    // Build a progress chip in the page header (create once, update text)
    var header = document.querySelector('.page-header');
    if (header) {
      var chip = header.querySelector('.week-progress-chip');
      if (!chip) {
        chip = document.createElement('div');
        chip.className = 'week-progress-chip';
        header.appendChild(chip);
      }
      chip.innerHTML = '<span>📊 进度 / Progress</span> <strong>' + answered + '/' + total + '</strong> 题 answered · <strong>' + completed + '/' + total + '</strong> 对 correct';
    }

    if (!p || !p.answers) return;

    // Mark knowledge cards as done based on quiz-group completion
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

  // ============ STICKY PAGE TITLE ============
  // Keeps the page header visible at top while scrolling.
  function initStickyHeader() {
    var header = document.querySelector('.page-header');
    if (!header || header.dataset.sticky) return;
    header.dataset.sticky = '1';
    header.classList.add('sticky-header');
  }

  // ============ AUTO-INIT ============
  document.addEventListener('DOMContentLoaded', function() {
    initCollapse();
    initFloatingButtons();
    initProgressTracking();
    initStickyHeader();
    // Re-run progress after quizzes render (slightly delayed)
    setTimeout(initProgressTracking, 400);
    setTimeout(initProgressTracking, 1200);
  });

  console.log('📚 CSP Quiz Engine loaded. Call CSPQuiz.init({...}) to start a quiz.');
})();
