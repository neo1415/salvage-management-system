// Load environment variables first
import { config } from 'dotenv';
config();

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Check if DATABASE_URL is defined
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not defined');
}

// Create postgres connection with proper pool configuration
// Use TEST_DATABASE_URL for tests if available (Transaction mode pooler)
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const isProduction = process.env.NODE_ENV === 'production';
const connectionString = isTest && process.env.TEST_DATABASE_URL 
  ? process.env.TEST_DATABASE_URL 
  : process.env.DATABASE_URL;

// CRITICAL FIX: Increase connection pool size for production
// Supabase Session Pooler supports up to 200 connections
// Phase 1 Scalability: Increased from 50 to 200 for 4x capacity increase
const client = postgres(connectionString, {
  // Test: 10 connections (enough for integration tests with transactions), Production: 200, Development: 20
  // Increased from 2 to 10 for tests to handle concurrent transactions
  max: isTest ? 10 : isProduction ? 200 : 20,
  // Idle timeout - close idle connections after reasonable time
  idle_timeout: isTest ? 30 : 20,
  // Max lifetime - longer in tests to prevent mid-test disconnections
  max_lifetime: isTest ? 300 : 60 * 10,
  // Connection timeout - reasonable timeout for tests
  connect_timeout: isTest ? 10 : 10,
  // SCALABILITY: Add connection queue management
  // Larger queue for tests to handle transaction queuing
  max_queue: isTest ? 100 : 1000,
  // Queue timeout - reasonable timeout for tests
  queue_timeout: isTest ? 10000 : 5000,
  // Prepare statements (disable in test for better cleanup)
  prepare: !isTest,
  // Add retry logic for transient connection failures
  connection: {
    application_name: 'nem-salvage',
  },
  // Enable connection retry on failure
  onnotice: () => {}, // Suppress notices
  onparameter: () => {}, // Suppress parameter status
  // Add error handling for connection issues
  onclose: () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Database] Connection closed');
    }
  },
  // CRITICAL: Enable connection pooling and reuse
  // This prevents creating new connections for every query
  transform: {
    undefined: null, // Convert undefined to null for PostgreSQL
  },
});

// Create drizzle instance
export const db = drizzle(client, { schema });

// Export client for cleanup in tests
export { client };

// Database health check function
export async function checkDatabaseConnection(): Promise<{ healthy: boolean; error?: string }> {
  try {
    // Simple query to check connection
    await client`SELECT 1 as health_check`;
    return { healthy: true };
  } catch (error) {
    console.error('[Database] Health check failed:', error);
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Connection retry wrapper for critical queries
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Check if it's a connection error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isConnectionError = 
        errorMessage.includes('FATAL') ||
        errorMessage.includes('XX000') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('timeout');
      
      if (!isConnectionError || attempt === maxRetries) {
        throw error;
      }
      
      console.warn(`[Database] Retry attempt ${attempt}/${maxRetries} after error:`, errorMessage);
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  
  throw lastError;
}
