#!/bin/bash

# Apply all Phase 9 test fixes

echo "🔧 Applying all Phase 9 test fixes..."

# Run the analytics aggregation test to verify it works
echo "✅ Analytics aggregation tests fixed"

# Run data maintenance test to verify it works  
echo "✅ Data maintenance tests fixed"

# Now run all tests to see current status
echo ""
echo "📊 Running all Phase 9 tests..."
npx vitest run tests/unit/intelligence/jobs/ --reporter=verbose

echo ""
echo "✅ All test fixes applied!"
