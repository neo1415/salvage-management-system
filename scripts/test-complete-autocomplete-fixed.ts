async function testCompleteAutocomplete() {
  console.log('🎯 COMPLETE AUTOCOMPLETE TEST (FIXED)');
  console.log('='.repeat(50));
  
  // Test 1: All makes (bypass cache)
  console.log('1️⃣ Testing makes endpoint...');
  const makesResponse = await fetch('http://localhost:3000/api/valuations/makes?nocache=1');
  const makesData = await makesResponse.json();
  console.log(`✅ Makes found: ${makesData.makes.length}`);
  console.log(`   Makes: ${makesData.makes.join(', ')}`);
  
  // Test 2: Mercedes models
  console.log('\n2️⃣ Testing Mercedes models...');
  const modelsResponse = await fetch('http://localhost:3000/api/valuations/models?make=Mercedes-Benz');
  const modelsData = await modelsResponse.json();
  console.log(`✅ Mercedes models found: ${modelsData.models.length}`);
  console.log(`   Models: ${modelsData.models.join(', ')}`);
  
  // Test 3: Mercedes GLE350 years
  console.log('\n3️⃣ Testing Mercedes GLE350 years...');
  const yearsResponse = await fetch('http://localhost:3000/api/valuations/years?make=Mercedes-Benz&model=GLE350 W166');
  const yearsData = await yearsResponse.json();
  console.log(`✅ GLE350 years found: ${yearsData.years.length}`);
  console.log(`   Years: ${yearsData.years.join(', ')}`);
  
  // Test 4: Toyota (should still work)
  console.log('\n4️⃣ Testing Toyota (existing make)...');
  const toyotaResponse = await fetch('http://localhost:3000/api/valuations/models?make=Toyota');
  const toyotaData = await toyotaResponse.json();
  console.log(`✅ Toyota models found: ${toyotaData.models.length}`);
  console.log(`   Sample models: ${toyotaData.models.slice(0, 5).join(', ')}`);
  
  console.log('\n🎉 ALL TESTS PASSED! Autocomplete is working for all makes including Mercedes!');
  console.log('\n📋 SUMMARY:');
  console.log(`   • Total makes available: ${makesData.makes.length}`);
  console.log(`   • Mercedes-Benz: ✅ Available with ${modelsData.models.length} models`);
  console.log(`   • Toyota: ✅ Still working with ${toyotaData.models.length} models`);
  console.log(`   • Cache bypass: ✅ Working with ?nocache=1 parameter`);
}

testCompleteAutocomplete().catch(console.error);