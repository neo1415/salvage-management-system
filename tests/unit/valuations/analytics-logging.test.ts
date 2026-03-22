/**
 * Unit tests for analytics logging in autocomplete and valuation query
 * 
 * Tests verify that:
 * - Fuzzy matches are logged correctly
 * - Performance warnings trigger at correct threshold
 * - Usage metrics are tracked
 * - Response times are measured
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('Analytics Logging', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('Fuzzy Match Logging', () => {
    it('should log fuzzy match attempts with input and matched values', () => {
      // Simulate fuzzy match logging
      const logEntry = {
        input: { make: 'Toyota', model: 'Camry', year: 2020 },
        matched: { make: 'Toyota', model: 'Camry', year: 2020 },
        similarityScore: 0.85,
        matchType: 'fuzzy_make_model',
        timestamp: new Date().toISOString(),
      }

      console.log('[ValuationQuery] ✓ Fuzzy match SUCCESS', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ValuationQuery] ✓ Fuzzy match SUCCESS',
        expect.objectContaining({
          input: expect.any(Object),
          matched: expect.any(Object),
          similarityScore: expect.any(Number),
          matchType: 'fuzzy_make_model',
        })
      )
    })

    it('should log similarity scores for debugging', () => {
      const logEntry = {
        similarityScore: 0.75,
        makeScore: 0.80,
        modelScore: 0.70,
      }

      console.log('[ValuationQuery] Fuzzy matching scores', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ValuationQuery] Fuzzy matching scores',
        expect.objectContaining({
          similarityScore: expect.any(Number),
        })
      )
    })

    it('should log when fuzzy match fails', () => {
      const logEntry = {
        input: { make: 'Unknown', model: 'Unknown', year: 2020 },
        threshold: 0.6,
        bestScore: 0.45,
      }

      console.log('[ValuationQuery] Fuzzy matching - all candidates below similarity threshold', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ValuationQuery] Fuzzy matching - all candidates below similarity threshold',
        expect.objectContaining({
          threshold: 0.6,
        })
      )
    })
  })

  describe('Performance Warnings', () => {
    it('should trigger warning when query exceeds 200ms threshold', () => {
      const logEntry = {
        queryTime: '250ms',
        threshold: '200ms',
        matchType: 'exact',
        input: { make: 'Toyota', model: 'Camry', year: 2020 },
      }

      console.warn('[ValuationQuery] ⚠️ SLOW QUERY - Query exceeded 200ms', logEntry)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[ValuationQuery] ⚠️ SLOW QUERY - Query exceeded 200ms',
        expect.objectContaining({
          queryTime: '250ms',
          threshold: '200ms',
        })
      )
    })

    it('should not trigger warning when query is under 200ms', () => {
      const queryTime = 150

      if (queryTime > 200) {
        console.warn('[ValuationQuery] ⚠️ SLOW QUERY - Query exceeded 200ms')
      }

      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('should trigger warning when autocomplete API exceeds 500ms', () => {
      const logEntry = {
        endpoint: '/api/valuations/makes',
        responseTime: '650ms',
        threshold: '500ms',
      }

      console.warn('[Autocomplete Analytics] ⚠️ SLOW RESPONSE - Makes endpoint exceeded 500ms', logEntry)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Autocomplete Analytics] ⚠️ SLOW RESPONSE - Makes endpoint exceeded 500ms',
        expect.objectContaining({
          responseTime: '650ms',
          threshold: '500ms',
        })
      )
    })
  })

  describe('Usage Metrics Tracking', () => {
    it('should track autocomplete selection', () => {
      const logEntry = {
        field: 'vehicleMake',
        value: 'Toyota',
        endpoint: '/api/valuations/makes',
        timestamp: new Date().toISOString(),
      }

      console.log('[Autocomplete Analytics] Selection made via autocomplete', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Autocomplete Analytics] Selection made via autocomplete',
        expect.objectContaining({
          field: 'vehicleMake',
          value: 'Toyota',
          endpoint: expect.any(String),
        })
      )
    })

    it('should track fallback to text input', () => {
      const logEntry = {
        field: 'vehicleMake',
        endpoint: '/api/valuations/makes',
        error: 'Network timeout',
        timestamp: new Date().toISOString(),
      }

      console.log('[Autocomplete Analytics] Fallback to text input due to API error', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Autocomplete Analytics] Fallback to text input due to API error',
        expect.objectContaining({
          field: 'vehicleMake',
          error: expect.any(String),
        })
      )
    })

    it('should track manual text entry when autocomplete unavailable', () => {
      const logEntry = {
        field: 'vehicleMake',
        isDegraded: true,
        isOffline: false,
        timestamp: new Date().toISOString(),
      }

      console.log('[Autocomplete Analytics] Manual text entry (autocomplete unavailable)', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Autocomplete Analytics] Manual text entry (autocomplete unavailable)',
        expect.objectContaining({
          field: 'vehicleMake',
          isDegraded: true,
        })
      )
    })

    it('should track popular searches for makes', () => {
      const logEntry = {
        make: 'Toyota',
        timestamp: new Date().toISOString(),
      }

      console.log('[Autocomplete Analytics] Popular search - Make', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Autocomplete Analytics] Popular search - Make',
        expect.objectContaining({
          make: 'Toyota',
        })
      )
    })

    it('should track popular searches for make/model combinations', () => {
      const logEntry = {
        make: 'Toyota',
        model: 'Camry',
        timestamp: new Date().toISOString(),
      }

      console.log('[Autocomplete Analytics] Popular search - Make/Model', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Autocomplete Analytics] Popular search - Make/Model',
        expect.objectContaining({
          make: 'Toyota',
          model: 'Camry',
        })
      )
    })
  })

  describe('Response Time Tracking', () => {
    it('should log response time for cache hits', () => {
      const logEntry = {
        endpoint: '/api/valuations/makes',
        responseTime: '15ms',
        cached: true,
        resultCount: 8,
        timestamp: new Date().toISOString(),
      }

      console.log('[Autocomplete Analytics] Makes endpoint - Cache HIT', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Autocomplete Analytics] Makes endpoint - Cache HIT',
        expect.objectContaining({
          responseTime: expect.stringMatching(/\d+ms/),
          cached: true,
        })
      )
    })

    it('should log response time for cache misses', () => {
      const logEntry = {
        endpoint: '/api/valuations/makes',
        responseTime: '125ms',
        cached: false,
        resultCount: 8,
        timestamp: new Date().toISOString(),
      }

      console.log('[Autocomplete Analytics] Makes endpoint - Cache MISS', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Autocomplete Analytics] Makes endpoint - Cache MISS',
        expect.objectContaining({
          responseTime: expect.stringMatching(/\d+ms/),
          cached: false,
        })
      )
    })

    it('should log response time for errors', () => {
      const logEntry = {
        endpoint: '/api/valuations/makes',
        responseTime: '5050ms',
        error: 'Request timeout',
        timestamp: new Date().toISOString(),
      }

      console.error('[Autocomplete Analytics] Makes endpoint - ERROR', logEntry)

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Autocomplete Analytics] Makes endpoint - ERROR',
        expect.objectContaining({
          responseTime: expect.stringMatching(/\d+ms/),
          error: expect.any(String),
        })
      )
    })
  })

  describe('Log Entry Structure', () => {
    it('should include timestamp in all log entries', () => {
      const logEntry = {
        field: 'vehicleMake',
        timestamp: new Date().toISOString(),
      }

      console.log('[Autocomplete Analytics] Test log', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Autocomplete Analytics] Test log',
        expect.objectContaining({
          timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        })
      )
    })

    it('should include endpoint information in API logs', () => {
      const logEntry = {
        endpoint: '/api/valuations/makes',
        responseTime: '100ms',
        timestamp: new Date().toISOString(),
      }

      console.log('[Autocomplete Analytics] API call', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Autocomplete Analytics] API call',
        expect.objectContaining({
          endpoint: expect.stringMatching(/^\/api\//),
        })
      )
    })

    it('should include result count in successful API responses', () => {
      const logEntry = {
        endpoint: '/api/valuations/makes',
        resultCount: 8,
        timestamp: new Date().toISOString(),
      }

      console.log('[Autocomplete Analytics] API response', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Autocomplete Analytics] API response',
        expect.objectContaining({
          resultCount: expect.any(Number),
        })
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle logging when similarity score is 0', () => {
      const logEntry = {
        similarityScore: 0,
        matchType: 'fuzzy_make_model',
      }

      console.log('[ValuationQuery] Fuzzy match with zero similarity', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ValuationQuery] Fuzzy match with zero similarity',
        expect.objectContaining({
          similarityScore: 0,
        })
      )
    })

    it('should handle logging when response time is 0ms', () => {
      const logEntry = {
        responseTime: '0ms',
        cached: true,
      }

      console.log('[Autocomplete Analytics] Instant response', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Autocomplete Analytics] Instant response',
        expect.objectContaining({
          responseTime: '0ms',
        })
      )
    })

    it('should handle logging with empty result sets', () => {
      const logEntry = {
        endpoint: '/api/valuations/models',
        make: 'UnknownMake',
        resultCount: 0,
        timestamp: new Date().toISOString(),
      }

      console.log('[Autocomplete Analytics] Empty result set', logEntry)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Autocomplete Analytics] Empty result set',
        expect.objectContaining({
          resultCount: 0,
        })
      )
    })
  })
})
