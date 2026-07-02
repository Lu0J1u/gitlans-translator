/**
 * GitLens 18.2.0 简体中文汉化及还原工具
 * 
 * 使用方法:
 *   1. 汉化插件: node translate_gitlens.js
 *   2. 还原插件: node translate_gitlens.js --restore
 * 
 * 本脚本不依赖任何第三方 npm 包，直接使用 node 运行即可。
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

// 目标 GitLens 插件路径
const EXTENSION_DIR = "C:/Users/Lu0J1u/.vscode/extensions/eamodio.gitlens-18.2.0";

// 解析命令行参数
const args = process.argv.slice(2);
let targetLanguage = 'zh';
let translationEngine = 'deepl-free';
let displayLanguage = 'zh';

for (const arg of args) {
    if (arg.startsWith('--target=')) {
        targetLanguage = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--engine=')) {
        translationEngine = arg.split('=')[1].toLowerCase();
    } else if (arg.startsWith('--display=')) {
        displayLanguage = arg.split('=')[1].toLowerCase();
    }
}

// 内存翻译缓存，避免单次运行中重复请求相同的词条
const translationCache = {};

// 持久化缓存文件夹及 file 路径
const CACHE_DIR = path.join(process.cwd(), 'caches');
const CACHE_FILE = path.join(CACHE_DIR, `translate_cache_${targetLanguage}.json`);

// 自动迁移根目录下的旧语言缓存文件
const legacyFile = path.join(process.cwd(), `translate_cache_${targetLanguage}.json`);
if (fs.existsSync(legacyFile)) {
    try {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
        fs.renameSync(legacyFile, CACHE_FILE);
        console.log(`[缓存] 检测到根目录下的旧缓存文件，已自动迁移至: caches/translate_cache_${targetLanguage}.json`);
    } catch (e) {
        // Ignore
    }
}

// 加载持久化缓存
function loadCache() {
    if (fs.existsSync(CACHE_FILE)) {
        try {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            Object.assign(translationCache, JSON.parse(data));
            const count = Object.keys(translationCache).length;
            console.log(`[缓存] 检测到已有的持久化翻译缓存 (${targetLanguage})，已自动载入 ${count} 条记录！`);
        } catch (e) {
            console.log(`[缓存] 载入持久化缓存失败: ${e.message}`);
        }
    }
}

// 保存持久化缓存
function saveCache() {
    try {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
        fs.writeFileSync(CACHE_FILE, JSON.stringify(translationCache, null, '\t'), 'utf8');
    } catch (e) {
        console.log(`[缓存] 保存持久化缓存失败: ${e.message}`);
    }
}

// 辅助函数: 等待一段时间
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 请填写你的Deepl Key
const DEEPL_API_KEY = "";

// 原生 HTTPS DeepL 翻译接口
function fetchDeepLTranslation(text) {
    return new Promise((resolve, reject) => {
        const isFree = translationEngine !== 'deepl-paid';
        const url = isFree ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
        const apiKey = process.env.DEEPL_API_KEY || DEEPL_API_KEY;

        const postData = JSON.stringify({
            text: [text],
            target_lang: targetLanguage.toUpperCase()
        });

        const options = {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 6000
        };

        const req = https.request(url, options, (res) => {
            if (res.statusCode !== 200) {
                let errData = '';
                res.on('data', chunk => errData += chunk);
                res.on('end', () => {
                    reject(new Error(`HTTP 状态码: ${res.statusCode}. 信息: ${errData}`));
                });
                return;
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.translations && json.translations[0]) {
                        resolve(json.translations[0].text);
                    } else {
                        reject(new Error('非法的 DeepL 响应结构'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
        });

        req.write(postData);
        req.end();
    });
}

// 原生 HTTPS Google 翻译接口
function fetchGoogleTranslation(text) {
    return new Promise((resolve, reject) => {
        const apiKey = process.env.GOOGLE_API_KEY;
        if (apiKey) {
            // 官方 Google Translation API
            const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
            const postData = JSON.stringify({
                q: [text],
                target: targetLanguage
            });
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: 6000
            };
            const req = https.request(url, options, (res) => {
                if (res.statusCode !== 200) {
                    let errData = '';
                    res.on('data', chunk => errData += chunk);
                    res.on('end', () => reject(new Error(`Google API HTTP ${res.statusCode}: ${errData}`)));
                    return;
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.data && json.data.translations && json.data.translations[0]) {
                            resolve(json.data.translations[0].translatedText);
                        } else {
                            reject(new Error('非法的 Google Response 结构'));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
            req.write(postData);
            req.end();
        } else {
            // 公共 Google 翻译接口 (无需 API Key)
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLanguage)}&dt=t&q=${encodeURIComponent(text)}`;
            const options = {
                method: 'GET',
                timeout: 6000
            };
            const req = https.request(url, options, (res) => {
                if (res.statusCode !== 200) {
                    let errData = '';
                    res.on('data', chunk => errData += chunk);
                    res.on('end', () => reject(new Error(`Google Public API HTTP ${res.statusCode}: ${errData}`)));
                    return;
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json && json[0] && json[0][0] && json[0][0][0]) {
                            const translated = json[0].map(x => x[0]).join('');
                            resolve(translated);
                        } else {
                            reject(new Error('非法的 Google 公共 API 响应结构'));
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
            req.end();
        }
    });
}


// 占位符与特殊语法保护
function protectText(text) {
    const placeholders = [];
    let counter = 0;

    // 1. 保护 GitLens 占位符如: ${author}, ${agoOrDate}, ${ • message|50?}
    text = text.replace(/\$\{[^}]+\}/g, (match) => {
        const id = `__PH_GL_${counter++}__`;
        placeholders.push({ id, original: match });
        return id;
    });

    // 2. 保护设置项引用如: #gitlens.defaultDateFormat#
    text = text.replace(/#[a-zA-Z0-9._-]+#/g, (match) => {
        const id = `__PH_SET_${counter++}__`;
        placeholders.push({ id, original: match });
        return id;
    });

    // 3. 保护 Markdown 链接的 URL 部分: (https://...)
    text = text.replace(/\((https?:\/\/[^)]+)\)/g, (match) => {
        const id = `__PH_URL_${counter++}__`;
        placeholders.push({ id, original: match });
        return id;
    });

    // 4. 保护 Markdown 代码反引号: `gitlens.toggleLineBlame`
    text = text.replace(/`[^`]+`/g, (match) => {
        const id = `__PH_CODE_${counter++}__`;
        placeholders.push({ id, original: match });
        return id;
    });

    return { text, placeholders };
}

// 还原占位符
function restoreText(text, placeholders) {
    for (let i = placeholders.length - 1; i >= 0; i--) {
        const { id, original } = placeholders[i];
        text = text.replace(id, original);
    }
    return text;
}

// 智能翻译函数
async function translateText(text, index, total, percent) {
    if (!text || typeof text !== 'string') return text;

    const trimmed = text.trim();
    if (trimmed === '') return text;

    // 1. 如果是纯数字、纯符号或极短字符，不翻译
    if (/^[0-9\s\-_.:,;+\/*%&!?@#^|\\<>()[\]{}'"`~=]+$/.test(trimmed)) {
        return text;
    }

    // 1.5. 如果是插件标题 (如 "GitLens" 或 "GitLens+")，默认不翻译
    if (trimmed.toLowerCase() === 'gitlens' || trimmed.toLowerCase() === 'gitlens+') {
        return text;
    }

    // 2. 检查缓存
    if (translationCache[text]) {
        const displayOrig = trimmed.length > 25 ? trimmed.substring(0, 25) + '...' : trimmed;
        console.log(`[进度] [${index}/${total}] (${percent}%) [缓存命中] "${displayOrig}"`);
        return translationCache[text];
    }

    // 4. 运行占位符保护
    const { text: protectedText, placeholders } = protectText(text);

    // 5. 如果保护后没有实质性的翻译文本（全是占位符或符号），直接返回
    if (protectedText.trim() === '' || /^(__PH_\w+__|\s|[0-9\-_.:,;])+$/.test(protectedText)) {
        return text;
    }

    // 6. 调用在线翻译，带重试和速率控制
    const displayProtected = protectedText.length > 25 ? protectedText.substring(0, 25) + '...' : protectedText;
    const engineName = translationEngine.startsWith('google') ? 'Google' : 'DeepL';
    console.log(`[进度] [${index}/${total}] (${percent}%) [${engineName} 翻译中...] "${displayProtected}"`);
    let translated = null;
    let retries = 3;
    while (retries > 0) {
        try {
            // 每次翻译请求只微小间隔 5 毫秒，极速释放网络带宽
            await sleep(5);
            if (translationEngine === 'google') {
                translated = await fetchGoogleTranslation(protectedText);
            } else {
                translated = await fetchDeepLTranslation(protectedText);
            }
            break;
        } catch (err) {
            retries--;
            console.log(`[进度] [${index}/${total}] (${percent}%) [${engineName} 失败重试] 剩余: ${retries}，原因: ${err.message}`);
            if (retries > 0) {
                await sleep(1000); // 失败后等 1 秒再试
            }
        }
    }

    if (translated) {
        // 还原占位符
        let restored = restoreText(translated, placeholders);
        // 保存缓存
        translationCache[text] = restored;
        // 即时同步写入磁盘缓存，防止中途退出丢失
        saveCache();
        const displayOrig = trimmed.length > 20 ? trimmed.substring(0, 20) + '...' : trimmed;
        const displayRestored = restored.length > 20 ? restored.substring(0, 20) + '...' : restored;
        console.log(`[进度] [${index}/${total}] (${percent}%) [${engineName} 成功] "${displayOrig}" => "${displayRestored}"`);
        return restored;
    } else {
        // 翻译失败则平滑降级，保留原文
        console.log(`[进度] [${index}/${total}] (${percent}%) [翻译失败] 保留原文`);
        return text;
    }
}

// 判断 package.json 中的 Key 是否需要汉化
function shouldTranslateKey(key, path) {
    if (['title', 'description', 'markdownDescription', 'displayName', 'placeholder', 'tooltip'].includes(key)) {
        // 排除某些特定插件元数据或非 UI 配置
        if (path.startsWith('.author') || path.startsWith('.publisher') || path.startsWith('.repository')) {
            return false;
        }
        return true;
    }
    // 汉化视图名称
    if (key === 'name' && (path.includes('contributes.views') || path.includes('viewsContainers'))) {
        return true;
    }
    return false;
}

// 判断 package.json 中的 Array Key 是否需要汉化
function shouldTranslateArrayKey(key, path) {
    return ['markdownEnumDescriptions', 'enumDescriptions'].includes(key);
}

// 用于存储待翻译任务的队列
const translationTasks = [];

// 预扫描 JSON，收集所有需要翻译的文本和对象位置
function collectTasks(obj, path = '') {
    if (obj === null || obj === undefined) return;

    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            if (typeof obj[i] === 'object' && obj[i] !== null) {
                collectTasks(obj[i], `${path}[${i}]`);
            }
        }
    } else if (typeof obj === 'object') {
        for (const key in obj) {
            if (!obj.hasOwnProperty(key)) continue;
            const val = obj[key];

            if (typeof val === 'string') {
                if (shouldTranslateKey(key, path)) {
                    translationTasks.push({
                        type: 'object',
                        parent: obj,
                        key: key,
                        text: val
                    });
                }
            } else if (Array.isArray(val)) {
                if (shouldTranslateArrayKey(key, path)) {
                    for (let i = 0; i < val.length; i++) {
                        if (typeof val[i] === 'string') {
                            translationTasks.push({
                                type: 'array',
                                parent: val,
                                index: i,
                                text: val[i]
                            });
                        } else if (typeof val[i] === 'object' && val[i] !== null) {
                            collectTasks(val[i], `${path}.${key}[${i}]`);
                        }
                    }
                } else {
                    collectTasks(val, `${path}.${key}`);
                }
            } else if (typeof val === 'object' && val !== null) {
                collectTasks(val, `${path}.${key}`);
            }
        }
    }
}

// 汉化 package.json 主函数
async function translatePackageJson() {
    const pkgPath = path.join(EXTENSION_DIR, 'package.json');
    const pkgBakPath = path.join(EXTENSION_DIR, 'package.json.bak');

    if (!fs.existsSync(pkgPath) && !fs.existsSync(pkgBakPath)) {
        console.error(`[ERROR] 找不到 package.json 文件，路径: ${pkgPath}`);
        return false;
    }

    // 备份文件
    if (!fs.existsSync(pkgBakPath)) {
        console.log(`[备份] 正在创建 package.json 的备份...`);
        fs.copyFileSync(pkgPath, pkgBakPath);
        console.log(`[备份] 已成功保存备份至: package.json.bak`);
    }

    console.log(`[汉化] 正在解析 package.json ...`);
    const content = fs.readFileSync(pkgBakPath, 'utf8');
    let pkgData;
    try {
        pkgData = JSON.parse(content);
    } catch (e) {
        console.error(`[ERROR] 解析 package.json 失败: ${e.message}`);
        return false;
    }

    console.log(`[扫瞄] 正在分析 package.json 结构任务...`);
    collectTasks(pkgData);
    const total = translationTasks.length;
    console.log(`[扫描] 扫描完成！共发现 ${total} 个待翻译文本项。开始逐步翻译...`);

    const startTime = Date.now();
    let completed = 0;

    for (const task of translationTasks) {
        completed++;
        const percent = ((completed / total) * 100).toFixed(1);
        const translated = await translateText(task.text, completed, total, percent);

        if (task.type === 'object') {
            task.parent[task.key] = translated;
        } else {
            task.parent[task.index] = translated;
        }
    }
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`[汉化] 翻译完成，正在回写至 package.json...`);
    fs.writeFileSync(pkgPath, JSON.stringify(pkgData, null, '\t'), 'utf8');
    console.log(`[汉化] package.json 汉化成功！共处理 ${total} 个项目，耗时: ${duration}s`);
    return true;
}

// 汉化静态网页视图 HTML 文件
function translateWebviewsHtml() {
    const webviewsDir = path.join(EXTENSION_DIR, 'dist', 'webviews');
    if (!fs.existsSync(webviewsDir)) {
        console.log(`[提示] 找不到 webviews 目录，跳过 HTML 汉化。`);
        return;
    }

    const htmlFiles = ['settings.html', 'welcome.html'];
    htmlFiles.forEach(file => {
        const filePath = path.join(webviewsDir, file);
        const fileBakPath = path.join(webviewsDir, `${file}.bak`);
        if (!fs.existsSync(filePath) && !fs.existsSync(fileBakPath)) return;

        // 备份
        if (!fs.existsSync(fileBakPath)) {
            console.log(`[备份] 正在备份 ${file}...`);
            fs.copyFileSync(filePath, fileBakPath);
        }

        console.log(`[汉化] 正在汉化网页视图: ${file}...`);
        let htmlContent = fs.readFileSync(fileBakPath, 'utf8');

        // 精准静态文本替换，保证 webview 页面的主要结构完全不变
        const replacements = [
            // settings.html 常见词汇
            { from: 'GitLens Settings', to: 'GitLens 设置' },
            { from: 'GitLens — Settings', to: 'GitLens — 设置' },
            { from: 'settings and configure', to: '设置与配置' },
            { from: 'Settings', to: '设置' },
            { from: 'Commit Graph', to: '提交图表 (Graph)' },
            { from: 'Inline Blame', to: '单行作者追溯 (Inline Blame)' },
            { from: 'File History', to: '文件历史' },
            { from: 'Line History', to: '行历史' },
            { from: 'Compare References', to: '比较引用' },

            // welcome.html 常见词汇
            { from: 'Welcome to GitLens', to: '欢迎使用 GitLens' },
            { from: 'Supercharge Git', to: '强力释放 Git 潜能' },
            { from: 'Get Started', to: '开始使用' },
            { from: 'Next', to: '下一步' },
            { from: 'Back', to: '上一步' },
            { from: 'Done', to: '完成' }
        ];

        replacements.forEach(rep => {
            // 简单正则，支持全局替换
            const regex = new RegExp(rep.from, 'g');
            htmlContent = htmlContent.replace(regex, rep.to);
        });

        fs.writeFileSync(filePath, htmlContent, 'utf8');
        console.log(`[汉化] ${file} 汉化成功！`);
    });
}

// 汉化核心 JS 代码 (实现编辑器内 Inline Blame 和 CodeLens 汉化)
function translateGitlensJs() {
    const jsPath = path.join(EXTENSION_DIR, 'dist', 'gitlens.js');
    const jsBakPath = path.join(EXTENSION_DIR, 'dist', 'gitlens.js.bak');

    if (!fs.existsSync(jsPath) && !fs.existsSync(jsBakPath)) {
        console.log(`[提示] 找不到 gitlens.js，跳过编辑器汉化。`);
        return false;
    }

    // 1. 备份
    if (!fs.existsSync(jsBakPath)) {
        console.log(`[备份] 正在创建 gitlens.js 的备份...`);
        fs.copyFileSync(jsPath, jsBakPath);
        console.log(`[备份] 已成功保存备份至: gitlens.js.bak`);
    }

    console.log(`[汉化] 正在对 gitlens.js 进行深度编辑器汉化...`);
    let jsContent = fs.readFileSync(jsBakPath, 'utf8');

    // A. 拦截并汉化 fromNow 相对时间计算
    const fromNowTarget = 'fromNow(e){return(0,r.PI)(this.date,e)}';
    const fromNowRepl = 'fromNow(e){return((t)=>{if(!t)return t;let r=t;r=r.replace(/a few seconds ago/i,"几秒前").replace(/just now/i,"刚刚").replace(/a minute ago/i,"1分钟前").replace(/an hour ago/i,"1小时前").replace(/a day ago/i,"1天前").replace(/a month ago/i,"1个月前").replace(/a year ago/i,"1年前").replace(/(\\d+) minutes ago/i,"$1分钟前").replace(/(\\d+) hours ago/i,"$1小时前").replace(/(\\d+) days ago/i,"$1天前").replace(/(\\d+) months ago/i,"$1个月前").replace(/(\\d+) years ago/i,"$1年前");return r})((0,r.PI)(this.date,e))}';
    jsContent = jsContent.replace(fromNowTarget, fromNowRepl);

    // B. 替换所有的 this.formatAuthor("You", 变为 "你"
    jsContent = jsContent.replace(/this\.formatAuthor\("You",/g, 'this.formatAuthor("你",');

    // C. 替换 nameAndYou 中的 You 逻辑 (支持 `${e} (你)` 格式)
    const nameAndYouTarget = 'case"nameAndYou":if("You"===e||e.endsWith(" (you)"))return e;return e?`${e} (you)`:"You";default:return"You"}';
    const nameAndYouReplFixed = 'case"nameAndYou":if("定"===e||e.endsWith(" (你)"))return e;return e?`${e} (你)`:"你";default:return"你"}';
    // 注意更正检测和恢复
    const nameAndYouReplActual = 'case"nameAndYou":if("你"===e||e.endsWith(" (你)"))return e;return e?`${e} (你)`:"你";default:return"你"}';
    jsContent = jsContent.replace(nameAndYouTarget, nameAndYouReplActual);

    fs.writeFileSync(jsPath, jsContent, 'utf8');
    console.log(`[汉化] gitlens.js 深度编辑器汉化成功！`);
    return true;
}

// 汉化单个 Webview JS 文件
function translateSingleWebviewJs(filePath) {
    const fileBakPath = filePath + '.bak';
    if (!fs.existsSync(fileBakPath)) {
        console.log(`[备份] 正在创建 ${path.basename(filePath)} 的备份...`);
        fs.copyFileSync(filePath, fileBakPath);
        console.log(`[备份] 已成功保存备份至: ${path.basename(fileBakPath)}`);
    }

    let jsContent = fs.readFileSync(fileBakPath, 'utf8');

    // 1. Working Changes 相关的本地化字典与文字
    jsContent = jsContent.replace(/"Graph-WorkInProgress-Changes"\s*:\s*"Working Changes"/g, '"Graph-WorkInProgress-Changes":"工作中的更改"');
    jsContent = jsContent.replace(/"Graph-WorkInProgress-Clean"\s*:\s*"Working Tree"/g, '"Graph-WorkInProgress-Clean":"干净的工作区"');
    jsContent = jsContent.replace(/"Graph-WorkInProgress"\s*:\s*"Work in progress"/g, '"Graph-WorkInProgress":"未提交的改动"');
    jsContent = jsContent.replace(/"Graph-IsLoadingRows"\s*:\s*"Loading\.\.\."/g, '"Graph-IsLoadingRows":"正在加载..."');
    jsContent = jsContent.replace(/"Graph-NoCommits"\s*:\s*"No commits"/g, '"Graph-NoCommits":"没有提交记录"');
    jsContent = jsContent.replace(/"No working changes"/g, '"没有工作中的更改"');
    jsContent = jsContent.replace(/"No changes"/g, '"无更改"');

    // 2. 表头翻译
    jsContent = jsContent.replace(/"GraphHeader-BranchTag"\s*:\s*"BRANCH \/ TAG"/g, '"GraphHeader-BranchTag":"分支 \/ 标签"');
    jsContent = jsContent.replace(/"GraphHeader-Changes"\s*:\s*"CHANGES"/g, '"GraphHeader-Changes":"更改"');
    jsContent = jsContent.replace(/"GraphHeader-CommitAuthor"\s*:\s*"AUTHOR"/g, '"GraphHeader-CommitAuthor":"作者"');
    jsContent = jsContent.replace(/"GraphHeader-CommitDateTime"\s*:\s*"COMMIT DATE \/ TIME"/g, '"GraphHeader-CommitDateTime":"提交时间"');
    jsContent = jsContent.replace(/"GraphHeader-CommitGraph"\s*:\s*"GRAPH"/g, '"GraphHeader-CommitGraph":"图表"');
    jsContent = jsContent.replace(/"GraphHeader-CommitMessage"\s*:\s*"COMMIT MESSAGE"/g, '"GraphHeader-CommitMessage":"提交信息"');
    jsContent = jsContent.replace(/"GraphHeader-CommitSha"\s*:\s*"SHA"/g, '"GraphHeader-CommitSha":"哈希"');
    jsContent = jsContent.replace(/"GraphHeader-EditColumns"\s*:\s*"Columns settings"/g, '"GraphHeader-EditColumns":"列设置"');
    jsContent = jsContent.replace(/"GraphHeader-Filter"\s*:\s*"Filter"/g, '"GraphHeader-Filter":"过滤"');
    jsContent = jsContent.replace(/"GraphHeader-HiddenRefs-btn"\s*:\s*"Hidden Branches \/ Tags"/g, '"GraphHeader-HiddenRefs-btn":"隐藏的分支/标签"');

    // 3. 各种按钮与菜单项 (重点是三大 Tab: Compose, Review, Compare)
    jsContent = jsContent.replace(/(label|tooltip)="Compose"/g, '$1="撰写"');
    jsContent = jsContent.replace(/(label|tooltip)="Review"/g, '$1="评审"');
    jsContent = jsContent.replace(/(label|tooltip)="Compare"/g, '$1="对比"');
    jsContent = jsContent.replace(/(label|tooltip)="Stash"/g, '$1="储藏"');

    jsContent = jsContent.replace(/(>|\s)Compose(<\/|\s)/g, '$1撰写$2');
    jsContent = jsContent.replace(/(>|\s)Review(<\/|\s)/g, '$1评审$2');
    jsContent = jsContent.replace(/(>|\s)Compare(<\/|\s)/g, '$1对比$2');
    jsContent = jsContent.replace(/(>|\s)Stash(<\/|\s)/g, '$1储藏$2');

    // 4. 控制面板元素（如 "FILES CHANGED", "0 of 7 STAGED"）
    jsContent = jsContent.replace(/"Files changed"/g, '"修改的文件"');
    jsContent = jsContent.replace(/"Files Changed"/g, '"修改的文件"');
    jsContent = jsContent.replace(/>Files Changed \(\$\{e\}\)</g, '>修改的文件 (${e})<');
    jsContent = jsContent.replace(/>Files changed \(\$\{e\}\)</g, '>修改的文件 (${e})<');
    jsContent = jsContent.replace(/>Files changed \(\$\{t\}\)</g, '>修改的文件 (${t})<');
    jsContent = jsContent.replace(/header="Files changed"/g, 'header="修改的文件"');

    // 汉化 staged / unstaged
    jsContent = jsContent.replace(/\$\{o\}\s*staged\s*\\xb7\s*\$\{r\}\s*unstaged/g, '${o} 已暂存 \\xb7 ${r} 未暂存');
    jsContent = jsContent.replace(/\bof\s*(\$\{[^}]+\})\s*Staged\b/gi, '共 $1 个暂存');
    jsContent = jsContent.replace(/\b(\$\{[^}]+\})\s*of\s*(\$\{[^}]+\})\s*Staged\b/gi, '已暂存 $1 / $2');
    jsContent = jsContent.replace(/\+\s*" of "\s*\+\s*([\w\.]+)\s*\+\s*"\s*Staged"/gi, ' + " / " + $1 + " 已暂存"');
    jsContent = jsContent.replace(/\b(\w+)\s*\+\s*" of "\s*\+\s*(\w+)\s*\+\s*"\s*Staged"/gi, '"已暂存 " + $1 + " / " + $2');
    jsContent = jsContent.replace(/\$\{([\w\.]+)\}\s+of\s+\$\{([\w\.]+)\}\s+Staged/gi, '已暂存 $1 / $2');
    jsContent = jsContent.replace(/\$\{([\w\.]+)\}\s+of\s+\$\{([\w\.]+)\}\s+staged/gi, '已暂存 $1 / $2');

    // 5. 常用输入框与文本
    jsContent = jsContent.replace(/Amend Previous Commit/g, '修补上一次提交');
    jsContent = jsContent.replace(/Commit message \(\$\{i\}Enter to commit\)/g, '提交信息 (按 ${i}Enter 提交)');
    jsContent = jsContent.replace(/Enter a commit message to \$\{i\}\s+\$\{o\}/g, '输入提交信息以 ${i} ${o}');
    jsContent = jsContent.replace(/Stage changes above to \$\{i\}\s+\$\{o\}/g, '先暂存上方更改以 ${i} ${o}');
    jsContent = jsContent.replace(/Associate Issue(…|\.\.\.)/g, '关联问题...');
    jsContent = jsContent.replace(/Filter files(…|\.\.\.)/g, '过滤文件...');
    jsContent = jsContent.replace(/Add Co-authors(…|\.\.\.)/g, '添加共同作者...');
    jsContent = jsContent.replace(/Committing…/g, '正在提交...');
    jsContent = jsContent.replace(/"Generate Commit Message"/g, '"生成提交信息"');
    jsContent = jsContent.replace(/tooltip=\$\{this\.generating\?"Cancel":"生成提交信息"\}/g, 'tooltip=${this.generating?"取消":"生成提交信息"}');
    jsContent = jsContent.replace(/this\.amend\s*\?\s*"Amend Commit on"\s*:\s*"Commit to"/g, 'this.amend?"修补提交于":"提交到"');
    jsContent = jsContent.replace(/this\.amend\s*\?\s*"amend commit on"\s*:\s*"commit to"/g, 'this.amend?"修补提交于":"提交到"');

    // 6. 其他常用词
    jsContent = jsContent.replace(/"Working Changes"/g, '"工作中的更改"');

    fs.writeFileSync(filePath, jsContent, 'utf8');
    console.log(`[汉化] Webview JS ${path.basename(filePath)} 汉化成功！`);
}

// 汉化所有 Webview JS 文件
function translateWebviewsJs() {
    const webviewsDir = path.join(EXTENSION_DIR, 'dist', 'webviews');
    if (!fs.existsSync(webviewsDir)) {
        console.log(`[提示] 找不到 webviews 目录，跳过 Webview JS 汉化。`);
        return;
    }

    const files = fs.readdirSync(webviewsDir);
    let count = 0;
    files.forEach(file => {
        const filePath = path.join(webviewsDir, file);
        // 只汉化 .js 文件且排除备份文件自身
        if (file.endsWith('.js') && !file.endsWith('.js.bak') && fs.statSync(filePath).isFile()) {
            translateSingleWebviewJs(filePath);
            count++;
        }
    });
    console.log(`[汉化] 成功处理了 ${count} 个 Webview JS 文件！`);
}

// 还原备份文件
function restoreBackup() {
    console.log(`[还原] 正在恢复 GitLens 备份文件...`);

    // 还原 package.json
    const pkgPath = path.join(EXTENSION_DIR, 'package.json');
    const pkgBakPath = path.join(EXTENSION_DIR, 'package.json.bak');
    let pkgRestored = false;
    if (fs.existsSync(pkgBakPath)) {
        fs.copyFileSync(pkgBakPath, pkgPath);
        fs.unlinkSync(pkgBakPath);
        console.log(`[还原] package.json 已恢复。`);
        pkgRestored = true;
    } else {
        console.log(`[提示] 未找到 package.json 备份文件。`);
    }

    // 还原 HTML 视图
    const webviewsDir = path.join(EXTENSION_DIR, 'dist', 'webviews');
    let webviewsRestored = false;
    if (fs.existsSync(webviewsDir)) {
        const htmlFiles = ['settings.html', 'welcome.html'];
        htmlFiles.forEach(file => {
            const filePath = path.join(webviewsDir, file);
            const fileBakPath = path.join(webviewsDir, `${file}.bak`);
            if (fs.existsSync(fileBakPath)) {
                fs.copyFileSync(fileBakPath, filePath);
                fs.unlinkSync(fileBakPath);
                console.log(`[还原] ${file} 已恢复。`);
                webviewsRestored = true;
            }
        });
    }

    // 还原 gitlens.js
    const jsPath = path.join(EXTENSION_DIR, 'dist', 'gitlens.js');
    const jsBakPath = path.join(EXTENSION_DIR, 'dist', 'gitlens.js.bak');
    let jsRestored = false;
    if (fs.existsSync(jsBakPath)) {
        fs.copyFileSync(jsBakPath, jsPath);
        fs.unlinkSync(jsBakPath);
        console.log(`[还原] gitlens.js 已恢复。`);
        jsRestored = true;
    }

    // 还原 Webviews JS
    let webviewsJsRestored = false;
    if (fs.existsSync(webviewsDir)) {
        const files = fs.readdirSync(webviewsDir);
        files.forEach(file => {
            if (file.endsWith('.js.bak')) {
                const bakPath = path.join(webviewsDir, file);
                const origPath = path.join(webviewsDir, file.slice(0, -4));
                fs.copyFileSync(bakPath, origPath);
                fs.unlinkSync(bakPath);
                console.log(`[还原] Webview JS: ${file.slice(0, -4)} 已恢复。`);
                webviewsJsRestored = true;
            }
        });
    }

    if (pkgRestored || webviewsRestored || jsRestored || webviewsJsRestored) {
        console.log(`[还原] GitLens 备份已完全恢复！重启 VSCode 即可恢复原始英文界面。`);
    } else {
        console.log(`[还原] 未检测到任何已备份的文件，无需还原。`);
    }
}

// 运行入口
async function main() {
    const args = process.argv.slice(2);
    if (args.includes('--restore')) {
        restoreBackup();
        return;
    }

    const isEn = displayLanguage === 'en';

    console.log(`==========================================`);
    if (isEn) {
        console.log(`  GitLens Auto-Translation Tool (v18.2.0)  `);
        console.log(`  Target Language: ${targetLanguage.toUpperCase()}`);
        console.log(`  Translation Engine: ${translationEngine}`);
    } else {
        console.log(`  GitLens 自动翻译汉化工具 (v18.2.0)  `);
        console.log(`  目标翻译语言: ${targetLanguage.toUpperCase()}`);
        console.log(`  所选翻译引擎: ${translationEngine}`);
    }
    console.log(`==========================================`);

    // 启动时自动载入持久化缓存文件
    loadCache();

    try {
        const pkgSuccess = await translatePackageJson();
        if (pkgSuccess) {
            translateWebviewsHtml();
            translateGitlensJs();
            translateWebviewsJs();
            if (isEn) {
                console.log(`\n[Done] GitLens plugin translated successfully! Please reload/restart VSCode.`);
                console.log(`[Hint] To restore to original English: node translate_gitlens.js --restore`);
            } else {
                console.log(`\n[完成] GitLens 插件翻译汉化成功！请重启/重载 VSCode 体验。`);
                console.log(`[提示] 如需还原，请在当前目录运行: node translate_gitlens.js --restore`);
            }
        }
    } catch (e) {
        if (isEn) {
            console.error(`[ERROR] Fatal error occurred during translation: ${e.message}`);
        } else {
            console.error(`[ERROR] 翻译/汉化过程中发生致命异常: ${e.message}`);
        }
    }
    console.log(`==========================================`);
}

main();
