/**
 * Generate PWA Icons from Logo
 * 
 * This script generates the required PWA icons from the existing logo.
 * Requires sharp package: npm install sharp
 */

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

const LOGO_PATH = path.join(process.cwd(), 'public/icons/Nem-insurance-Logo.jpg');
const ICONS_DIR = path.join(process.cwd(), 'public/icons');

const ICON_SIZES = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 1024, name: 'icon-1024.png' },
  { size: 2048, name: 'icon-2048.png' },
];

async function generateIcons() {
  try {
    console.log('🎨 Generating PWA icons from logo...\n');

    // Check if logo exists
    try {
      await fs.access(LOGO_PATH);
    } catch {
      console.error(`❌ Logo not found at: ${LOGO_PATH}`);
      console.log('\nPlease ensure the logo file exists at public/icons/Nem-insurance-Logo.jpg');
      process.exit(1);
    }

    // Load the logo
    const logoBuffer = await fs.readFile(LOGO_PATH);

    // Generate each icon size
    for (const { size, name } of ICON_SIZES) {
      const outputPath = path.join(ICONS_DIR, name);
      
      console.log(`📐 Generating ${name} (${size}x${size})...`);
      
      await sharp(logoBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 128, g: 0, b: 32, alpha: 1 }, // Burgundy background
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Created: ${outputPath}`);
    }

    console.log('\n✨ All PWA icons generated successfully!');
    console.log('\nGenerated icons:');
    ICON_SIZES.forEach(({ name, size }) => {
      console.log(`  - ${name} (${size}x${size})`);
    });

  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

// Run the script
generateIcons();
