import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');

const sourceIcon = join(publicDir, 'icon.png');

const sizes = [
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-192.png', size: 192 },
  { name: 'apple-icon.png', size: 180 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-16.png', size: 16 },
];

async function generateIcons() {
  console.log('🎨 Generating icons from icon.png...\n');
  
  for (const { name, size } of sizes) {
    await sharp(sourceIcon)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(join(publicDir, name));
    console.log(`✅ ${name} (${size}x${size})`);
  }
  
  // Generate ICO file (use 32px version)
  await sharp(sourceIcon)
    .resize(32, 32, { fit: 'cover' })
    .toFile(join(publicDir, 'favicon.ico'));
  console.log('✅ favicon.ico (32x32)');
  
  console.log('\n🎉 All icons generated!');
}

generateIcons().catch(console.error);
