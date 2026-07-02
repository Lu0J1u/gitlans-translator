// scripts/clear_cache.js
// Simple utility to delete persistent translation caches by language
import fs from 'fs';
import path from 'path';
import process from 'process';

const cacheDir = path.join(process.cwd(), 'caches');
if (fs.existsSync(cacheDir)) {
  const files = fs.readdirSync(cacheDir);
  let deletedCount = 0;

  files.forEach(file => {
    if (file.startsWith('translate_cache') && file.endsWith('.json')) {
      fs.unlinkSync(path.join(cacheDir, file));
      console.log(`[清除缓存] 已删除 caches/${file}`);
      deletedCount++;
    }
  });

  try {
    if (fs.readdirSync(cacheDir).length === 0) {
      fs.rmdirSync(cacheDir);
    }
  } catch (e) {
    // Ignore
  }

  if (deletedCount === 0) {
    console.log('[清除缓存] 缓存文件夹内未检测到任何缓存文件。');
  }
} else {
  console.log('[清除缓存] 未检测到 caches 缓存文件夹。');
}
