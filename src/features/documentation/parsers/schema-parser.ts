/**
 * Schema Parser for Drizzle ORM
 * Extracts database schema information from Drizzle schema files
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import {
  SchemaDefinition,
  ColumnDefinition,
  ForeignKeyDefinition,
  IndexDefinition,
  EnumDefinition,
  RelationshipDefinition,
  ParseResult,
  ParserErrorType,
} from './types';

export class SchemaParser {
  /**
   * Parse a Drizzle schema file and extract table definitions
   */
  async parseSchema(filePath: string): Promise<ParseResult<SchemaDefinition[]>> {
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

      // Extract schemas
      const schemas: SchemaDefinition[] = [];
      const enums = this.extractEnums(sourceFile);
      const tables = this.extractTables(sourceFile, sourceCode);

      tables.forEach((table) => {
        schemas.push({
          filePath,
          tableName: table.tableName,
          columns: table.columns,
          primaryKey: table.primaryKey,
          foreignKeys: table.foreignKeys,
          indexes: this.extractIndexesFromComments(sourceCode, table.tableName),
          enums,
          relationships: table.relationships,
        });
      });

      return {
        success: true,
        data: schemas,
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
   * Extract enum definitions
   */
  private extractEnums(sourceFile: ts.SourceFile): EnumDefinition[] {
    const enums: EnumDefinition[] = [];

    const visit = (node: ts.Node) => {
      // Look for pgEnum calls: pgEnum('name', ['value1', 'value2'])
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'pgEnum'
      ) {
        const args = node.arguments;
        if (args.length >= 2) {
          // First argument is the enum name
          const nameArg = args[0];
          if (ts.isStringLiteral(nameArg)) {
            const enumName = nameArg.text;

            // Second argument is the array of values
            const valuesArg = args[1];
            if (ts.isArrayLiteralExpression(valuesArg)) {
              const values = valuesArg.elements
                .filter(ts.isStringLiteral)
                .map((element) => element.text);

              enums.push({
                name: enumName,
                values,
              });
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return enums;
  }

  /**
   * Extract table definitions
   */
  private extractTables(
    sourceFile: ts.SourceFile,
    sourceCode: string
  ): Array<{
    tableName: string;
    columns: ColumnDefinition[];
    primaryKey: string[];
    foreignKeys: ForeignKeyDefinition[];
    relationships: RelationshipDefinition[];
  }> {
    const tables: Array<{
      tableName: string;
      columns: ColumnDefinition[];
      primaryKey: string[];
      foreignKeys: ForeignKeyDefinition[];
      relationships: RelationshipDefinition[];
    }> = [];

    const visit = (node: ts.Node) => {
      // Look for pgTable calls
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'pgTable'
      ) {
        const args = node.arguments;
        if (args.length >= 2) {
          // First argument is table name
          const nameArg = args[0];
          if (ts.isStringLiteral(nameArg)) {
            const tableName = nameArg.text;

            // Second argument is the schema object
            const schemaArg = args[1];
            if (ts.isObjectLiteralExpression(schemaArg)) {
              const columns: ColumnDefinition[] = [];
              const primaryKey: string[] = [];
              const foreignKeys: ForeignKeyDefinition[] = [];

              schemaArg.properties.forEach((prop) => {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                  const columnName = prop.name.text;
                  const columnDef = this.parseColumnDefinition(
                    columnName,
                    prop.initializer,
                    sourceCode
                  );

                  if (columnDef) {
                    columns.push(columnDef);

                    if (columnDef.isPrimaryKey) {
                      primaryKey.push(columnName);
                    }

                    if (columnDef.references) {
                      foreignKeys.push({
                        columnName,
                        referencesTable: columnDef.references.table,
                        referencesColumn: columnDef.references.column,
                      });
                    }
                  }
                }
              });

              tables.push({
                tableName,
                columns,
                primaryKey,
                foreignKeys,
                relationships: this.inferRelationships(tableName, foreignKeys),
              });
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return tables;
  }

  /**
   * Parse a column definition from Drizzle schema
   */
  private parseColumnDefinition(
    columnName: string,
    initializer: ts.Expression,
    _sourceCode: string
  ): ColumnDefinition | null {
    const columnText = initializer.getText();

    // Extract column type
    let type = 'unknown';
    if (columnText.includes('uuid(')) type = 'uuid';
    else if (columnText.includes('varchar(')) type = 'varchar';
    else if (columnText.includes('text(')) type = 'text';
    else if (columnText.includes('integer(')) type = 'integer';
    else if (columnText.includes('numeric(')) type = 'numeric';
    else if (columnText.includes('timestamp(')) type = 'timestamp';
    else if (columnText.includes('boolean(')) type = 'boolean';
    else if (columnText.includes('jsonb(')) type = 'jsonb';
    else if (columnText.includes('point(')) type = 'point';
    else if (columnText.includes('Enum(')) {
      // Extract enum type name
      const enumMatch = columnText.match(/(\w+Enum)\(/);
      if (enumMatch) {
        type = enumMatch[1];
      } else {
        type = 'enum';
      }
    }

    // Check for array type
    if (columnText.includes('.array()')) {
      type += '[]';
    }

    // Extract constraints
    const nullable = !columnText.includes('.notNull()');
    const isPrimaryKey = columnText.includes('.primaryKey()');
    const isUnique = columnText.includes('.unique()');

    // Extract default value
    let defaultValue: string | undefined;
    if (columnText.includes('.default(')) {
      const defaultMatch = columnText.match(/\.default\(([^)]+)\)/);
      if (defaultMatch) {
        defaultValue = defaultMatch[1];
      }
    } else if (columnText.includes('.defaultNow()')) {
      defaultValue = 'NOW()';
    } else if (columnText.includes('.defaultRandom()')) {
      defaultValue = 'gen_random_uuid()';
    }

    // Extract foreign key reference
    let references: { table: string; column: string } | undefined;
    if (columnText.includes('.references(')) {
      const referencesMatch = columnText.match(/\.references\(\(\)\s*=>\s*(\w+)\.(\w+)/);
      if (referencesMatch) {
        references = {
          table: referencesMatch[1],
          column: referencesMatch[2],
        };
      }
    }

    return {
      name: columnName,
      type,
      nullable,
      defaultValue,
      isPrimaryKey,
      isUnique,
      references,
    };
  }

  /**
   * Extract index definitions from SQL comments in the file
   */
  private extractIndexesFromComments(
    sourceCode: string,
    tableName: string
  ): IndexDefinition[] {
    const indexes: IndexDefinition[] = [];

    // Look for CREATE INDEX comments
    const indexRegex = /CREATE\s+(UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+(\w+)\s*\(([^)]+)\)/gi;
    let match;

    while ((match = indexRegex.exec(sourceCode)) !== null) {
      const [, uniqueKeyword, indexName, table, columns] = match;

      if (table === tableName) {
        const columnList = columns
          .split(',')
          .map((col) => col.trim().replace(/\s+(ASC|DESC)$/i, ''));

        indexes.push({
          name: indexName,
          columns: columnList,
          unique: !!uniqueKeyword,
        });
      }
    }

    return indexes;
  }

  /**
   * Infer relationships from foreign keys
   */
  private inferRelationships(
    tableName: string,
    foreignKeys: ForeignKeyDefinition[]
  ): RelationshipDefinition[] {
    return foreignKeys.map((fk) => ({
      type: 'one-to-many' as const,
      fromTable: tableName,
      toTable: fk.referencesTable,
      foreignKey: fk.columnName,
    }));
  }
}
