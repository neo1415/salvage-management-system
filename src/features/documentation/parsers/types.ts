/**
 * Core types for the documentation parser system
 * These types define the structured output from parsing different file types
 */

// ============================================================================
// TypeScript AST Types
// ============================================================================

export interface ImportStatement {
  from: string;
  imports: string[];
  isDefault: boolean;
  isNamespace: boolean;
}

export interface ExportStatement {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'default';
  isDefault: boolean;
}

export interface ParameterDefinition {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

export interface FunctionDefinition {
  name: string;
  parameters: ParameterDefinition[];
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
  documentation?: string;
}

export interface PropertyDefinition {
  name: string;
  type: string;
  optional: boolean;
  readonly: boolean;
}

export interface ClassDefinition {
  name: string;
  properties: PropertyDefinition[];
  methods: FunctionDefinition[];
  isExported: boolean;
  extendsClass?: string;
  implementsInterfaces: string[];
  documentation?: string;
}

export interface InterfaceDefinition {
  name: string;
  properties: PropertyDefinition[];
  methods: FunctionDefinition[];
  isExported: boolean;
  extendsInterfaces: string[];
  documentation?: string;
}

export interface TypeDefinition {
  name: string;
  definition: string;
  isExported: boolean;
  documentation?: string;
}

export interface ConstantDefinition {
  name: string;
  type: string;
  value?: string;
  isExported: boolean;
}

export interface TypeScriptAST {
  filePath: string;
  imports: ImportStatement[];
  exports: ExportStatement[];
  functions: FunctionDefinition[];
  classes: ClassDefinition[];
  interfaces: InterfaceDefinition[];
  types: TypeDefinition[];
  constants: ConstantDefinition[];
}

// ============================================================================
// Database Schema Types
// ============================================================================

export interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isUnique: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export interface ForeignKeyDefinition {
  columnName: string;
  referencesTable: string;
  referencesColumn: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface EnumDefinition {
  name: string;
  values: string[];
}

export interface RelationshipDefinition {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  fromTable: string;
  toTable: string;
  foreignKey: string;
}

export interface SchemaDefinition {
  filePath: string;
  tableName: string;
  columns: ColumnDefinition[];
  primaryKey: string[];
  foreignKeys: ForeignKeyDefinition[];
  indexes: IndexDefinition[];
  enums: EnumDefinition[];
  relationships: RelationshipDefinition[];
}

// ============================================================================
// API Route Types
// ============================================================================

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface AuthRequirement {
  required: boolean;
  type?: 'session' | 'token' | 'api-key';
}

export interface RoleRequirement {
  roles: string[];
  requireAll: boolean;
}

export interface SchemaReference {
  type: string;
  description?: string;
}

export interface HandlerDefinition {
  method: HTTPMethod;
  functionName: string;
  hasAuth: boolean;
  hasRoleCheck: boolean;
  roles: string[];
}

export interface APIRouteDefinition {
  filePath: string;
  path: string;
  methods: HTTPMethod[];
  handlers: HandlerDefinition[];
  middleware: string[];
  authentication: AuthRequirement;
  authorization: RoleRequirement[];
  requestSchema?: SchemaReference;
  responseSchema?: SchemaReference;
}

// ============================================================================
// React Component Types
// ============================================================================

export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface HookUsage {
  name: string;
  arguments: string[];
}

export interface StateDefinition {
  name: string;
  type: string;
  initialValue?: string;
}

export interface APICallReference {
  endpoint: string;
  method: HTTPMethod;
  location: string;
}

export interface ComponentDefinition {
  filePath: string;
  name: string;
  isDefaultExport: boolean;
  props: PropDefinition[];
  hooks: HookUsage[];
  stateVariables: StateDefinition[];
  apiCalls: APICallReference[];
  childComponents: string[];
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface DependencyInfo {
  name: string;
  version: string;
  isDev: boolean;
}

export interface EnvironmentVariable {
  name: string;
  description?: string;
  required: boolean;
  defaultValue?: string;
}

export interface ConfigDefinition {
  filePath: string;
  type: 'package' | 'next' | 'env' | 'middleware' | 'other';
  dependencies?: DependencyInfo[];
  environmentVariables?: EnvironmentVariable[];
  configuration?: Record<string, unknown>;
}

// ============================================================================
// Parser Error Types
// ============================================================================

export enum ParserErrorType {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PARSE_ERROR = 'PARSE_ERROR',
  INVALID_SYNTAX = 'INVALID_SYNTAX',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',
}

export interface ParserError {
  type: ParserErrorType;
  message: string;
  filePath: string;
  lineNumber?: number;
  context?: string;
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: ParserError;
}
