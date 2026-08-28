# 爪爪 · Paw Work — 阶段战略（vNext）

> 与 `POSITIONING.md` 配套。工程方向以 `docs/SESSION_WORKSPACE_RUNTIME.md` 为准。

---

## 1. 当前决策

**产品全面以 Runtime vNext / Selection-first 定调。**

不把精力花在：

- 47-tool 长期兼容迁移  
- Tauri / 桌面壳 / 本机 Python 运行时  
- 宏大「Browser OS」对外叙事  

而押注：

> 用户能否自然「选网页内容 → 说结果 → 拿到可核对交付物」，并在选区内保持可信。

---

## 2. 双层叙事

| 层 | 一句话 | 作用 |
|----|--------|------|
| **Wedge（获客）** | Select → Outcome → Deliver | 习惯与 Context Transfer |
| **Depth（留存）** | 在选区/授权内可靠执行与（未来）复用 | 复杂 Web 任务与证据闭环 |

---

## 3. 现在做什么 / 不做什么

### 做

- 稳定 Paw 选择与任务输入  
- 选区内精化、选区外需意图  
- 交付物真实、可停、可验证  
- 按 Spec 准备 Runtime 重置（显式开工时）  

### 不做（本阶段）

- Recipe 市场、多 Agent 编排、WebContainer-as-OS  
- 无限业务 Tool 膨胀  
- 依赖 Developer Mode / 本地 daemon 的主路径  

---

## 4. 成功信号（非融资 KPI，是方向是否对）

- 用户会先选再说话，而不是只把扩展当聊天框  
- 未说「全部」时几乎不越界  
- 一次完整任务能留下可带走的文件且内容对  
- 开发侧：Acceptance 思想（Spec A–P）能卡住错误重构  

---

## 5. 与旧战略的关系

旧「8–12 周电商楔子 / Conditional GO」中，**可信执行与交付物**仍然成立；  
**宿主差异化**改写为 Selection-first + Ambient 上下文，而不是「会点网页」。  

工程上允许 architecture reset；旧 tool 链仅作参考与回归样本。
