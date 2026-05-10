/**
 * API Route Parser for Next.js App Router
 * Extracts API endpoint information from Next.js route files
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import {
  APIRouteDefinition,
  HTTPMethod,
  HandlerDefinition,
  AuthRequirement,
  RoleRequirement,
  ParseResult,
  ParserErrorType,
} from './types';

export class APIRouteParser {
  /**
   * Parse a Next.js API route file and extract endpoint information
   */
  async parseAPIRoute(filePath: string): Promise<ParseResult<APIRouteDefinition>> {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: {
            type: ParserErrorType.FILE_NOT_FOUND,
            message: `File not found: ${filePath}`,
            filePath,
          },
        };
      }

      // Read file content
      const sourceCode = fs.readFileSync(filePath, 'utf-8');

      // Create source file
      const sourceFile = ts.createSourceFile(
        path.basename(filePath),
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      // Extract route path from file path
      const routePath = this.extractRoutePath(filePath);

      // Extract handlers
      const handlers = this.extractHandlers(sourceFile, sourceCode);

      // Extract authentication and authorization
      const authentication = this.extractAuthentication(sourceCode);
      const authorization = this.extractAuthorization(sourceCode);

      // Extract middleware
      const middleware = this.extractMiddleware(sourceCode);

      const definition: APIRouteDefinition = {
        filePath,
        path: routePath,
        methods: handlers.map((h) => h.method),
        handlers,
        middleware,
        authentication,
        authorization,
      };

      return {
        success: true,
        data: definition,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ParserErrorType.PARSE_ERROR,
          message: error instanceof Error ? error.message : 'Unknown parse error',
          filePath,
        },
      };
    }
  }

  /**
   * Extract route path from file path
   * Example: src/app/api/cases/[id]/route.ts -> /api/cases/[id]
   */
  private extractRoutePath(filePath: string): string {
    // Normalize path separators
    const normalizedPath = filePath.replace(/\\/g, '/');

    // Extract the part after /api/
    const apiMatch = normalizedPath.match(/\/api\/(.+?)\/route\.(ts|js)$/);
    if (apiMatch) {
      return `/api/${apiMatch[1]}`;
    }

    // If no match, try to extract from /app/api/
    const appApiMatch = normalizedPath.match(/\/app\/api\/(.+?)\/route\.(ts|js)$/);
    if (appApiMatch) {
      return `/api/${appApiMatch[1]}`;
    }

    // Fallback: return the file path
    return normalizedPath;
  }

  /**
   * Extract HTTP method handlers (GET, POST, PUT, PATCH, DELETE)
   */
  private extractHandlers(
    sourceFile: ts.SourceFile,
    sourceCode: string
  ): HandlerDefinition[] {
    const handlers: HandlerDefinition[] = [];
    const methods: HTTPMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

    const visit = (node: ts.Node) => {
      // Look for exported async function declarations
      if (ts.isFunctionDeclaration(node) && node.name) {
        const functionName = node.name.text;

        // Check if it's an HTTP method
        if (methods.includes(functionName as HTTPMethod)) {
          const method = functionName as HTTPMethod;

          // Get function body text to analyze auth and roles
          const functionText = node.getText(sourceFile);

          handlers.push({
            method,
            functionName,
            hasAuth: this.checkForAuth(functionText),
            hasRoleCheck: this.checkForRoleCheck(functionText),
            roles: this.extractRoles(functionText),
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return handlers;
  }

  /**
   * Check if the code contains authentication checks
   */
  private checkForAuth(code: string): boolean {
    return (
      code.includes('await auth()') ||
      code.includes('session') ||
      code.includes('Unauthorized') ||
      code.includes('status: 401')
    );
  }

  /**
   * Check if the code contains role-based authorization checks
   */
  private checkForRoleCheck(code: string): boolean {
    return (
      code.includes('session.user.role') ||
      code.includes('role ===') ||
      code.includes('role !==') ||
      code.includes('hasRole') ||
      code.includes('checkRole') ||
      code.includes('Forbidden') ||
      code.includes('status: 403')
    );
  }

  /**
   * Extract roles from authorization checks
   */
  private extractRoles(code: string): string[] {
    const roles: string[] = [];

    // Look for role comparisons
    const rolePatterns = [
      /role\s*===\s*['"](\w+)['"]/g,
      /role\s*!==\s*['"](\w+)['"]/g,
      /includes\(['"](\w+)['"]\)/g,
    ];

    rolePatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const role = match[1];
        if (!roles.includes(role)) {
          roles.push(role);
        }
      }
    });

    return roles;
  }

  /**
   * Extract authentication requirements
   */
  private extractAuthentication(sourceCode: string): AuthRequirement {
    const hasAuth =
      sourceCode.includes('await auth()') ||
      sourceCode.includes('session') ||
      sourceCode.includes('Unauthorized');

    let type: 'session' | 'token' | 'api-key' | undefined;

    if (sourceCode.includes('await auth()') || sourceCode.includes('session')) {
      type = 'session';
    } else if (sourceCode.includes('Bearer') || sourceCode.includes('token')) {
      type = 'token';
    } else if (sourceCode.includes('api-key') || sourceCode.includes('apiKey')) {
      type = 'api-key';
    }

    return {
      required: hasAuth,
      type,
    };
  }

  /**
   * Extract authorization requirements (roles)
   */
  private extractAuthorization(sourceCode: string): RoleRequirement[] {
    const authorization: RoleRequirement[] = [];

    // Look for role checks
    const rolePatterns = [
      /role\s*===\s*['"](\w+)['"]/g,
      /role\s*!==\s*['"](\w+)['"]/g,
      /\[['"](\w+)['"],\s*['"](\w+)['"]\]\.includes\(.*?role\)/g,
    ];

    const foundRoles = new Set<string>();

    rolePatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(sourceCode)) !== null) {
        if (match[1]) foundRoles.add(match[1]);
        if (match[2]) foundRoles.add(match[2]);
      }
    });

    if (foundRoles.size > 0) {
      authorization.push({
        roles: Array.from(foundRoles),
        requireAll: false,
      });
    }

    return authorization;
  }

  /**
   * Extract middleware usage
   */
  private extractMiddleware(sourceCode: string): string[] {
    const middleware: string[] = [];

    // Look for common middleware patterns
    if (sourceCode.includes('cors')) {
      middleware.push('cors');
    }

    if (sourceCode.includes('rateLimit')) {
      middleware.push('rateLimit');
    }

    if (sourceCode.includes('validateRequest')) {
      middleware.push('validateRequest');
    }

    if (sourceCode.includes('csrf')) {
      middleware.push('csrf');
    }

    return middleware;
  }
}
