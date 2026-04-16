import { beforeAll, afterAll, afterEach } from 'vitest';
import { client } from '@/lib/db/drizzle';

// Global test setup
beforeAll(async () => {
  console.log('[Test Setup] Initializing test environment...');
  
  // Verify database connection
  try {
    await client`SELECT 1 as test`;
    console.log('[Test Setup] Database connection verified');
  } catch (error) {
    console.error('[Test Setup] Database connection failed:', error);
    throw error;
  }
});

// Clean up after each test to prevent connection leaks
afterEach(async () => {
  // Small delay to allow pending queries to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Global test teardown
afterAll(async () => {
  console.log('[Test Setup] Cleaning up test environment...');
  
  // Close all database connections
  try {
    await client.end({ timeout: 5 });
    console.log('[Test Setup] Database connections closed successfully');
  } catch (error) {
    console.error('[Test Setup] Error closing database connections:', error);
  }
});
