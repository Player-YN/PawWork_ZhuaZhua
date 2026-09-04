# 爪爪 · 完全解放版

本地、开发者模式、不上架的 Chrome MV3 实验。把**已登录的浏览器**当成可编程层（live-page `action`）。  
这不是 爪爪 · Paw Work 产品，也不是 CWS 发行包。完整说明见 [HANDOFF.md](HANDOFF.md)。

## 加载（本文件夹就是扩展根）

不要找 `artifacts/unpacked`，不要 `npm install`。Chrome 直接加载**这个目录**。

1. 打开 Chrome → `chrome://extensions`
2. 打开右上角 **开发者模式**
3. **加载已解压的扩展程序**
4. 选本文件夹（里面有 `manifest.json`）

路径（在本文件夹里执行）：

```powershell
(Get-Item .).FullName
```

桌面上的目录名是 `PawWork完全解放版`。不要改这个文件夹名——Chrome 多半已经从该路径加载。

然后：侧栏打开扩展 → 填自己的模型 Key → 在普通网页上用 `action`（先 snapshot，再用 ref+rev 点/填）。

## 这是什么 / 不是什么

| 是 | 不是 |
|----|------|
| 野生工作簿、独立 Git | Paw Work 官方产品 |
| unpacked MV3，开发者自己用 | Chrome 网上应用店 / 出售 |
| `action` + 历史遗留工作区代码 | 官方 north star（选中 + 描述结果 → 交付） |

不要把这里的改动推到公开仓库 `PawWork_ZhuaZhua` 的 `unpacked` 分支。

## 改代码

直接改本目录里的 `src/`，然后在 `chrome://extensions` 点本扩展的 **重新加载**。
