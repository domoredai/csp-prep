const fs = require('fs');
const files = ['week-02','week-03','week-04','week-05','week-06','week-07'];
let fail = 0;
for (const f of files) {
  const s = fs.readFileSync(f + '.html', 'utf8');
  const m = s.match(/CSPQuiz\.init\(([\s\S]*?)\);\s*<\/script>/);
  if (!m) { console.log(f, 'NO MATCH'); fail++; continue; }
  let cfg;
  try { cfg = eval('(' + m[1] + ')'); }
  catch (e) { console.log(f, 'SYNTAX ERROR:', e.message); fail++; continue; }
  const groups = (s.match(/id="quiz-group-(\d+)"/g) || []).map(x => x.match(/\d+/)[0]);
  const gnums = new Set(groups);
  const bad = [];
  const seen = new Map();
  cfg.questions.forEach((q, i) => {
    if (!q.related || !q.related.length) bad.push('Q' + (i+1) + ' no related');
    if (!gnums.has(String(q.group))) bad.push('Q' + (i+1) + ' group ' + q.group + ' missing');
    (q.related || []).forEach(r => {
      if (!/^\d\.\d$/.test(r.n)) bad.push('Q' + (i+1) + ' bad n ' + r.n);
      if (!r.t) bad.push('Q' + (i+1) + ' bad t');
    });
  });
  const scenWith = (s.match(/class="exam-scenario"[\s\S]{0,80}?data-options=/g) || []).length;
  const scenAll = (s.match(/class="exam-scenario"/g) || []).length;
  console.log(`${f}: quizId=${cfg.quizId} questions=${cfg.questions.length} groups=${groups.length} scenarios=${scenWith}/${scenAll} crossRef=${s.split('cross-ref').length-1} ${bad.length ? 'PROBLEMS ' + bad.slice(0,5).join('; ') : 'OK'}`);
  if (bad.length) fail++;
}
process.exit(fail ? 1 : 0);
