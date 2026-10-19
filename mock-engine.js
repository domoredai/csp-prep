/*=============================================
   CSP Exam Prep — Full-length mock exam engine
   200 questions · 5.5 hours · per-domain scoring
   =============================================*/
(function() {
  'use strict';

  const set = document.body.getAttribute('data-set') || 'a';
  const mock = window.CSP_MOCKS && window.CSP_MOCKS[set];
  if (!mock) {
    document.getElementById('mock-main').innerHTML = '<p style="padding:40px;text-align:center;">题目数据加载失败，请刷新重试。</p>';
    return;
  }

  const TOTAL_TIME = 5.5 * 60 * 60; // seconds
  const SESSION_KEY = 'csp_mock_session_' + set;
  const RESULTS_KEY = 'csp_mock_results';
  const LETTERS = ['A', 'B', 'C', 'D'];
  const DOMAIN_NAMES = {
    '1': 'D1 安全原理高级应用',
    '2': 'D2 项目管理',
    '3': 'D3 风险管理',
    '4': 'D4 应急管理',
    '5': 'D5 环境管理',
    '6': 'D6 职业健康',
    '7': 'D7 培训'
  };

  const questions = mock.questions;
  const total = questions.length;

  const state = {
    answers: new Array(total).fill(null),
    flags: new Array(total).fill(false),
    current: 0,
    startedAt: null,
    deadline: null,
    mode: 'timed',
    submitted: false
  };
  let timerId = null;

  const $ = id => document.getElementById(id);
  const main = $('mock-main');
  const startEl = $('mock-start');
  const questionEl = $('mock-question');
  const reportEl = $('mock-report');
  const timerEl = $('mock-timer');
  const progressEl = $('mock-progress');
  const submitBtn = $('mock-submit');
  const paletteEl = $('mock-palette');
  const sideEl = $('mock-side');

  // ---------- storage ----------
  function loadSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!s || !Array.isArray(s.answers) || s.answers.length !== total) return null;
      return s;
    } catch (e) { return null; }
  }
  function saveSession() {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        answers: state.answers, flags: state.flags, current: state.current,
        startedAt: state.startedAt, deadline: state.deadline, mode: state.mode
      }));
    } catch (e) { /* storage full — exam still works in memory */ }
  }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }
  function loadResults() {
    try { const a = JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function saveResult(r) {
    const a = loadResults();
    a.push(r);
    while (a.length > 20) a.shift();
    try { localStorage.setItem(RESULTS_KEY, JSON.stringify(a)); } catch (e) {}
  }

  // ---------- ui helpers ----------
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }
  function answeredCount() {
    return state.answers.filter(a => a !== null && a !== undefined).length;
  }

  // ---------- start screen ----------
  function renderStart(hasSession) {
    startEl.hidden = false;
    questionEl.hidden = true;
    reportEl.hidden = true;
    submitBtn.disabled = true;
    let html = '<div class="mock-start">';
    html += '<h1>⏱ ' + esc(mock.title) + '</h1>';
    html += '<p class="ms-lead">' + total + ' 道单选题 · 建议用时 5 小时 30 分钟 · 按 CSP11 七领域权重组卷</p>';
    html += '<ul class="ms-rules">';
    html += '<li>计时模式下倒计时结束会自动交卷；中途关闭页面后可以继续，倒计时按真实时间流逝。</li>';
    html += '<li>答题卡可跳题、标记；交卷前可以随时改答案。</li>';
    html += '<li>交卷后立即出总分和分领域正确率，答错的题会自动加入错题本。</li>';
    html += '<li>这是练习模拟，不是 BCSP 真题；正确率不能直接换算成官方 scaled score。</li>';
    html += '</ul>';
    html += '<div class="ms-modes">';
    html += '<label><input type="radio" name="mode" value="timed" checked> 计时 5:30:00（推荐）</label>';
    html += '<label><input type="radio" name="mode" value="untimed"> 不计时（练习用）</label>';
    html += '</div>';
    html += '<div class="ms-actions">';
    if (hasSession) {
      html += '<button class="btn btn-primary" id="resume-btn">继续上次作答</button>';
      html += '<button class="btn btn-outline" id="restart-btn">重新开始</button>';
    } else {
      html += '<button class="btn btn-primary" id="start-btn">开始考试</button>';
    }
    html += '<a class="btn btn-outline" href="practice.html">返回强化训练</a>';
    html += '</div>';
    if (!hasSession) {
      const results = loadResults().filter(r => r.id === set);
      if (results.length) {
        const last = results[results.length - 1];
        html += '<p class="ms-last">上次成绩：<strong>' + last.score + '/' + last.total + ' · ' + last.pct + '%</strong>（' + new Date(last.at).toLocaleString() + '）</p>';
      }
    }
    html += '</div>';
    startEl.innerHTML = html;
    timerEl.textContent = '05:30:00';

    if (hasSession) {
      $('resume-btn').addEventListener('click', resumeSession);
      $('restart-btn').addEventListener('click', function() {
        if (confirm('放弃上次进度，重新开始？')) { clearSession(); resetState(); startExam(document.querySelector('input[name="mode"]:checked').value); }
      });
    } else {
      $('start-btn').addEventListener('click', function() {
        startExam(document.querySelector('input[name="mode"]:checked').value);
      });
    }
  }

  function resetState() {
    state.answers = new Array(total).fill(null);
    state.flags = new Array(total).fill(false);
    state.current = 0;
    state.submitted = false;
  }

  function resumeSession() {
    const s = loadSession();
    if (!s) return renderStart(false);
    state.answers = s.answers.slice();
    state.flags = (s.flags || new Array(total).fill(false)).slice();
    state.current = s.current || 0;
    state.startedAt = s.startedAt;
    state.deadline = s.deadline;
    state.mode = s.mode || 'timed';
    state.submitted = false;
    beginRunning();
  }

  function startExam(mode) {
    state.mode = mode === 'untimed' ? 'untimed' : 'timed';
    state.startedAt = Date.now();
    state.deadline = state.mode === 'timed' ? Date.now() + TOTAL_TIME * 1000 : null;
    resetState();
    saveSession();
    beginRunning();
  }

  function beginRunning() {
    startEl.hidden = true;
    reportEl.hidden = true;
    questionEl.hidden = false;
    submitBtn.disabled = false;
    renderPalette();
    renderQuestion();
    updateHeader();
    startTimer();
    document.body.classList.add('mock-running');
  }

  // ---------- timer ----------
  function startTimer() {
    stopTimer();
    tick();
    timerId = setInterval(tick, 1000);
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
  function tick() {
    if (state.mode === 'timed' && state.deadline) {
      const remain = Math.max(0, Math.round((state.deadline - Date.now()) / 1000));
      timerEl.textContent = fmtClock(remain);
      timerEl.classList.toggle('warning', remain > 0 && remain <= 15 * 60);
      if (remain <= 0) { stopTimer(); submit(true); }
    } else {
      const elapsed = Math.max(0, Math.round((Date.now() - state.startedAt) / 1000));
      timerEl.textContent = fmtClock(elapsed);
    }
  }

  // ---------- question ----------
  function renderQuestion() {
    const i = state.current;
    const q = questions[i];
    const chosen = state.answers[i];
    let html = '<div class="mq-card">';
    html += '<div class="mq-head">';
    html += '<span class="mq-domain">' + esc(DOMAIN_NAMES[q.domain] || ('D' + q.domain)) + '</span>';
    html += '<span class="mq-index">第 ' + (i + 1) + ' / ' + total + ' 题</span>';
    html += '<button class="mq-flag' + (state.flags[i] ? ' on' : '') + '" id="flag-btn">⚑ ' + (state.flags[i] ? '已标记' : '标记') + '</button>';
    html += '</div>';
    html += '<div class="mq-text">' + esc(q.text) + '</div>';
    html += '<ul class="options-list">';
    for (let j = 0; j < q.options.length; j++) {
      html += '<li><button class="option-btn mock-option' + (chosen === j ? ' selected' : '') + '" data-opt="' + j + '">' +
        '<span class="option-letter">' + LETTERS[j] + '</span><span>' + esc(q.options[j]) + '</span></button></li>';
    }
    html += '</ul>';
    html += '<div class="mq-nav">';
    html += '<button class="btn btn-outline" id="prev-btn"' + (i === 0 ? ' disabled' : '') + '>← 上一题</button>';
    html += '<button class="btn btn-outline" id="clear-btn"' + (chosen === null ? ' disabled' : '') + '>清除本题</button>';
    html += '<button class="btn btn-primary" id="next-btn">' + (i === total - 1 ? '最后一题' : '下一题 →') + '</button>';
    html += '</div>';
    html += '</div>';
    questionEl.innerHTML = html;

    questionEl.querySelectorAll('[data-opt]').forEach(btn => {
      btn.addEventListener('click', function() { selectOption(parseInt(btn.dataset.opt, 10)); });
    });
    $('prev-btn').addEventListener('click', function() { go(state.current - 1); });
    $('next-btn').addEventListener('click', function() { go(state.current + 1); });
    $('clear-btn').addEventListener('click', function() {
      state.answers[state.current] = null;
      saveSession(); renderQuestion(); renderPalette(); updateHeader();
    });
    $('flag-btn').addEventListener('click', function() {
      state.flags[state.current] = !state.flags[state.current];
      saveSession(); renderQuestion(); renderPalette(); updateHeader();
    });
  }

  function selectOption(j) {
    state.answers[state.current] = j;
    saveSession();
    renderQuestion();
    renderPalette();
    updateHeader();
  }

  function go(i) {
    if (i < 0 || i >= total) return;
    state.current = i;
    saveSession();
    renderQuestion();
    renderPalette();
    updateHeader();
    const card = questionEl.querySelector('.mq-card');
    if (card && card.scrollIntoView) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // ---------- palette ----------
  function renderPalette() {
    let html = '';
    for (let i = 0; i < total; i++) {
      let cls = 'pal-btn';
      if (state.answers[i] !== null) cls += ' answered';
      if (state.flags[i]) cls += ' flagged';
      if (i === state.current) cls += ' current';
      html += '<button class="' + cls + '" data-i="' + i + '" aria-label="第 ' + (i + 1) + ' 题">' + (i + 1) + '</button>';
    }
    paletteEl.innerHTML = html;
    paletteEl.querySelectorAll('.pal-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        go(parseInt(btn.dataset.i, 10));
        if (window.innerWidth < 860) sideEl.classList.remove('open');
      });
    });
  }

  function updateHeader() {
    progressEl.textContent = answeredCount() + ' / ' + total;
    const flagged = state.flags.filter(Boolean).length;
    const dot = $('mock-flag-count');
    if (dot) dot.textContent = flagged ? flagged + ' 标记' : '';
  }

  // ---------- submit / report ----------
  function submit(auto) {
    if (state.submitted) return;
    const unanswered = total - answeredCount();
    if (!auto) {
      const msg = '确定交卷？' + (unanswered ? '\n还有 ' + unanswered + ' 题未作答。' : '\n已全部作答。');
      if (!confirm(msg)) return;
    } else {
      alert('时间到，已自动交卷。');
    }
    state.submitted = true;
    stopTimer();
    submitBtn.disabled = true;

    const byDomain = {};
    let score = 0;
    const wrongs = [];
    questions.forEach((q, i) => {
      const d = q.domain;
      if (!byDomain[d]) byDomain[d] = { correct: 0, total: 0 };
      byDomain[d].total++;
      if (state.answers[i] === q.correct) {
        byDomain[d].correct++;
        score++;
      } else {
        wrongs.push(i);
        if (state.answers[i] !== null && window.CSPQuiz && CSPQuiz.addExternalWrong) {
          CSPQuiz.addExternalWrong('mock-' + set, mock.title, i, q, state.answers[i]);
        }
      }
    });

    const pct = Math.round(score / total * 100);
    const duration = Math.round((Date.now() - state.startedAt) / 1000);
    const result = {
      id: set, at: new Date().toISOString(), score: score, total: total, pct: pct,
      byDomain: byDomain, duration: duration
    };
    saveResult(result);
    clearSession();
    renderReport(result, wrongs);
  }

  function renderReport(result, wrongs) {
    questionEl.hidden = true;
    startEl.hidden = true;
    const report = reportEl;
    report.hidden = false;

    let html = '<div class="mock-report">';
    html += '<div class="mr-hero">';
    html += '<div class="mr-score">' + result.score + '<span>/' + result.total + '</span></div>';
    html += '<div class="mr-pct">' + result.pct + '%</div>';
    html += '<div class="mr-time">用时 ' + fmtClock(result.duration) + ' · 交卷时间 ' + new Date(result.at).toLocaleString() + '</div>';
    html += '</div>';

    html += '<div class="mr-note">BCSP 使用 scaled score，正确率不能直接换算成是否通过；一般建议稳定在 80% 以上再报考。本次错题已自动加入错题本。</div>';

    html += '<div class="section-title" style="margin-top:18px;">分领域成绩</div>';
    html += '<table class="mr-table"><thead><tr><th>领域</th><th>正确/总数</th><th>正确率</th></tr></thead><tbody>';
    for (const d of Object.keys(DOMAIN_NAMES)) {
      const x = result.byDomain[d];
      if (!x) continue;
      const p = Math.round(x.correct / x.total * 100);
      html += '<tr><td>' + DOMAIN_NAMES[d] + '</td><td>' + x.correct + ' / ' + x.total + '</td><td>' + p + '%</td></tr>';
    }
    html += '</tbody></table>';

    if (wrongs.length) {
      html += '<div class="section-title" style="margin-top:22px;">错题回顾（' + wrongs.length + '）</div>';
      html += '<div class="mr-wrongs">';
      for (const i of wrongs) {
        const q = questions[i];
        const your = state.answers[i] === null ? '未作答' : LETTERS[state.answers[i]] + '. ' + q.options[state.answers[i]];
        html += '<details class="mr-wrong">';
        html += '<summary><span class="mrw-num">' + (i + 1) + '</span>' + esc(String(q.text).slice(0, 90)) + (String(q.text).length > 90 ? '…' : '') + '</summary>';
        html += '<div class="mrw-body">';
        html += '<div class="mrw-line"><strong>你的答案：</strong><span class="bad">' + esc(your) + '</span></div>';
        html += '<div class="mrw-line"><strong>正确答案：</strong><span class="good">' + LETTERS[q.correct] + '. ' + esc(q.options[q.correct]) + '</span></div>';
        html += '<div class="mrw-exp">' + esc(q.explanation).replace(/\n/g, '<br>') + '</div>';
        html += '<div class="mrw-src">来源：<a href="' + esc(q.src || 'index.html') + '">' + esc(q.src || '') + '</a></div>';
        html += '</div></details>';
      }
      html += '</div>';
    }

    html += '<div class="mr-actions">';
    html += '<a class="btn btn-primary" href="index.html">返回仪表盘</a>';
    html += '<a class="btn btn-outline" href="review-wrong.html">去错题本复习</a>';
    html += '<button class="btn btn-outline" id="retake-btn">再考一次</button>';
    html += '</div>';
    html += '</div>';
    report.innerHTML = html;

    $('retake-btn').addEventListener('click', function() {
      if (!confirm('重新开始一次完整模拟？（本次成绩已保存）')) return;
      resetState();
      renderStart(false);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.classList.remove('mock-running');
  }

  // ---------- top bar ----------
  submitBtn.addEventListener('click', function() {
    if (state.submitted || questionEl.hidden) return;
    submit(false);
  });
  $('side-toggle').addEventListener('click', function() { sideEl.classList.toggle('open'); });

  // ---------- keyboard ----------
  document.addEventListener('keydown', function(e) {
    if (state.submitted || questionEl.hidden) return;
    const tag = (e.target.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const k = e.key.toUpperCase();
    const map = { '1': 0, '2': 1, '3': 2, '4': 3, 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    if (k in map) { e.preventDefault(); selectOption(map[k]); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(state.current - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(state.current + 1); }
    else if (k === 'F') { e.preventDefault(); state.flags[state.current] = !state.flags[state.current]; saveSession(); renderQuestion(); renderPalette(); }
  });

  window.addEventListener('beforeunload', function(e) {
    if (!state.submitted && !questionEl.hidden) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ---------- init ----------
  const saved = loadSession();
  if (saved) {
    // Show resume screen but preload state so the timer can run after resume.
    renderStart(true);
    timerEl.textContent = saved.mode === 'timed' && saved.deadline
      ? fmtClock(Math.max(0, (saved.deadline - Date.now()) / 1000))
      : '00:00:00';
  } else {
    renderStart(false);
  }
})();
