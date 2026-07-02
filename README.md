# GitLens 翻译工具

[English](README_EN.md) | 简体中文

---

## 📦 快速开始

1. 克隆仓库或下载**Release**包(如果你需要缓存则必须下载 Releases)
2. 在目录下运行 `npm install`。
3. 打开[translate_gitlens.js](file:///c:/Users/Lesli/Desktop/gitlens-l10n/translate_gitlens.js), 修改16行中的`EXTENSION_DIR`路径到你的`gitlens`路径
4. 执行 `npm run translate`。

### 情况 A - 汉化
4. 一路回车即可
5. 完成后重启 VS Code 即可看到中文界面。

### 情况 B – 其他语言
3. 运行 `npm run translate`，脚本会在第一次运行时在 `caches/` 目录下创建对应语言的 `translate_cache_<lang>.json` 并自动复用。

> **缓存说明**：根据翻译的目标语言，翻译结果会独立持久化到项目根目录下的 `caches/` 目录中，生成 `translate_cache_<lang>.json` 文件（例如中文缓存为 `caches/translate_cache_zh.json`）。后续运行将直接命中对应语言的缓存，无需重复翻译，显著提升速度并降低 API 调用次数。 因此我希望有更多该插件的使用者去提交语言缓存 去方便更多的人去使用

## 🚀 运行脚本交互流程
```
0️⃣ 选择显示语言（en/zh）
1️⃣ 输入目标翻译语言代码（zh、ja、fr …）
2️⃣ 选择翻译方式（默认 Deepl）
   1. deepl‑free（无需 API Key）
   2. deepl‑paid（需要 `DEEPL_API_KEY` 修改环境变量）
   3. google（需要 `GOOGLE_API_KEY` 修改环境变量）
3️⃣ 开始翻译；若对应语言的缓存文件存在，将优先使用该缓存文件。
```

## 📄 其它说明
- 如需恢复到原始英文界面：`npm run restore` 或 `node translate_gitlens.js --restore`。
- 如需清除所有语言的缓存文件：`npm run clear-cache`。

## 🖼️ 效果演示

| 1. 交互式选择语言及翻译引擎 | 2. 开始翻译并自动生成缓存 |
| :---: | :---: |
| ![step1](images/1.png) | ![step2](images/2.png) |
| **3. 翻译完成并成功写入插件** | **4. 重启 VS Code 后的汉化效果** |
| ![step3](images/3.png) | ![step4](images/4.png) |
