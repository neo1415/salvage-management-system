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
const connectionString = process.env.DATABASE_URL;

// Configure connection pool based on environment
const isTest = process.env.NODE_ENV === 'test';
const client = postgres(connectionString, {
  // Increase max connections in test environment to handle concurrent tests
  // Each test file fork gets its own pool, so we need more connections
  max: isTest ? 10 : 10,
  // Idle timeout - close idle connections after 30 seconds
  idle_timeout: 30,
  // Max lifetime - close connections after 30 minutes
  max_lifetime: 60 * 30,
  // Connection timeout - increased to 30 seconds for better reliability
  connect_timeout: 30,
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
