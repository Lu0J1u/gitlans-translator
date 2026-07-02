// scripts/launch_translation.js
// Interactive CLI for GitLens translation using ES Modules
import { spawn } from 'child_process';
import readline from 'readline';
import process from 'process';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

(async () => {
  console.log('=== GitLens L10N Translation Launcher ===');
  console.log('0. 选择显示语言 / Select Display Language:');
  console.log('  1) 中文 (Chinese) [default]');
  console.log('  2) English');
  const langChoice = await ask('Select (1/2): ');
  const isEn = langChoice === '2';

  let promptTarget, promptEngine, engineTitle, engineOpt1, engineOpt2, engineOpt3, startMsg;

  if (isEn) {
    promptTarget = 'Enter the target language code for translation (e.g. zh, ja, fr) [zh]: ';
    promptEngine = 'Select translation engine (1/2/3) [1]: ';
    engineTitle = 'Available Translation Engines:';
    engineOpt1 = '  1) deepl-free   (Uses free DeepL API)';
    engineOpt2 = '  2) deepl-paid   (Requires DEEPL_API_KEY environment variable)';
    engineOpt3 = '  3) google       (Uses Google Translate API)';
    startMsg = 'Starting translation...';
  } else {
    promptTarget = '输入需要翻译的目标语言代码 (例如 zh, ja, fr) [zh]: ';
    promptEngine = '选择翻译引擎 (1/2/3) [1]: ';
    engineTitle = '可用翻译引擎:';
    engineOpt1 = '  1) deepl-free   (使用免费 DeepL 接口)';
    engineOpt2 = '  2) deepl-paid   (需要配置 DEEPL_API_KEY 环境变量)';
    engineOpt3 = '  3) google       (使用谷歌翻译接口)';
    startMsg = '正在启动翻译程序...';
  }

  const targetLang = (await ask(promptTarget)) || 'zh';

  console.log('\n' + engineTitle);
  console.log(engineOpt1);
  console.log(engineOpt2);
  console.log(engineOpt3);
  const engineChoice = (await ask(promptEngine)) || '1';

  let engine = 'deepl-free';
  if (engineChoice === '2') engine = 'deepl-paid';
  else if (engineChoice === '3') engine = 'google';

  rl.close();

  console.log(`\n${startMsg}\n`);

  const args = [
    'translate_gitlens.js',
    `--display=${isEn ? 'en' : 'zh'}`,
    `--target=${targetLang}`,
    `--engine=${engine}`
  ];

  const proc = spawn('node', args, { stdio: 'inherit' });
  proc.on('close', code => {
    if (isEn) {
      console.log(`Translation process finished with exit code ${code}`);
    } else {
      console.log(`翻译脚本结束，退出码 ${code}`);
    }
  });
})();
