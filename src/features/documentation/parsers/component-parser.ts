/**
 * Component Parser for React Components
 * Extracts component information from React/Next.js component files
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import {
  ComponentDefinition,
  PropDefinition,
  HookUsage,
  StateDefinition,
  APICallReference,
  HTTPMethod,
  ParseResult,
  ParserErrorType,
} from './types';

export class ComponentParser {
  /**
   * Parse a React component file and extract component information
   */
  async parseComponent(filePath: string): Promise<ParseResult<ComponentDefinition>> {
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

      // Extract component information
      const componentInfo = this.extractComponentInfo(sourceFile, sourceCode);

      if (!componentInfo) {
        return {
          success: false,
          error: {
            type: ParserErrorType.PARSE_ERROR,
            message: 'No React component found in file',
            filePath,
          },
        };
      }

      const definition: ComponentDefinition = {
        filePath,
        name: componentInfo.name,
        isDefaultExport: componentInfo.isDefaultExport,
        props: componentInfo.props,
        hooks: this.extractHooks(sourceFile, sourceCode),
        stateVariables: this.extractStateVariables(sourceFile, sourceCode),
        apiCalls: this.extractAPICallsFromCode(sourceCode),
        childComponents: this.extractChildComponents(sourceFile, sourceCode),
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
   * Extract component name and props
   */
  private extractComponentInfo(
    sourceFile: ts.SourceFile,
    _sourceCode: string
  ): {
    name: string;
    isDefaultExport: boolean;
    props: PropDefinition[];
  } | null {
    let componentInfo: {
      name: string;
      isDefaultExport: boolean;
      props: PropDefinition[];
    } | null = null;

    const visit = (node: ts.Node) => {
      // Function component
      if (ts.isFunctionDeclaration(node) && node.name) {
        const isExported = node.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
        );

        if (isExported) {
          const name = node.name.text;
          const props = this.extractPropsFromFunction(node, sourceFile);

          componentInfo = {
            name,
            isDefaultExport: false,
            props,
          };
        }
      }

      // Arrow function component (const Component = () => {})
      if (ts.isVariableStatement(node)) {
        const isExported = node.modifiers?.some(
          (mod) => mod.kind === ts.SyntaxKind.ExportKeyword
        );

        if (isExported) {
          node.declarationList.declarations.forEach((decl) => {
            if (
              ts.isIdentifier(decl.name) &&
              decl.initializer &&
              ts.isArrowFunction(decl.initializer)
            ) {
              const name = decl.name.text;
              const props = this.extractPropsFromArrowFunction(
                decl.initializer,
                sourceFile
              );

              componentInfo = {
                name,
                isDefaultExport: false,
                props,
              };
            }
          });
        }
      }

      // Default export
      if (ts.isExportAssignment(node) && !node.isExportEquals) {
        // Try to find the component name from the expression
        if (ts.isIdentifier(node.expression)) {
          const name = node.expression.text;
          componentInfo = {
            name,
            isDefaultExport: true,
            props: [],
          };
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return componentInfo;
  }

  /**
   * Extract props from function component
   */
  private extractPropsFromFunction(
    node: ts.FunctionDeclaration,
    sourceFile: ts.SourceFile
  ): PropDefinition[] {
    const props: PropDefinition[] = [];

    if (node.parameters.length > 0) {
      const propsParam = node.parameters[0];

      // Check if props parameter has a type annotation
      if (propsParam.type) {
        if (ts.isTypeLiteralNode(propsParam.type)) {
          // Inline type: function Component({ prop1, prop2 }: { prop1: string; prop2: number })
          propsParam.type.members.forEach((member) => {
            if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
              props.push({
                name: member.name.text,
                type: member.type ? member.type.getText(sourceFile) : 'any',
                required: !member.questionToken,
              });
            }
          });
        } else if (ts.isTypeReferenceNode(propsParam.type)) {
          // Type reference: function Component(props: ComponentProps)
          // We can't resolve the type here without type checking, so just note it
          props.push({
            name: 'props',
            type: propsParam.type.getText(sourceFile),
            required: true,
          });
        }
      }

      // Check for destructured props
      if (ts.isObjectBindingPattern(propsParam.name)) {
        propsParam.name.elements.forEach((element) => {
          if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
            props.push({
              name: element.name.text,
              type: 'any',
              required: !element.dotDotDotToken,
              defaultValue: element.initializer?.getText(sourceFile),
            });
          }
        });
      }
    }

    return props;
  }

  /**
   * Extract props from arrow function component
   */
  private extractPropsFromArrowFunction(
    node: ts.ArrowFunction,
    sourceFile: ts.SourceFile
  ): PropDefinition[] {
    const props: PropDefinition[] = [];

    if (node.parameters.length > 0) {
      const propsParam = node.parameters[0];

      // Check if props parameter has a type annotation
      if (propsParam.type) {
        if (ts.isTypeLiteralNode(propsParam.type)) {
          propsParam.type.members.forEach((member) => {
            if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
              props.push({
                name: member.name.text,
                type: member.type ? member.type.getText(sourceFile) : 'any',
                required: !member.questionToken,
              });
            }
          });
        } else if (ts.isTypeReferenceNode(propsParam.type)) {
          props.push({
            name: 'props',
            type: propsParam.type.getText(sourceFile),
            required: true,
          });
        }
      }

      // Check for destructured props
      if (ts.isObjectBindingPattern(propsParam.name)) {
        propsParam.name.elements.forEach((element) => {
          if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
            props.push({
              name: element.name.text,
              type: 'any',
              required: !element.dotDotDotToken,
              defaultValue: element.initializer?.getText(sourceFile),
            });
          }
        });
      }
    }

    return props;
  }

  /**
   * Extract React hooks usage
   */
  private extractHooks(sourceFile: ts.SourceFile, sourceCode: string): HookUsage[] {
    const hooks: HookUsage[] = [];

    // Common React hooks
    const hookPatterns = [
      /use(State|Effect|Context|Reducer|Callback|Memo|Ref|ImperativeHandle|LayoutEffect|DebugValue)\(/g,
      /use[A-Z]\w+\(/g, // Custom hooks
    ];

    hookPatterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(sourceCode)) !== null) {
        const hookName = match[0].slice(0, -1); // Remove the opening parenthesis

        // Try to extract arguments (simplified)
        const argsStart = match.index + match[0].length;
        const argsEnd = sourceCode.indexOf(')', argsStart);
        const argsText = sourceCode.substring(argsStart, argsEnd);

        hooks.push({
          name: hookName,
          arguments: [argsText],
        });
      }
    });

    return hooks;
  }

  /**
   * Extract state variables from useState hooks
   */
  private extractStateVariables(
    _sourceFile: ts.SourceFile,
    sourceCode: string
  ): StateDefinition[] {
    const stateVariables: StateDefinition[] = [];

    // Look for useState patterns: const [state, setState] = useState(initialValue)
    const useStatePattern = /const\s*\[(\w+),\s*\w+\]\s*=\s*useState(?:<([^>]+)>)?\(([^)]*)\)/g;
    let match;

    while ((match = useStatePattern.exec(sourceCode)) !== null) {
      const [, stateName, type, initialValue] = match;

      stateVariables.push({
        name: stateName,
        type: type || 'any',
        initialValue: initialValue || undefined,
      });
    }

    return stateVariables;
  }

  /**
   * Extract API calls from the component code
   */
  private extractAPICallsFromCode(sourceCode: string): APICallReference[] {
    const apiCalls: APICallReference[] = [];

    // Look for fetch calls
    const fetchPattern = /fetch\(['"`]([^'"`]+)['"`](?:,\s*\{[^}]*method:\s*['"`](\w+)['"`])?/g;
    let match;

    while ((match = fetchPattern.exec(sourceCode)) !== null) {
      const [, endpoint, method] = match;

      apiCalls.push({
        endpoint,
        method: (method?.toUpperCase() as HTTPMethod) || 'GET',
        location: 'fetch',
      });
    }

    // Look for axios calls
    const axiosPattern = /axios\.(get|post|put|patch|delete)\(['"`]([^'"`]+)['"`]/g;
    while ((match = axiosPattern.exec(sourceCode)) !== null) {
      const [, method, endpoint] = match;

      apiCalls.push({
        endpoint,
        method: method.toUpperCase() as HTTPMethod,
        location: 'axios',
      });
    }

    return apiCalls;
  }

  /**
   * Extract child components used in the component
   */
  private extractChildComponents(
    sourceFile: ts.SourceFile,
    _sourceCode: string
  ): string[] {
    const childComponents = new Set<string>();

    // Look for JSX elements
    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tagName = node.tagName.getText(sourceFile);

        // Only include components (start with uppercase)
        if (tagName[0] === tagName[0].toUpperCase()) {
          childComponents.add(tagName);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return Array.from(childComponents);
  }
}
