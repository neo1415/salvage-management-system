/**
 * Configuration Parser
 * Extracts configuration information from various config files
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ConfigDefinition,
  DependencyInfo,
  EnvironmentVariable,
  ParseResult,
  ParserErrorType,
} from './types';

export class ConfigParser {
  /**
   * Parse a configuration file
   */
  async parseConfig(filePath: string): Promise<ParseResult<ConfigDefinition>> {
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

      const fileName = path.basename(filePath);

      // Determine config type and parse accordingly
      if (fileName === 'package.json') {
        return this.parsePackageJson(filePath);
      } else if (fileName === '.env.example' || fileName === '.env') {
        return this.parseEnvFile(filePath);
      } else if (fileName === 'next.config.ts' || fileName === 'next.config.js') {
        return this.parseNextConfig(filePath);
      } else if (fileName === 'middleware.ts' || fileName === 'middleware.js') {
        return this.parseMiddleware(filePath);
      } else {
        return this.parseGenericConfig(filePath);
      }
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
   * Parse package.json
   */
  private async parsePackageJson(filePath: string): Promise<ParseResult<ConfigDefinition>> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const packageJson = JSON.parse(content);

      const dependencies: DependencyInfo[] = [];

      // Extract production dependencies
      if (packageJson.dependencies) {
        Object.entries(packageJson.dependencies).forEach(([name, version]) => {
          dependencies.push({
            name,
            version: version as string,
            isDev: false,
          });
        });
      }

      // Extract dev dependencies
      if (packageJson.devDependencies) {
        Object.entries(packageJson.devDependencies).forEach(([name, version]) => {
          dependencies.push({
            name,
            version: version as string,
            isDev: true,
          });
        });
      }

      return {
        success: true,
        data: {
          filePath,
          type: 'package',
          dependencies,
          configuration: {
            name: packageJson.name,
            version: packageJson.version,
            description: packageJson.description,
            scripts: packageJson.scripts,
            engines: packageJson.engines,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ParserErrorType.PARSE_ERROR,
          message: error instanceof Error ? error.message : 'Failed to parse package.json',
          filePath,
        },
      };
    }
  }

  /**
   * Parse .env or .env.example file
   */
  private async parseEnvFile(filePath: string): Promise<ParseResult<ConfigDefinition>> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      const environmentVariables: EnvironmentVariable[] = [];

      lines.forEach((line) => {
        // Skip comments and empty lines
        if (line.trim().startsWith('#') || line.trim() === '') {
          return;
        }

        // Parse variable: KEY=value or KEY=
        const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (match) {
          const [, name, value] = match;

          // Extract description from preceding comment
          const lineIndex = lines.indexOf(line);
          let description: string | undefined;

          if (lineIndex > 0) {
            const prevLine = lines[lineIndex - 1].trim();
            if (prevLine.startsWith('#')) {
              description = prevLine.substring(1).trim();
            }
          }

          environmentVariables.push({
            name,
            description,
            required: !value, // If no value in .env.example, it's likely required
            defaultValue: value || undefined,
          });
        }
      });

      return {
        success: true,
        data: {
          filePath,
          type: 'env',
          environmentVariables,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ParserErrorType.PARSE_ERROR,
          message: error instanceof Error ? error.message : 'Failed to parse .env file',
          filePath,
        },
      };
    }
  }

  /**
   * Parse next.config.ts or next.config.js
   */
  private async parseNextConfig(filePath: string): Promise<ParseResult<ConfigDefinition>> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Extract key configuration values using regex
      const configuration: Record<string, any> = {};

      // Extract experimental features (using multiline flag instead of 's' flag)
      const experimentalMatch = content.match(/experimental:\s*\{([^}]+)\}/);
      if (experimentalMatch) {
        configuration.experimental = experimentalMatch[1].trim();
      }

      // Extract image domains
      const imageDomainsMatch = content.match(/domains:\s*\[([^\]]+)\]/);
      if (imageDomainsMatch) {
        configuration.imageDomains = imageDomainsMatch[1]
          .split(',')
          .map((d) => d.trim().replace(/['"]/g, ''));
      }

      // Extract redirects
      if (content.includes('redirects:')) {
        configuration.hasRedirects = true;
      }

      // Extract rewrites
      if (content.includes('rewrites:')) {
        configuration.hasRewrites = true;
      }

      // Extract headers
      if (content.includes('headers:')) {
        configuration.hasHeaders = true;
      }

      // Extract webpack config
      if (content.includes('webpack:')) {
        configuration.hasWebpackConfig = true;
      }

      return {
        success: true,
        data: {
          filePath,
          type: 'next',
          configuration,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ParserErrorType.PARSE_ERROR,
          message: error instanceof Error ? error.message : 'Failed to parse next.config',
          filePath,
        },
      };
    }
  }

  /**
   * Parse middleware.ts
   */
  private async parseMiddleware(filePath: string): Promise<ParseResult<ConfigDefinition>> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      const configuration: Record<string, any> = {};

      // Extract matcher config
      const matcherMatch = content.match(/matcher:\s*(\[[\s\S]*?\]|['"][^'"]+['"])/);
      if (matcherMatch) {
        configuration.matcher = matcherMatch[1];
      }

      // Check for authentication
      if (content.includes('auth') || content.includes('session')) {
        configuration.hasAuth = true;
      }

      // Check for rate limiting
      if (content.includes('rateLimit') || content.includes('rate-limit')) {
        configuration.hasRateLimit = true;
      }

      // Check for CORS
      if (content.includes('cors') || content.includes('CORS')) {
        configuration.hasCORS = true;
      }

      // Check for CSP
      if (content.includes('Content-Security-Policy') || content.includes('CSP')) {
        configuration.hasCSP = true;
      }

      return {
        success: true,
        data: {
          filePath,
          type: 'middleware',
          configuration,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ParserErrorType.PARSE_ERROR,
          message: error instanceof Error ? error.message : 'Failed to parse middleware',
          filePath,
        },
      };
    }
  }

  /**
   * Parse generic configuration file
   */
  private async parseGenericConfig(filePath: string): Promise<ParseResult<ConfigDefinition>> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath);

      let configuration: Record<string, any> = {};

      // Try to parse as JSON
      if (ext === '.json') {
        try {
          configuration = JSON.parse(content);
        } catch {
          // Not valid JSON, treat as text
          configuration = { content };
        }
      } else {
        // For other files, just store the content
        configuration = { content };
      }

      return {
        success: true,
        data: {
          filePath,
          type: 'other',
          configuration,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          type: ParserErrorType.PARSE_ERROR,
          message: error instanceof Error ? error.message : 'Failed to parse config file',
          filePath,
        },
      };
    }
  }
}
