/**
 * Core TypeScript Types for Comprehensive Application Documentation System
 * 
 * This file defines all the core interfaces and types used throughout the
 * documentation generation system. The system is READ-ONLY and will not
 * modify any production code.
 */

// ============================================================================
// File System Types
// ============================================================================

export type FileType =
  | 'api-route'
  | 'component'
  | 'service'
  | 'schema'
  | 'migration'
  | 'utility'
  | 'config'
  | 'hook'
  | 'type-definition';

export interface FileEntry {
  path: string;
  type: FileType;
  size: number;
  lastModified: Date;
  isActive: boolean;
  importedBy: string[];
  imports: string[];
}

export interface ScanOptions {
  includePatterns: string[];
  excludePatterns: string[];
  followImports: boolean;
}

export interface FileInventory {
  totalFiles: number;
  productionFiles: number;
  scriptFiles: number;
  testFiles: number;
  docFiles: number;
  categorizedFiles: CategorizedFiles;
  activeCodeMap: ActiveCodeMap;
}

export interface CategorizedFiles {
  apiRoutes: FileEntry[];
  components: FileEntry[];
  services: FileEntry[];
  schemas: FileEntry[];
  migrations: FileEntry[];
  hooks: FileEntry[];
  utilities: FileEntry[];
  configurations: FileEntry[];
}

export interface ActiveCodeMap {
  [filePath: string]: {
    isActive: boolean;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    importedBy: string[];
    usedInFeatures: string[];
  };
}

// ============================================================================
// Parser Types
// ============================================================================

export interface ImportStatement {
  from: string;
  imports: string[];
  isTypeOnly: boolean;
}

export interface ExportStatement {
  name: string;
  type: 'function' | 'class' | 'interface' | 'type' | 'const';
  isDefault: boolean;
}

export interface FunctionDefinition {
  name: string;
  parameters: ParameterDefinition[];
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
  documentation?: string;
}

export interface ParameterDefinition {
  name: string;
  type: string;
  isOptional: boolean;
  defaultValue?: string;
}

export interface ClassDefinition {
  name: string;
  extends?: string;
  implements: string[];
  methods: MethodDefinition[];
  properties: PropertyDefinition[];
  isExported: boolean;
  documentation?: string;
}

export interface MethodDefinition {
  name: string;
  parameters: ParameterDefinition[];
  returnType: string;
  isAsync: boolean;
  isStatic: boolean;
  visibility: 'public' | 'private' | 'protected';
  documentation?: string;
}

export interface PropertyDefinition {
  name: string;
  type: string;
  isReadonly: boolean;
  isStatic: boolean;
  visibility: 'public' | 'private' | 'protected';
  defaultValue?: string;
}

export interface InterfaceDefinition {
  name: string;
  extends: string[];
  properties: InterfaceProperty[];
  isExported: boolean;
  documentation?: string;
}

export interface InterfaceProperty {
  name: string;
  type: string;
  isOptional: boolean;
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
  value: string;
  isExported: boolean;
}

export interface TypeScriptAST {
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
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  defaultValue?: string;
  constraints: string[];
}

export interface ForeignKeyDefinition {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  isUnique: boolean;
  type?: string;
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
  description?: string;
}

export interface SchemaDefinition {
  tableName: string;
  columns: ColumnDefinition[];
  primaryKey: string[];
  foreignKeys: ForeignKeyDefinition[];
  indexes: IndexDefinition[];
  enums: EnumDefinition[];
  relationships: RelationshipDefinition[];
}

export interface MaterializedViewInfo {
  name: string;
  definition: string;
  refreshStrategy: string;
  usedInFeatures: string[];
}

// ============================================================================
// API Route Types
// ============================================================================

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HandlerDefinition {
  method: HTTPMethod;
  functionName: string;
  parameters: ParameterDefinition[];
  returnType: string;
}

export interface AuthRequirement {
  required: boolean;
  provider?: string;
}

export interface RoleRequirement {
  role: string;
  description: string;
}

export interface SchemaReference {
  type: string;
  description?: string;
}

export interface APIRouteDefinition {
  path: string;
  methods: HTTPMethod[];
  handlers: HandlerDefinition[];
  middleware: string[];
  authentication: AuthRequirement;
  authorization: RoleRequirement[];
  requestSchema: SchemaReference;
  responseSchema: SchemaReference;
}

