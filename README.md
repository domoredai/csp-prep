# CSP Exam Prep

CSP（Certified Safety Professional）备考学习工具：24 周双语学习内容 + 1000+ 道单选题 + 6 套月度模拟考 + 间隔复习错题本 + 术语闪卡。纯静态站点（HTML/CSS/JS），可离线使用，可直接部署到 GitHub Pages。

线上地址：<https://domoredai.github.io/csp-prep/>

## 功能

- **24 周课程**：每周知识点（中英对照）+ 分知识点练习 + 周测。
- **6 套月度模拟考**：按 CSP11 七大领域覆盖，自动计分。
- **错题本 v2**：答错自动入库，按 1/3/7/14 天间隔复习，连续答对 3 次归入「已掌握」；支持「明天再练」「标记已掌握」「移出错题本」。
- **学习仪表盘**：总体正确率、答题数、错题数、连续学习天数、14 天活动图、每日目标（10/20/30/50 题）。
- **进度安全**：localStorage 自动快照（最近 6 个）、一键恢复、JSON 导出/导入（合并或覆盖）。
- **搜索**：`Ctrl/Cmd + K` 或按 `/`，搜索周次、考点、术语。
- **深色模式**：右下角 🌙 切换，偏好会记住。
- **PWA / 离线**：Service Worker 网络优先、缓存兜底；仪表盘「安装到手机」可添加到主屏幕，之后内容更新自动生效。

## 题目选项顺序（v3）

原始题库里正确答案有 58% 落在 B，容易养成「不会就选 B」的习惯。v3 会按固定规则对每道题的选项做**确定性轮换**，让正确答案在 A–D 上均匀分布（实测每个位置约 25%）。

- 题目 ID、题目顺序、题库内容都不变；
- 已保存的答案会按同一规则自动换算，**仍然指向你当初选的那个选项**，得分不变（首次打开旧进度时自动迁移一次）；
- 旧错题在打开对应周页面时会自动补全完整选项，之后就能在错题本里直接重做。

## 本地运行

```bash
# 任选其一
npx serve .
python -m http.server 8000
```

然后打开 <http://localhost:8000/>。直接双击 `index.html` 也能看内容，但 `file://` 下部分浏览器会限制 localStorage，建议用本地服务器。

## 目录结构

```
.
├── index.html              # 仪表盘（今日计划、统计、周计划、备份）
├── week-01.html … week-24.html
├── exam-month-01.html … exam-month-06.html
├── review-wrong.html       # 错题本 + 间隔复习
├── glossary.html           # 术语表（支持 ?q= 查询）
├── vocab-flashcards.html   # 单词闪卡
├── quiz-engine.js          # 答题引擎 / 进度 / 复习 / 备份 / 搜索 / 主题
├── vocab-engine.js         # 术语数据与高亮
├── quiz-styles.css
├── sw.js                   # Service Worker（缓存 v6）
└── manifest.json
```

## 学习进度的存储

所有进度都存在浏览器 **localStorage**，按域名隔离：

| Key | 内容 |
| --- | --- |
| `csp_study_progress` | 每套题的答案、得分、完成状态 |
| `csp_wrong_questions` | 错题（含完整题目快照、复习阶段、下次复习时间） |
| `csp_vocab_list` | 收藏的术语 |
| `csp_activity` | 每日答题数（连续学习天数） |
| `csp_settings` | 主题、每日目标、开始日期 |
| `csp_backups` | 最近 6 个自动/手动快照 |
| `csp_schema_version` | 数据版本（当前 3） |

升级不会清空这些 key；v3 会自动把旧错题补齐复习字段。**换浏览器/换设备/清理站点数据会丢失进度**，请先在仪表盘「数据与备份」导出 JSON。

## 修改题目

每道题位于对应页面的 `CSPQuiz.init({...})` 中：

```js
{
  text: '题干',
  group: 1,                    // 对应页面里 <div id="quiz-group-1">
  options: ['A', 'B', 'C', 'D'],
  correct: 1,                  // 正确项下标（0 起）
  explanation: '英文解析\n\n中文解析',
  related: [{ n: '1.2', t: '消除与替代' }]
}
```

改题后请把 `quiz-styles.css?v=` / `quiz-engine.js?v=` 中的版本号 +1（或改 `sw.js` 的 `CACHE_NAME`），避免旧缓存。

## 部署

仓库 `deploy/` 目录即站点根目录（本仓库根目录就是它）。推送到 `main` 后由 GitHub Pages 发布：

```bash
git add -A
git commit -m "Update content"
git push origin main
```

## 数据校验

`csp-tools/`（不在发布目录）里有基于 jsdom 的检查脚本：加载全部页面、捕获 JS 错误、校验题目结构、关联知识点是否存在。

```bash
cd csp-tools
npm install
node audit.mjs ../csp-prep
```
