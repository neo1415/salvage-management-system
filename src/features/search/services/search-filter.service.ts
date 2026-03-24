/**
 * Search Filter Service
 * 
 * Provides case-insensitive partial matching and multi-select filter logic
 * for search and filter functionality across all entity types.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2
 */

import { sql, SQL } from 'drizzle-orm';

export class SearchFilterService {
  /**
   * Build case-insensitive partial matching search condition
   * Searches across multiple fields with OR logic
   * 
   * @param searchQuery - User's search input
   * @param fields - Array of field names to search
   * @returns SQL condition for search query
   */
  static buildSearchCondition(
    searchQuery: string,
    fields: string[]
  ): SQL {
    if (!searchQuery || searchQuery.trim() === '') {
      return sql`true`;
    }
    
    const query = searchQuery.toLowerCase().trim();
    const conditions = fields.map(field => 
      sql`LOWER(${sql.raw(field)}) LIKE ${`%${query}%`}`
    );
    
    // OR logic: match any field
    return sql`(${sql.join(conditions, sql` OR `)})`;
  }
  
  /**
   * Build multi-select filter condition with OR logic
   * Example: assetType IN ('vehicle', 'electronics')
   * 
   * @param column - Database column to filter
   * @param selectedValues - Array of selected filter values
   * @returns SQL condition for multi-select filter, or undefined if no values selected
   */
  static buildMultiSelectFilter<T>(
    column: any,
    selectedValues: T[]
  ): SQL | undefined {
    if (!selectedValues || selectedValues.length === 0) {
      return undefined;
    }
    
    return sql`${column} IN (${sql.join(
      selectedValues.map(v => sql`${v}`),
      sql`, `
    )})`;
  }
  
  /**
   * Field mapping configurations for different entity types
   */
  static readonly FIELD_MAPPINGS = {
    auctions: ['assetDetails', 'locationName', 'status'],
    cases: ['claimReference', 'assetType', 'assetDetails', 'locationName'],
    vendors: ['businessName', 'email', 'phoneNumber'],
    users: ['fullName', 'email', 'role'],
  } as const;
}
