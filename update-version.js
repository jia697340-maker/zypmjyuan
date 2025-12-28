// 自动更新 Service Worker 版本号
const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, 'sw.js');
let swContent = fs.readFileSync(swPath, 'utf8');

// 提取当前版本号
const versionMatch = swContent.match(/const CACHE_VERSION = '(\d+)'/);
if (versionMatch) {
    const currentVersion = parseInt(versionMatch[1]);
    const newVersion = currentVersion + 1;
    
    // 替换版本号
    swContent = swContent.replace(
        /const CACHE_VERSION = '\d+'/,
        `const CACHE_VERSION = '${newVersion}'`
    );
    
    fs.writeFileSync(swPath, swContent, 'utf8');
    console.log(`✅ Service Worker 版本已更新: v${currentVersion} → v${newVersion}`);
} else {
    console.error('❌ 未找到版本号');
}
