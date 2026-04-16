#!/bin/bash

# Fix All Auction Issues - One Command
# This script runs all fixes in the correct order

echo "🚀 Starting auction issues fix..."
echo ""

# Step 1: Run unique constraint migration
echo "📊 Step 1: Applying unique constraint migration..."
npx tsx scripts/run-unique-constraint-migration.ts
if [ $? -ne 0 ]; then
  echo "❌ Migration failed. Exiting."
  exit 1
fi
echo "✅ Migration complete"
echo ""

# Step 2: Clean up duplicate documents
echo "🧹 Step 2: Cleaning up duplicate documents..."
npx tsx scripts/cleanup-duplicate-documents.ts
if [ $? -ne 0 ]; then
  echo "❌ Cleanup failed. Exiting."
  exit 1
fi
echo "✅ Cleanup complete"
echo ""

# Step 3: Populate intelligence data
echo "📈 Step 3: Populating intelligence data..."
npx tsx scripts/populate-intelligence-data.ts
if [ $? -ne 0 ]; then
  echo "❌ Population failed. Exiting."
  exit 1
fi
echo "✅ Population complete"
echo ""

echo "🎉 All fixes applied successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Restart dev server: npm run dev"
echo "   2. Test prediction display on auction pages"
echo "   3. Test intelligence dashboards show data"
echo "   4. Monitor for any errors"
echo ""
echo "✅ Done!"
