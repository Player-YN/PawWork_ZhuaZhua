# Paw Work — this folder is the Chrome extension

**Where is this folder?** This README lives inside the folder Chrome must load. Git clone creates `paw-work` under the directory where you ran the command — it is not a fixed Desktop path. If you cloned from your user home, that is `C:\Users\yyy\paw-work`.

Print the absolute path (run this *inside* this folder):

```powershell
(Get-Item .).FullName
```

macOS / Linux: `pwd` or `realpath .`

Load **this folder** in Chrome. Do not look for a separate `src` tree or run `npm install`.

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select **this folder** — the path printed above (it contains `manifest.json`)

Then turn Paw Mode on, paste a model key, select something on a page, and describe the outcome.

Updates: clone branch `unpacked` again, or download the [Release zip](https://github.com/Player-YN/PawWork_ZhuaZhua/releases/latest).

---

# 爪爪 · 这个文件夹就是 Chrome 扩展

**你现在在哪个文件夹？** 这份 README 就在 Chrome 要加载的文件夹里。克隆会在**你运行命令时的当前目录**下新建 `paw-work`，不是固定到桌面。若在用户主目录跑，就是 `C:\Users\yyy\paw-work`。

在本文件夹里打开 PowerShell，打印绝对路径：

```powershell
(Get-Item .).FullName
```

macOS / Linux：`pwd` 或 `realpath .`

在 Chrome 里加载 **本文件夹**。不要找开发用的 `src`，也不要 `npm install`。

1. 打开 Chrome，地址栏进入 `chrome://extensions`
2. 打开右上角 **开发者模式**
3. 点 **加载已解压的扩展程序**
4. 选 **本文件夹** — 上面打印出来的路径（里面有 `manifest.json`）

然后打开伸爪、填模型密钥、在网页上选一块、说出结果。
