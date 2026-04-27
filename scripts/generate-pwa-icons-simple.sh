#!/bin/bash

# Generate PWA Icons from Logo
# This script uses ImageMagick to generate PWA icons
# Install ImageMagick: sudo apt-get install imagemagick (Linux) or brew install imagemagick (Mac)

LOGO="public/icons/Nem-insurance-Logo.jpg"
OUTPUT_DIR="public/icons"

echo "🎨 Generating PWA icons from logo..."
echo ""

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick not found!"
    echo ""
    echo "Please install ImageMagick:"
    echo "  - Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  - macOS: brew install imagemagick"
    echo "  - Windows: Download from https://imagemagick.org/script/download.php"
    exit 1
fi

# Check if logo exists
if [ ! -f "$LOGO" ]; then
    echo "❌ Logo not found at: $LOGO"
    echo ""
    echo "Please ensure the logo file exists at public/icons/Nem-insurance-Logo.jpg"
    exit 1
fi

# Generate icons
echo "📐 Generating icon-192.png (192x192)..."
convert "$LOGO" -resize 192x192 -background "#800020" -gravity center -extent 192x192 "$OUTPUT_DIR/icon-192.png"
echo "✅ Created: $OUTPUT_DIR/icon-192.png"

echo "📐 Generating icon-512.png (512x512)..."
convert "$LOGO" -resize 512x512 -background "#800020" -gravity center -extent 512x512 "$OUTPUT_DIR/icon-512.png"
echo "✅ Created: $OUTPUT_DIR/icon-512.png"

echo "📐 Generating icon-1024.png (1024x1024)..."
convert "$LOGO" -resize 1024x1024 -background "#800020" -gravity center -extent 1024x1024 "$OUTPUT_DIR/icon-1024.png"
echo "✅ Created: $OUTPUT_DIR/icon-1024.png"

echo "📐 Generating icon-2048.png (2048x2048)..."
convert "$LOGO" -resize 2048x2048 -background "#800020" -gravity center -extent 2048x2048 "$OUTPUT_DIR/icon-2048.png"
echo "✅ Created: $OUTPUT_DIR/icon-2048.png"

echo ""
echo "✨ All PWA icons generated successfully!"
echo ""
echo "Generated icons:"
echo "  - icon-192.png (192x192)"
echo "  - icon-512.png (512x512)"
echo "  - icon-1024.png (1024x1024)"
echo "  - icon-2048.png (2048x2048)"