// ============================================================================
// Component Types
// ============================================================================

export interface PropDefinition {
  name: string;
  type: string;
  isOptional: boolean;
  defaultValue?: string;
  description?: string;
}

export interface HookUsage {
  hookName: string;
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
  purpose: string;
}

export interface ComponentDefinition {
  name: string;
  props: PropDefinition[];
  hooks: HookUsage[];
  stateVariables: StateDefinition[];
  apiCalls: APICallReference[];
  childComponents: string[];
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface ConfigDefinition {
  type: 'package' | 'next' | 'env' | 'middleware';
  data: Record<string, any>;
}

// ============================================================================
// Analysis Types
// ============================================================================

export interface FlowStep {
  stepNumber: number;
  description: string;
  component: string;
  action: string;
  nextStep: number | null;
}

export interface UIInteraction {
  component: string;
  action: string;
  triggersAPI?: string;
}

export interface APICall {
  endpoint: string;
  method: HTTPMethod;
  purpose: string;
  callsService?: string;
}

export interface DatabaseOperation {
  table: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  description: string;
}

export interface NotificationTrigger {
  type: 'email' | 'sms' | 'in-app' | 'push';
  recipient: string;
  template: string;
  trigger: string;
}

export interface UserFlowTrace {
  role: UserRole;
  flowName: string;
  steps: FlowStep[];
  uiInteractions: UIInteraction[];
  apiCalls: APICall[];
  databaseOperations: DatabaseOperation[];
  notifications: NotificationTrigger[];
}

export interface DataFlowStage {
  stageName: string;
  description: string;
  inputData: string;
  outputData: string;
  transformations: string[];
}

export interface DataTransformation {
  from: string;
  to: string;
  method: string;
  description: string;
}

export interface ValidationPoint {
  location: string;
  rules: string[];
  errorHandling: string;
}

export interface PersistencePoint {
  table: string;
  operation: string;
  data: string;
}

export interface DataFlowDiagram {
  feature: string;
  entryPoint: string;
  stages: DataFlowStage[];
  transformations: DataTransformation[];
  validationPoints: ValidationPoint[];
  persistencePoints: PersistencePoint[];
}

export interface ExternalIntegration {
  name: string;
  provider: string;
  purpose: string;
  authMethod: string;
  endpoints: string[];
  usedInFiles: string[];
  fallbackStrategy: string | null;
  errorHandling: string;
}

export interface IntegrationMap {
  integrations: ExternalIntegration[];
}

export interface SecurityAnalysis {
  authenticationPatterns: string[];
  authorizationPatterns: string[];
  inputValidation: string[];
  dataEncryption: string[];
  apiSecurity: string[];
}

export interface IntegrationStatus {
  feature: string;
  isIntegrated: boolean;
  usedInFiles: string[];
  apiEndpoints: string[];
  databaseTables: string[];
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
}

// ============================================================================
// Database Analysis Types
// ============================================================================

export interface TableInfo {
  name: string;
  schema: string;
  columns: ColumnInfo[];
  primaryKey: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: string[];
  usedInServices: string[];
  usedInAPIRoutes: string[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  defaultValue?: string;
  constraints: string[];
}

export interface ForeignKeyInfo {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface MigrationInfo {
  version: string;
  name: string;
  appliedAt: Date;
  description: string;
}

export interface EnumInfo {
  name: string;
  values: string[];
  usedInTables: string[];
}

export interface Relationship {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  fromTable: string;
  toTable: string;
  foreignKey: string;
  description?: string;
}

export interface DatabaseAnalysis {
  tables: TableInfo[];
  relationships: Relationship[];
  indexes: IndexDefinition[];
  migrations: MigrationInfo[];
  enums: EnumInfo[];
  materializedViews: MaterializedViewInfo[];
}

// ============================================================================
// Feature Analysis Types
// ============================================================================

export interface FeatureAnalysis {
  name: string;
  description: string;
  isActive: boolean;
  services: string[];
  apiRoutes: string[];
  components: string[];
  databaseTables: string[];
  externalIntegrations: string[];
  userRoles: UserRole[];
  dataFlow: DataFlowDiagram;
  securityMeasures: string[];
}

// ============================================================================
// User Role Types
// ============================================================================

export type UserRole = 'admin' | 'manager' | 'adjuster' | 'finance' | 'vendor';

export interface PageAccess {
  path: string;
  component: string;
  description: string;
  requiredPermissions: string[];
}

export interface ActionDefinition {
  name: string;
  description: string;
  requiredPermissions: string[];
}

export interface APIAccess {
  endpoint: string;
  methods: HTTPMethod[];
  purpose: string;
  requiredRole: UserRole[];
}

export interface Permission {
  name: string;
  description: string;
  scope: string;
}

export interface RoleAnalysis {
  role: UserRole;
  accessiblePages: PageAccess[];
  availableActions: ActionDefinition[];
  apiEndpoints: APIAccess[];
  userFlows: UserFlowTrace[];
  permissions: Permission[];
}

// ============================================================================
// Complete Analysis Types
// ============================================================================

export interface TechStackInfo {
  coreFrameworks: Record<string, string>;
  frontend: Record<string, string>;
  backend: Record<string, string>;
  database: Record<string, string>;
  externalServices: Record<string, string>;
}

export interface PerformanceAnalysis {
  cachingStrategies: string[];
  databaseOptimizations: string[];
  imageOptimizations: string[];
  paginationPatterns: string[];
}

export interface TestingAnalysis {
  unitTestFramework: string;
  integrationTestFramework: string;
  e2eTestFramework: string;
  testCoverage: number;
  testFiles: string[];
}

export interface CompleteAnalysis {
  inventory: FileInventory;
  techStack: TechStackInfo;
  database: DatabaseAnalysis;
  apiRoutes: APIRouteDefinition[];
  features: FeatureAnalysis[];
  userRoles: RoleAnalysis[];
  security: SecurityAnalysis;
  integrations: IntegrationMap;
  performance: PerformanceAnalysis;
  testing: TestingAnalysis;
}

// ============================================================================
// Documentation Generation Types
// ============================================================================

export interface DocumentationSection {
  title: string;
  content: string;
  subsections: DocumentationSection[];
}

export interface DocumentationMetadata {
  generatedAt: Date;
  version: string;
  totalLines: number;
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
}

export interface GeneratedDocumentation {
  metadata: DocumentationMetadata;
  executiveSummary: string;
  sections: DocumentationSection[];
  glossary: Record<string, string>;
  filePathIndex: string[];
  apiEndpointIndex: string[];
  databaseTableIndex: string[];
}

// ============================================================================
// Verification Types
// ============================================================================

export interface RoundTripResult {
  success: boolean;
  originalData: any;
  parsedData: any;
  prettyPrinted: string;
  reparsedData: any;
  differences: string[];
}

export interface VerificationReport {
  fileExistence: {
    total: number;
    verified: number;
    missing: string[];
  };
  apiEndpoints: {
    total: number;
    verified: number;
    missing: string[];
  };
  databaseTables: {
    total: number;
    verified: number;
    missing: string[];
  };
  featureIntegration: IntegrationStatus[];
  roundTripTests: {
    total: number;
    passed: number;
    failed: RoundTripResult[];
  };
}

// ============================================================================
// Error Types
// ============================================================================

export enum DocumentationError {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PARSE_ERROR = 'PARSE_ERROR',
  INVALID_SYNTAX = 'INVALID_SYNTAX',
  IMPORT_RESOLUTION_FAILED = 'IMPORT_RESOLUTION_FAILED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  INCOMPLETE_ANALYSIS = 'INCOMPLETE_ANALYSIS',
}

export interface DocumentationErrorDetails {
  type: DocumentationError;
  message: string;
  filePath?: string;
  lineNumber?: number;
  context?: string;
  suggestion?: string;
}

// ============================================================================
// Parser Result Types
// ============================================================================

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: DocumentationErrorDetails;
}

export interface ParsedFile {
  filePath: string;
  fileType: FileType;
  ast?: TypeScriptAST;
  schema?: SchemaDefinition;
  apiRoute?: APIRouteDefinition;
  component?: ComponentDefinition;
  config?: ConfigDefinition;
  parseErrors: DocumentationErrorDetails[];
}

// ============================================================================
// Analysis Result Types
// ============================================================================

export interface AnalysisResult {
  success: boolean;
  analysis?: CompleteAnalysis;
  errors: DocumentationErrorDetails[];
  warnings: string[];
}
