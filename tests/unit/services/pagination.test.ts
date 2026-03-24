/**
 * Unit tests for PaginationService
 * 
 * Tests pagination metadata calculation and parameter validation
 */

import { describe, it, expect } from 'vitest';
import { PaginationService } from '@/lib/utils/pagination.service';

describe('PaginationService', () => {
  describe('getPaginationMeta', () => {
    it('should calculate correct metadata for first page', () => {
      const meta = PaginationService.getPaginationMeta(1, 10, 100);
      
      expect(meta).toEqual({
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10,
        hasNext: true,
        hasPrev: false,
      });
    });
    
    it('should calculate correct metadata for middle page', () => {
      const meta = PaginationService.getPaginationMeta(5, 10, 100);
      
      expect(meta).toEqual({
        page: 5,
        limit: 10,
        total: 100,
        totalPages: 10,
        hasNext: true,
        hasPrev: true,
      });
    });
    
    it('should calculate correct metadata for last page', () => {
      const meta = PaginationService.getPaginationMeta(10, 10, 100);
      
      expect(meta).toEqual({
        page: 10,
        limit: 10,
        total: 100,
        totalPages: 10,
        hasNext: false,
        hasPrev: true,
      });
    });
    
    it('should handle partial last page', () => {
      const meta = PaginationService.getPaginationMeta(3, 10, 25);
      
      expect(meta).toEqual({
        page: 3,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: false,
        hasPrev: true,
      });
    });
    
    it('should handle single page', () => {
      const meta = PaginationService.getPaginationMeta(1, 10, 5);
      
      expect(meta).toEqual({
        page: 1,
        limit: 10,
        total: 5,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });
    
    it('should handle empty data', () => {
      const meta = PaginationService.getPaginationMeta(1, 10, 0);
      
      expect(meta).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });
    });
  });
  
  describe('getOffset', () => {
    it('should return 0 for first page', () => {
      expect(PaginationService.getOffset(1, 10)).toBe(0);
    });
    
    it('should calculate correct offset for page 2', () => {
      expect(PaginationService.getOffset(2, 10)).toBe(10);
    });
    
    it('should calculate correct offset for page 5', () => {
      expect(PaginationService.getOffset(5, 20)).toBe(80);
    });
  });
  
  describe('validateParams', () => {
    it('should use defaults when params are null', () => {
      const params = PaginationService.validateParams(null, null);
      
      expect(params).toEqual({
        page: 1,
        limit: 20,
      });
    });
    
    it('should use defaults when params are undefined', () => {
      const params = PaginationService.validateParams(undefined, undefined);
      
      expect(params).toEqual({
        page: 1,
        limit: 20,
      });
    });
    
    it('should parse valid string params', () => {
      const params = PaginationService.validateParams('3', '50');
      
      expect(params).toEqual({
        page: 3,
        limit: 50,
      });
    });
    
    it('should clamp page to minimum of 1', () => {
      const params = PaginationService.validateParams('0', '10');
      
      expect(params.page).toBe(1);
    });
    
    it('should clamp negative page to 1', () => {
      const params = PaginationService.validateParams('-5', '10');
      
      expect(params.page).toBe(1);
    });
    
    it('should clamp limit to maximum', () => {
      const params = PaginationService.validateParams('1', '200', 100);
      
      expect(params.limit).toBe(100);
    });
    
    it('should use default limit when limit is 0', () => {
      const params = PaginationService.validateParams('1', '0');
      
      // When limit is 0 or invalid, it defaults to 20
      expect(params.limit).toBe(20);
    });
    
    it('should handle invalid string params', () => {
      const params = PaginationService.validateParams('invalid', 'invalid');
      
      expect(params).toEqual({
        page: 1,
        limit: 20,
      });
    });
  });
  
  describe('createResult', () => {
    it('should create paginated result with data and metadata', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const result = PaginationService.createResult(data, 1, 10, 100);
      
      expect(result.data).toEqual(data);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 100,
        totalPages: 10,
        hasNext: true,
        hasPrev: false,
      });
    });
  });
});
