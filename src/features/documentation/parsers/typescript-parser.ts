/**
 * TypeScript Parser using TS Compiler API
 * Extracts structured information from TypeScript files
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import {
  TypeScriptAST,
  ImportStatement,
  ExportStatement,
  FunctionDefinition,
  ClassDefinition,
  InterfaceDefinition,
  TypeDefinition,
  ConstantDefinition,
  ParameterDefinition,
  PropertyDefinition,
  ParseResult,
  ParserErrorType,
} from './types';

export class TypeScriptParser {
  /**
   * Parse a TypeScript file and extract structured information
   */
  async parseTypeScript(filePath: string): Promise<ParseResult<TypeScriptAST>> {
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

      // Extract information
      const ast: TypeScriptAST = {
        filePath,
        imports: this.extractImports(sourceFile),
        exports: this.extractExports(sourceFile),
        functions: this.extractFunctions(sourceFile),
        classes: this.extractClasses(sourceFile),
        interfaces: this.extractInterfaces(sourceFile),
        types: this.extractTypes(sourceFile),
        constants: this.extractConstants(sourceFile),
      };

      return {
        success: true,
        data: ast,
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
   * Extract import statements
   */
  private extractImports(sourceFile: ts.SourceFile): ImportStatement[] {
    const imports: ImportStatement[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          const from = moduleSpecifier.text;
          const importClause = node.importClause;

          if (importClause) {
            // Default import
            if (importClause.name) {
              imports.push({
                from,
                imports: [importClause.name.text],
                isDefault: true,
                isNamespace: false,
              });
            }

            // Named imports
            if (importClause.namedBindings) {
              if (ts.isNamedImports(importClause.namedBindings)) {
                const namedImports = importClause.namedBindings.elements.map(
                  (element) => element.name.text
                );
                imports.push({
                  from,
                  imports: namedImports,
                  isDefault: false,
                  isNamespace: false,
                });
              }
              // Namespace import (import * as name)
              else if (ts.isNamespaceImport(importClause.namedBindings)) {
                imports.push({
                  from,
                  imports: [importClause.namedBindings.name.text],
                  isDefault: false,
                  isNamespace: true,
                });
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return imports;
  }

  /**
   * Extract export statements
   */
  private extractExports(sourceFile: ts.SourceFile): ExportStatement[] {
    const exports: ExportStatement[] = [];

    const visit = (node: ts.Node) => {
      // Check for export modifier using getCombinedModifierFlags
      const modifierFlags = ts.getCombinedModifierFlags(node as ts.Declaration);
      const hasExportModifier = (modifierFlags & ts.ModifierFlags.Export) !== 0;

      if (hasExportModifier || ts.isExportAssignment(node)) {
        if (ts.isFunctionDeclaration(node) && node.name) {
          exports.push({
            name: node.name.text,
            type: 'function',
            isDefault: false,
          });
        } else if (ts.isClassDeclaration(node) && node.name) {
          exports.push({
            name: node.name.text,
            type: 'class',
            isDefault: false,
          });
        } else if (ts.isInterfaceDeclaration(node)) {
          exports.push({
            name: node.name.text,
            type: 'interface',
            isDefault: false,
          });
        } else if (ts.isTypeAliasDeclaration(node)) {
          exports.push({
            name: node.name.text,
            type: 'type',
            isDefault: false,
          });
        } else if (ts.isVariableStatement(node)) {
          node.declarationList.declarations.forEach((decl) => {
            if (ts.isIdentifier(decl.name)) {
              exports.push({
                name: decl.name.text,
                type: 'const',
                isDefault: false,
              });
            }
          });
        }
      }

      // Export default
      if (ts.isExportAssignment(node) && !node.isExportEquals) {
        exports.push({
          name: 'default',
          type: 'default',
          isDefault: true,
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return exports;
  }

  /**
   * Extract function definitions
   */
  private extractFunctions(sourceFile: ts.SourceFile): FunctionDefinition[] {
    const functions: FunctionDefinition[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const isExported = node.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
        ) ?? false;

        const isAsync = node.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.AsyncKeyword
        ) ?? false;

        functions.push({
          name: node.name.text,
          parameters: this.extractParameters(node.parameters),
          returnType: node.type ? node.type.getText(sourceFile) : 'void',
          isAsync,
          isExported,
          documentation: this.extractJSDoc(node),
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return functions;
  }

  /**
   * Extract function parameters
   */
  private extractParameters(
    parameters: ts.NodeArray<ts.ParameterDeclaration>
  ): ParameterDefinition[] {
    return parameters.map((param) => ({
      name: param.name.getText(),
      type: param.type ? param.type.getText() : 'any',
      optional: !!param.questionToken,
      defaultValue: param.initializer?.getText(),
    }));
  }

  /**
   * Extract class definitions
   */
  private extractClasses(sourceFile: ts.SourceFile): ClassDefinition[] {
    const classes: ClassDefinition[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        const isExported = node.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
        ) ?? false;

        const extendsClass = node.heritageClauses
          ?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
          ?.types[0]?.expression.getText(sourceFile);

        const implementsInterfaces =
          node.heritageClauses
            ?.find((clause) => clause.token === ts.SyntaxKind.ImplementsKeyword)
            ?.types.map((type) => type.expression.getText(sourceFile)) ?? [];

        const properties: PropertyDefinition[] = [];
        const methods: FunctionDefinition[] = [];

        node.members.forEach((member) => {
          if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name)) {
            properties.push({
              name: member.name.text,
              type: member.type ? member.type.getText(sourceFile) : 'any',
              optional: !!member.questionToken,
              readonly: member.modifiers?.some(
                (mod) => mod.kind === ts.SyntaxKind.ReadonlyKeyword
              ) ?? false,
            });
          } else if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
            const isAsync = member.modifiers?.some(
              (mod) => mod.kind === ts.SyntaxKind.AsyncKeyword
            ) ?? false;

            methods.push({
              name: member.name.text,
              parameters: this.extractParameters(member.parameters),
              returnType: member.type ? member.type.getText(sourceFile) : 'void',
              isAsync,
              isExported: false,
              documentation: this.extractJSDoc(member),
            });
          }
        });

        classes.push({
          name: node.name.text,
          properties,
          methods,
          isExported,
          extendsClass,
          implementsInterfaces,
          documentation: this.extractJSDoc(node),
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return classes;
  }

  /**
   * Extract interface definitions
   */
  private extractInterfaces(sourceFile: ts.SourceFile): InterfaceDefinition[] {
    const interfaces: InterfaceDefinition[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isInterfaceDeclaration(node)) {
        const isExported = node.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
        ) ?? false;

        const extendsInterfaces =
          node.heritageClauses
            ?.flatMap((clause) =>
              clause.types.map((type) => type.expression.getText(sourceFile))
            ) ?? [];

        const properties: PropertyDefinition[] = [];
        const methods: FunctionDefinition[] = [];

        node.members.forEach((member) => {
          if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
            properties.push({
              name: member.name.text,
              type: member.type ? member.type.getText(sourceFile) : 'any',
              optional: !!member.questionToken,
              readonly: member.modifiers?.some(
                (mod) => mod.kind === ts.SyntaxKind.ReadonlyKeyword
              ) ?? false,
            });
          } else if (ts.isMethodSignature(member) && ts.isIdentifier(member.name)) {
            methods.push({
              name: member.name.text,
              parameters: this.extractParameters(member.parameters),
              returnType: member.type ? member.type.getText(sourceFile) : 'void',
              isAsync: false,
              isExported: false,
              documentation: this.extractJSDoc(member),
            });
          }
        });

        interfaces.push({
          name: node.name.text,
          properties,
          methods,
          isExported,
          extendsInterfaces,
          documentation: this.extractJSDoc(node),
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return interfaces;
  }

  /**
   * Extract type alias definitions
   */
  private extractTypes(sourceFile: ts.SourceFile): TypeDefinition[] {
    const types: TypeDefinition[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isTypeAliasDeclaration(node)) {
        const isExported = node.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
        ) ?? false;

        types.push({
          name: node.name.text,
          definition: node.type.getText(sourceFile),
          isExported,
          documentation: this.extractJSDoc(node),
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return types;
  }

  /**
   * Extract constant definitions
   */
  private extractConstants(sourceFile: ts.SourceFile): ConstantDefinition[] {
    const constants: ConstantDefinition[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isVariableStatement(node)) {
        const isExported = node.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
        ) ?? false;

        node.declarationList.declarations.forEach((decl) => {
          if (ts.isIdentifier(decl.name)) {
            constants.push({
              name: decl.name.text,
              type: decl.type ? decl.type.getText(sourceFile) : 'any',
              value: decl.initializer?.getText(sourceFile),
              isExported,
            });
          }
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return constants;
  }

  /**
   * Extract JSDoc comments
   */
  private extractJSDoc(node: ts.Node): string | undefined {
    const jsDocTags = (node as any).jsDoc;
    if (jsDocTags && jsDocTags.length > 0) {
      return jsDocTags[0].comment;
    }
    return undefined;
  }
}
