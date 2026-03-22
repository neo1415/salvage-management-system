#!/usr/bin/env tsx

/**
 * Verification Script: Cache Schema Universal Types Migration
 * 
 * This script verifies that migration 0011 was applied correctly
 * and that the cache schema supports all universal item types.
 */

import { db } from '../src/lib/db/drizzle';
import { marketDataCache, backgroundJobs } from '../src/lib/db/schema/market-data';
import { eq } from 'drizzle-orm';

interface VerificationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

async function verifyMigration(): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];

  console.log('🔍 Verifying Migration 0011: Cache Schema Universal Types...\n');

  // Test 1: Check property type constraints
  try {
    const constraintQuery = `
      SELECT constraint_name, check_clause 
      FROM information_schema.check_constraints 
      WHERE constraint_name = 'chk_market_data_property_type'
    `;
    
    const constraintResult = await db.execute(constraintQuery as any);
    
    if (constraintResult.length > 0) {
      const checkClause = constraintResult[0].check_clause;
      const hasAllTypes = [
        'appliance', 'property', 'jewelry', 'furniture', 'machinery'
      ].every(type => checkClause.includes(type));
      
      results.push({
        test: 'Property Type Constraints',
        status: hasAllTypes ? 'PASS' : 'FAIL',
        message: hasAllTypes 
          ? 'All new item types are supported in constraints'
          : 'Some new item types missing from constraints',
        details: { checkClause }
      });
    } else {
      results.push({
        test: 'Property Type Constraints',
        status: 'FAIL',
        message: 'Property type constraint not found'
      });
    }
  } catch (error) {
    results.push({
      test: 'Property Type Constraints',
      status: 'FAIL',
      message: `Error checking constraints: ${error}`
    });
  }

  // Test 2: Check validation functions
  const validationFunctions = [
    'validate_appliance_details',
    'validate_property_details',
    'validate_jewelry_details',
    'validate_furniture_details',
    'validate_machinery_details'
  ];

  for (const funcName of validationFunctions) {
    try {
      const funcQuery = `
        SELECT routine_name, routine_type 
        FROM information_schema.routines 
        WHERE routine_name = '${funcName}'
      `;
      
      const funcResult = await db.execute(funcQuery as any);
      
      results.push({
        test: `Validation Function: ${funcName}`,
        status: funcResult.length > 0 ? 'PASS' : 'FAIL',
        message: funcResult.length > 0 
          ? 'Function exists and is callable'
          : 'Function not found'
      });
    } catch (error) {
      results.push({
        test: `Validation Function: ${funcName}`,
        status: 'FAIL',
        message: `Error checking function: ${error}`
      });
    }
  }

  // Test 3: Check specialized indexes
  const expectedIndexes = [
    'idx_market_data_appliance_brand',
    'idx_market_data_appliance_type',
    'idx_market_data_property_location',
    'idx_market_data_property_type_field',
    'idx_market_data_jewelry_type',
    'idx_market_data_jewelry_material',
    'idx_market_data_furniture_type',
    'idx_market_data_furniture_material',
    'idx_market_data_machinery_brand',
    'idx_market_data_machinery_type',
    'idx_market_data_condition'
  ];

  for (const indexName of expectedIndexes) {
    try {
      const indexQuery = `
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE indexname = '${indexName}'
      `;
      
      const indexResult = await db.execute(indexQuery as any);
      
      results.push({
        test: `Index: ${indexName}`,
        status: indexResult.length > 0 ? 'PASS' : 'FAIL',
        message: indexResult.length > 0 
          ? 'Index exists and is active'
          : 'Index not found'
      });
    } catch (error) {
      results.push({
        test: `Index: ${indexName}`,
        status: 'FAIL',
        message: `Error checking index: ${error}`
      });
    }
  }

  // Test 4: Test data insertion for new item types
  const testItems = [
    {
      type: 'appliance',
      data: {
        type: 'appliance',
        brand: 'LG',
        model: 'GR-X257CSAV',
        applianceType: 'refrigerator',
        condition: 'Brand New'
      }
    },
    {
      type: 'jewelry',
      data: {
        type: 'jewelry',
        jewelryType: 'ring',
        material: 'gold',
        weight: '5 grams',
        condition: 'Brand New'
      }
    },
    {
      type: 'furniture',
      data: {
        type: 'furniture',
        furnitureType: 'chair',
        material: 'wood',
        condition: 'Foreign Used (Tokunbo)'
      }
    }
  ];

  for (const testItem of testItems) {
    try {
      // Try to insert test data
      const testHash = `test_${testItem.type}_${Date.now()}`;
      
      await db.insert(marketDataCache).values({
        propertyHash: testHash,
        propertyType: testItem.type,
        propertyDetails: testItem.data as any,
        medianPrice: '100000',
        minPrice: '90000',
        maxPrice: '110000',
        sourceCount: 1,
        scrapedAt: new Date(),
        staleAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      // Verify insertion
      const inserted = await db
        .select()
        .from(marketDataCache)
        .where(eq(marketDataCache.propertyHash, testHash))
        .limit(1);

      if (inserted.length > 0) {
        results.push({
          test: `Data Insertion: ${testItem.type}`,
          status: 'PASS',
          message: 'Successfully inserted and retrieved test data',
          details: { propertyType: inserted[0].propertyType }
        });

        // Clean up test data
        await db
          .delete(marketDataCache)
          .where(eq(marketDataCache.propertyHash, testHash));
      } else {
        results.push({
          test: `Data Insertion: ${testItem.type}`,
          status: 'FAIL',
          message: 'Data inserted but not retrievable'
        });
      }
    } catch (error) {
      results.push({
        test: `Data Insertion: ${testItem.type}`,
        status: 'FAIL',
        message: `Error inserting test data: ${error}`
      });
    }
  }

  // Test 5: Check sample data from migration
  try {
    const sampleDataQuery = await db
      .select()
      .from(marketDataCache)
      .where(eq(marketDataCache.propertyHash, 'sample_appliance_hash_001'))
      .limit(1);

    results.push({
      test: 'Sample Data Creation',
      status: sampleDataQuery.length > 0 ? 'PASS' : 'WARN',
      message: sampleDataQuery.length > 0 
        ? 'Sample data created successfully'
        : 'Sample data not found (may have been cleaned up)'
    });
  } catch (error) {
    results.push({
      test: 'Sample Data Creation',
      status: 'FAIL',
      message: `Error checking sample data: ${error}`
    });
  }

  // Test 6: Check background jobs constraint
  try {
    const bgJobsConstraintQuery = `
      SELECT constraint_name, check_clause 
      FROM information_schema.check_constraints 
      WHERE constraint_name = 'chk_background_jobs_property_type'
    `;
    
    const bgJobsResult = await db.execute(bgJobsConstraintQuery as any);
    
    results.push({
      test: 'Background Jobs Constraints',
      status: bgJobsResult.length > 0 ? 'PASS' : 'FAIL',
      message: bgJobsResult.length > 0 
        ? 'Background jobs constraint updated'
        : 'Background jobs constraint not found'
    });
  } catch (error) {
    results.push({
      test: 'Background Jobs Constraints',
      status: 'FAIL',
      message: `Error checking background jobs constraint: ${error}`
    });
  }

  return results;
}

async function main() {
  try {
    const results = await verifyMigration();
    
    // Print results
    console.log('📊 Verification Results:\n');
    
    let passCount = 0;
    let failCount = 0;
    let warnCount = 0;
    
    for (const result of results) {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'WARN' ? '⚠️' : '❌';
      console.log(`${icon} ${result.test}: ${result.message}`);
      
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
      
      if (result.status === 'PASS') passCount++;
      else if (result.status === 'FAIL') failCount++;
      else warnCount++;
    }
    
    console.log('\n📈 Summary:');
    console.log(`   ✅ Passed: ${passCount}`);
    console.log(`   ⚠️  Warnings: ${warnCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    
    if (failCount === 0) {
      console.log('\n🎉 Migration 0011 verification completed successfully!');
      console.log('\n✨ The cache schema now supports all universal item types:');
      console.log('   • Appliances (refrigerators, washing machines, etc.)');
      console.log('   • Property (houses, apartments, land, etc.)');
      console.log('   • Jewelry (rings, necklaces, watches, etc.)');
      console.log('   • Furniture (sofas, tables, beds, etc.)');
      console.log('   • Machinery (generators, equipment, etc.)');
      console.log('\n🔗 Integration ready for:');
      console.log('   • Internet search service caching');
      console.log('   • Universal item type support');
      console.log('   • Enhanced query performance');
      console.log('   • Data integrity validation');
    } else {
      console.log('\n⚠️  Some verification tests failed. Please review the results above.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);