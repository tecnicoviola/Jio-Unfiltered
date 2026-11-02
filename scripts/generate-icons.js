const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const rootDir = path.resolve(__dirname, '..');
const svgPath = path.join(rootDir, 'icons', 'jio-unfiltered.svg');
const iconsDir = path.join(rootDir, 'icons');

async function generateIcons() {
  console.log(`Generating extension PNG icons from: ${svgPath}`);

  if (!fs.existsSync(svgPath)) {
    throw new Error(`SVG source not found at: ${svgPath}`);
  }

  const svgBuffer = fs.readFileSync(svgPath);

  const sizes = [16, 48, 128];

  for (const size of sizes) {
    const destPath = path.join(iconsDir, `icon${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png({ compressionLevel: 9, quality: 100 })
      .toFile(destPath);

    const stats = fs.statSync(destPath);
    console.log(`  ✓ Generated icon${size}.png (${stats.size} bytes)`);
  }

  console.log('Icon generation completed successfully.');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
