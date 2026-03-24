/**
 * Pagination Service
 * 
 * Provides consistent pagination logic for all paginated lists.
 * Handles metadata calculation, offset computation, and parameter validation.
 * 
 * Requirements: 18.2, 18.4, 19.2, 19.4, 20.2, 20.4
 */

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export class PaginationService {
  /**
   * Calculate pagination metadata
   * 
   * @param page - Current page number (1-indexed)
   * @param limit - Items per page
   * @param total - Total number of items
   * @returns Pagination metadata object
   */
  static getPaginationMeta(
    page: number,
    limit: number,
    total: number
  ): PaginationMeta {
    const totalPages = Math.ceil(total / limit);
    
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
  
  /**
   * Get offset for database query
   * 
   * @param page - Current page number (1-indexed)
   * @param limit - Items per page
   * @returns Offset value for database query
   */
  static getOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }
  
  /**
   * Validate and sanitize pagination parameters
   * Ensures page and limit are within valid ranges
   * 
   * @param page - Page number from request (string or null)
   * @param limit - Limit from request (string or null)
   * @param maxLimit - Maximum allowed limit (default: 100)
   * @returns Validated pagination options
   */
  static validateParams(
    page: string | null | undefined,
    limit: string | null | undefined,
    maxLimit: number = 100
  ): PaginationOptions {
    const pageNum = Math.max(1, parseInt(page || '1') || 1);
    const limitNum = Math.min(
      maxLimit,
      Math.max(1, parseInt(limit || '20') || 20)
    );
    
    return { page: pageNum, limit: limitNum };
  }
  
  /**
   * Create a paginated result object
   * 
   * @param data - Array of items for current page
   * @param page - Current page number
   * @param limit - Items per page
   * @param total - Total number of items
   * @returns Paginated result with data and metadata
   */
  static createResult<T>(
    data: T[],
    page: number,
    limit: number,
    total: number
  ): PaginationResult<T> {
    return {
      data,
      pagination: this.getPaginationMeta(page, limit, total),
    };
  }
}
