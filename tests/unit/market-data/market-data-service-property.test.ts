/**
 * Property-Based Tests for Market Data Service
 * 
 * Tests universal properties that should hold across all valid inputs.
 * Uses fast-check for property-based testing.
 * 
 * Properties tested:
 * - Property 11: Graceful degradation with stale data
 * - Property 15: Aggregated and individual price storage
 * - Property 20: Fresh cache performance
 * - Property 30: Unsupported property type error
 * - Property 31: Property type storage
 * 
 * Requirements: 2.6, 3.6, 6.1, 7.3, 10.4, 10.6
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { getMarketPrice } from '@/features/market-data/services/market-data.service';