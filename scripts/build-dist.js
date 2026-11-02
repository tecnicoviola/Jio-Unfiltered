const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

console.log(`[Jio Unfiltered] Building clean distribution at: ${distDir}`);

// 1. Clean and recreate dist
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// 2. Validate & Copy manifest.json
const manifestPath = path.join(rootDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  throw new Error(`CRITICAL: manifest.json missing at ${manifestPath}`);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Verify content script files exist
const contentScriptConfig = manifest.content_scripts && manifest.content_scripts[0];
if (contentScriptConfig) {
  if (Array.isArray(contentScriptConfig.js)) {
    for (const scriptPath of contentScriptConfig.js) {
      const fullPath = path.join(rootDir, scriptPath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`CRITICAL BUILD ERROR: Referenced script does not exist: ${scriptPath}`);
      }
    }
  }
  if (Array.isArray(contentScriptConfig.css)) {
    for (const stylePath of contentScriptConfig.css) {
      const fullPath = path.join(rootDir, stylePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`CRITICAL BUILD ERROR: Referenced stylesheet does not exist: ${stylePath}`);
      }
    }
  }
}

// Verify icons exist
if (manifest.icons) {
  for (const [size, iconRel] of Object.entries(manifest.icons)) {
    const iconPath = path.join(rootDir, iconRel);
    if (!fs.existsSync(iconPath)) {
      throw new Error(`CRITICAL BUILD ERROR: Referenced icon ${size} does not exist: ${iconRel}`);
    }
  }
}

fs.copyFileSync(manifestPath, path.join(distDir, 'manifest.json'));
console.log('  ✓ Verified and copied manifest.json');

// 3. Copy icons
copyRecursive(path.join(rootDir, 'icons'), path.join(distDir, 'icons'));
console.log('  ✓ Copied extension icons');

// 4. Copy canonical src
copyRecursive(path.join(rootDir, 'src'), path.join(distDir, 'src'));
console.log('  ✓ Copied canonical src/ tree');

// 5. Generate self-contained distribution README
const distReadme = `# Jio Unfiltered — Production Extension Package
*See the value. Skip the hype.*

This folder (\`dist/\`) is the self-contained, reproducible Chrome Extension package.

## Quick Installation in Google Chrome
1. Open Google Chrome.
2. Navigate to: \`chrome://extensions/\`
3. Enable **Developer mode** toggle in the top-right corner.
4. Click **Load unpacked** button in the top-left toolbar.
5. Select this exact \`dist\` folder.
6. Open the official Jio Prepaid Plans catalogue:
   https://www.jio.com/selfcare/plans/mobility/prepaid-plans-list/

The extension will immediately declutter promotional banners, inject "Top Recommendations" and "Best for My Needs" into the category sidebar, and overlay Value & Transparency scores onto plan cards.
`;

fs.writeFileSync(path.join(distDir, 'README.md'), distReadme);
console.log('  ✓ Generated dist/README.md');

console.log('[Jio Unfiltered] Distribution build completed successfully.');
