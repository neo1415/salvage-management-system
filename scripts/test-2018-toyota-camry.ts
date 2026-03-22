import 'dotenv/config';
import { getMarketPrice } from '../src/features/market-data/services/market-data.service';

async function test2018ToyotaCamry() {
  console.log('🚗 Testing 2018 Toyota Camry Market Data\n');
  console.log('Expected Range: ₦8,000,000 - ₦15,000,000');
  console.log('Testing year filtering with recent vehicle\n');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    console.log('📊 Fetching market price...');
    const vehicle = {
      type: 'vehicle' as const,
      make: 'Toyota',
      model: 'Camry',
      year: 2018,
    };
    console.log('Vehicle:', vehicle);

    const result = await getMarketPrice(vehicle);

    console.log('\n✅ SUCCESS! Market price retrieved:\n');
    console.log('📈 Price Range:');
    console.log(`   Low:  ₦${result.priceRange.low.toLocaleString()}`);
    console.log(`   Mid:  ₦${result.priceRange.mid.toLocaleString()}`);
    console.log(`   High: ₦${result.priceRange.high.toLocaleString()}`);
    
    console.log('\n📊 Data Quality:');
    console.log(`   Confidence: ${result.confidence}`);
    console.log(`   Sample Size: ${result.sampleSize} listings`);
    console.log(`   Year-Matched: ${result.yearMatched} listings`);
    console.log(`   Sources: ${result.sources.join(', ')}`);
    
    console.log('\n🔍 Year Filtering Verification:');
    console.log(`   Target Year: ${vehicle.year}`);
    console.log(`   Year-Matched Listings: ${result.yearMatched}`);
    console.log(`   Total Listings: ${result.sampleSize}`);
    console.log(`   Year Match Rate: ${((result.yearMatched / result.sampleSize) * 100).toFixed(1)}%`);
    
    if (result.priceRange.mid > 20000000) {
      console.log('\n⚠️  WARNING: Price seems high for 2018 Camry');
      console.log('   Expected: ₦8M - ₦15M');
      console.log(`   Got: ₦${result.priceRange.mid.toLocaleString()}`);
    } else {
      console.log('\n✅ Price is within expected range!');
    }

    console.log('\n📝 Metadata:');
    console.log(`   Last Updated: ${result.lastUpdated}`);
    console.log(`   Cache Hit: ${result.cacheHit ? 'Yes' : 'No'}`);

  } catch (error: any) {
    console.log('\n❌ Test failed:', error.message);
    console.log('Error message:', error.message);
    console.log('Stack trace:', error.stack);
  }
}

test2018ToyotaCamry();
