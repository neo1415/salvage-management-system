/**
 * Unit tests for ExportService
 * 
 * Tests CSV generation with RFC 4180 compliance
 */

import { describe, it, expect } from 'vitest';
import { ExportService } from '@/features/export/services/export.service';

describe('ExportService', () => {
  describe('generateCSV', () => {
    it('should generate CSV with headers and data', () => {
      const csv = ExportService.generateCSV({
        filename: 'test.csv',
        columns: [
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Name' },
        ],
        data: [
          { id: '1', name: 'John' },
          { id: '2', name: 'Jane' },
        ],
      });
      
      expect(csv).toBe('ID,Name\n1,John\n2,Jane');
    });
    
    it('should escape fields with commas', () => {
      const csv = ExportService.generateCSV({
        filename: 'test.csv',
        columns: [
          { key: 'name', header: 'Name' },
        ],
        data: [
          { name: 'Smith, John' },
        ],
      });
      
      expect(csv).toBe('Name\n"Smith, John"');
    });
    
    it('should escape fields with quotes', () => {
      const csv = ExportService.generateCSV({
        filename: 'test.csv',
        columns: [
          { key: 'name', header: 'Name' },
        ],
        data: [
          { name: 'John "Johnny" Smith' },
        ],
      });
      
      expect(csv).toBe('Name\n"John ""Johnny"" Smith"');
    });
    
    it('should escape fields with newlines', () => {
      const csv = ExportService.generateCSV({
        filename: 'test.csv',
        columns: [
          { key: 'description', header: 'Description' },
        ],
        data: [
          { description: 'Line 1\nLine 2' },
        ],
      });
      
      expect(csv).toBe('Description\n"Line 1\nLine 2"');
    });
    
    it('should handle null and undefined values', () => {
      const csv = ExportService.generateCSV({
        filename: 'test.csv',
        columns: [
          { key: 'name', header: 'Name' },
          { key: 'email', header: 'Email' },
        ],
        data: [
          { name: 'John', email: null },
          { name: 'Jane', email: undefined },
        ],
      });
      
      expect(csv).toBe('Name,Email\nJohn,\nJane,');
    });
    
    it('should apply custom formatters', () => {
      const csv = ExportService.generateCSV({
        filename: 'test.csv',
        columns: [
          { key: 'amount', header: 'Amount', format: (v) => `₦${v.toLocaleString()}` },
        ],
        data: [
          { amount: 1000 },
          { amount: 2500 },
        ],
      });
      
      expect(csv).toContain('Amount');
      expect(csv).toContain('₦1,000');
      expect(csv).toContain('₦2,500');
    });
    
    it('should handle empty data', () => {
      const csv = ExportService.generateCSV({
        filename: 'test.csv',
        columns: [
          { key: 'id', header: 'ID' },
          { key: 'name', header: 'Name' },
        ],
        data: [],
      });
      
      expect(csv).toBe('ID,Name');
    });
    
    it('should handle special characters including Naira symbol', () => {
      const csv = ExportService.generateCSV({
        filename: 'test.csv',
        columns: [
          { key: 'price', header: 'Price' },
        ],
        data: [
          { price: '₦1,000' },
        ],
      });
      
      expect(csv).toBe('Price\n"₦1,000"');
    });
  });
  
  describe('generateFilename', () => {
    it('should generate filename with date suffix', () => {
      const filename = ExportService.generateFilename('finance-payments', 'csv');
      
      expect(filename).toMatch(/^finance-payments-\d{4}-\d{2}-\d{2}\.csv$/);
    });
    
    it('should handle different extensions', () => {
      const filename = ExportService.generateFilename('report', 'pdf');
      
      expect(filename).toMatch(/^report-\d{4}-\d{2}-\d{2}\.pdf$/);
    });
  });
});
