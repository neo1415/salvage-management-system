# Design Document: Comprehensive Application Documentation System

## Overview

This design document outlines the architecture for a comprehensive documentation generation system that systematically audits the salvage management and insurance auction platform codebase. The system will read actual production code (not specs or design documents) to generate accurate, IT-review-ready documentation covering all aspects of the application.

**Key Principle**: READ ACTUAL CODE, NOT DOCS/SPECS/SCRIPTS. The system must distinguish between:
- Production code in `src/` (what's actually used)
- Scripts in `scripts/` (diagnostic tools, not part of app)
- Docs in `docs/` (historical, may be outdated)
- Tests (not production features)

**Critical User Requirements**:
- "Make sure what you are reading is what is actually used"
- "There are scripts and docs that are not actually part of the app itself"
- "Some files may even no longer be in use - it's part of your job to discern"
- "For KYC: using Dojah with normal KYC system as fallback - be careful"

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Documentation Generator                     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Codebase   │  │   Analysis   │  │ Documentation│     │
│  │   Scanner    │─▶│   Engine     │─▶│   Generator  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   File       │  │   Parser     │  │    Pretty    │     │
│  │  Inventory   │  │   System     │  │   Printer    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Verification & Validation Layer            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

The system consists of five major components:

1. **Codebase Scanner**: Discovers and inventories all source files
2. **Parser System**: Extracts structured information from code files
3. **Analysis Engine**: Traces usage, identifies active code, builds relationships
4. **Documentation Generator**: Produces formatted documentation
5. **Verification Layer**: Validates accuracy through round-trip testing

## Components and Interfaces

### 1. Codebase Scanner

**Purpose**: Systematically discover all source files and create a structured inventory.

**Interface**:
```typescript
interface CodebaseScanner {
  scanDirectory(path: string, options: ScanOptions): Promise<FileInventory>;
  categorizeFiles(files: string[]): CategorizedFiles;
  identifyActiveCode(files: string[]): Promise<ActiveCodeMap>;
}

interface ScanOptions {
  includePatterns: string[];  // e.g., ['src/**/*.ts', 'src/**/*.tsx']
  excludePatterns: string[];  // e.g., ['scripts/**', 'docs/**', 'tests/**']
  followImports: boolean;     // Trace import chains to verify usage
}

interface FileInventory {
  productionCode: FileEntry[];
  schemaFiles: FileEntry[];
  apiRoutes: FileEntry[];
  components: FileEntry[];
  services: FileEntry[];
  utilities: FileEntry[];
  configurations: FileEntry[];
  migrations: FileEntry[];
}

interface FileEntry {
  path: string;
  type: FileType;
  size: number;
  lastModified: Date;
  isActive: boolean;        // Verified through import tracing
  importedBy: string[];     // Files that import this file
  imports: string[];        // Files this file imports
}

type FileType = 
  | 'api-route' 
  | 'component' 
  | 'service' 
  | 'schema' 
  | 'migration' 
  | 'utility' 
  | 'config' 
  | 'hook'
  | 'type-definition';
```

**Key Responsibilities**:
- Recursively scan `src/` directory
- Categorize files by type and purpose
- Build import dependency graph
- Identify active vs abandoned code through import tracing
- Exclude scripts, docs, and test files from production inventory

**Active Code Detection Strategy**:
1. Start from entry points (pages, API routes, middleware)
2. Follow import chains recursively
3. Mark all imported files as "active"
4. Files not in the import chain are "potentially abandoned"
5. Verify database schema usage by checking if tables are referenced in services

### 2. Parser System

**Purpose**: Extract structured information from different file types.

**Interface**:
```typescript
interface ParserSystem {
  parseTypeScript(filePath: string): Promise<TypeScriptAST>;
  parseSchema(filePath: string): Promise<SchemaDefinition>;
  parseAPIRoute(filePath: string): Promise<APIRouteDefinition>;
  parseComponent(filePath: string): Promise<ComponentDefinition>;
  parseConfig(filePath: string): Promise<ConfigDefinition>;
}

interface TypeScriptAST {
  imports: ImportStatement[];
  exports: ExportStatement[];
  functions: FunctionDefinition[];
  classes: ClassDefinition[];
  interfaces: InterfaceDefinition[];
  types: TypeDefinition[];
  constants: ConstantDefinition[];
}

interface SchemaDefinition {
  tableName: string;
  columns: ColumnDefinition[];
  primaryKey: string[];
  foreignKeys: ForeignKeyDefinition[];
  indexes: IndexDefinition[];
  enums: EnumDefinition[];
  relationships: RelationshipDefinition[];
}

interface APIRouteDefinition {
  path: string;
  methods: HTTPMethod[];
  handlers: HandlerDefinition[];
  middleware: string[];
  authentication: AuthRequirement;
  authorization: RoleRequirement[];
  requestSchema: SchemaReference;
  responseSchema: SchemaReference;
}

interface ComponentDefinition {
  name: string;
  props: PropDefinition[];
  hooks: HookUsage[];
  stateVariables: StateDefinition[];
  apiCalls: APICallReference[];
  childComponents: string[];
}
```

**Parser Implementations**:

1. **TypeScript Parser**: Uses TypeScript Compiler API to parse `.ts` and `.tsx` files
2. **Schema Parser**: Parses Drizzle ORM schema definitions
3. **API Route Parser**: Extracts Next.js App Router route handlers
4. **Component Parser**: Analyzes React components for props, hooks, and interactions
5. **Config Parser**: Parses configuration files (package.json, next.config.ts, etc.)

### 3. Analysis Engine

**Purpose**: Build relationships, trace data flows, and identify patterns.

**Interface**:
```typescript
interface AnalysisEngine {
  traceUserFlow(startPoint: string, role: UserRole): Promise<UserFlowTrace>;
  traceDataFlow(feature: string): Promise<DataFlowDiagram>;
  identifyIntegrations(): Promise<IntegrationMap>;
  buildDependencyGraph(): Promise<DependencyGraph>;
  analyzeSecurityPatterns(): Promise<SecurityAnalysis>;
  detectFeatureUsage(feature: string): Promise<FeatureUsageReport>;
}

interface UserFlowTrace {
  role: UserRole;
  flowName: string;
  steps: FlowStep[];
  uiInteractions: UIInteraction[];
  apiCalls: APICall[];
  databaseOperations: DatabaseOperation[];
  notifications: NotificationTrigger[];
}

interface FlowStep {
  stepNumber: number;
  description: string;
  component: string;
  action: string;
  nextStep: number | null;
}

interface DataFlowDiagram {
  feature: string;
  entryPoint: string;
  stages: DataFlowStage[];
  transformations: DataTransformation[];
  validationPoints: ValidationPoint[];
  persistencePoints: PersistencePoint[];
}

interface IntegrationMap {
  integrations: ExternalIntegration[];
}

interface ExternalIntegration {
  name: string;
  provider: string;
  purpose: string;
  authMethod: string;
  endpoints: string[];
  usedInFiles: string[];
  fallbackStrategy: string | null;
  errorHandling: string;
}
```

**Key Analysis Capabilities**:

1. **Import Tracing**: Follow import chains to verify code is actually used
2. **User Flow Tracing**: Start from a page/component, trace through all interactions
3. **Data Flow Analysis**: Track data from UI input → validation → service → database
4. **Integration Detection**: Identify external service usage patterns
5. **Security Pattern Recognition**: Detect auth, authorization, validation patterns
6. **Feature Usage Detection**: Determine if a feature is actually integrated

**KYC System Analysis Example**:
```typescript
// The engine must detect:
// 1. Dojah is PRIMARY (check src/features/kyc/services/dojah.service.ts)
// 2. Normal KYC is FALLBACK (check src/features/kyc/services/)
// 3. Trace actual usage in API routes and components
// 4. Verify which system is called first in the flow
```

### 4. Documentation Generator

**Purpose**: Transform analyzed data into formatted documentation.

**Interface**:
```typescript
interface DocumentationGenerator {
  generateExecutiveSummary(analysis: CompleteAnalysis): Promise<string>;
  generateTechStackDoc(analysis: CompleteAnalysis): Promise<string>;
  generateArchitectureDoc(analysis: CompleteAnalysis): Promise<string>;
  generateDatabaseDoc(schemas: SchemaDefinition[]): Promise<string>;
  generateAPIDoc(routes: APIRouteDefinition[]): Promise<string>;
  generateFeatureDoc(feature: string, analysis: FeatureAnalysis): Promise<string>;
  generateUserRoleDoc(role: UserRole, flows: UserFlowTrace[]): Promise<string>;
  generateSecurityDoc(security: SecurityAnalysis): Promise<string>;
  generateIntegrationDoc(integrations: IntegrationMap): Promise<string>;
  generateCompleteDoc(analysis: CompleteAnalysis): Promise<string>;
}

interface CompleteAnalysis {
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
```

**Documentation Structure**:

```markdown
# Comprehensive Application Documentation

## Executive Summary
- Application Overview
- Key Features
- Technology Stack Summary
- User Roles Summary
- Metrics (LOC, endpoints, tables, etc.)

## 1. Technology Stack
### 1.1 Core Technologies
### 1.2 Frontend Stack
### 1.3 Backend Stack
### 1.4 Database & ORM
### 1.5 External Integrations

## 2. Project Structure
### 2.1 Directory Organization
### 2.2 Naming Conventions
### 2.3 Code Organization Patterns

## 3. Database Architecture
### 3.1 Schema Overview
### 3.2 Table Definitions
### 3.3 Relationships
### 3.4 Indexes & Performance
### 3.5 Migrations

## 4. Authentication & Authorization
### 4.1 Authentication Flow
### 4.2 User Roles
### 4.3 Permission System
### 4.4 Session Management

## 5. API Architecture
### 5.1 API Overview
### 5.2 Endpoint Catalog (by feature)
### 5.3 Webhook Endpoints
### 5.4 Cron Job Endpoints

## 6. Feature Modules
### 6.1 Case Management
### 6.2 Auction System
### 6.3 Payment Processing
### 6.4 Vendor Management
### 6.5 KYC Verification
### 6.6 AI Integration
### 6.7 Intelligence & Fraud Detection
### 6.8 Reporting System
### 6.9 Notification System
### 6.10 Document Management

## 7. User Roles & Capabilities
### 7.1 System Admin
### 7.2 Salvage Manager
### 7.3 Case Adjuster
### 7.4 Finance Officer
### 7.5 Vendor

## 8. Complete User Flows
### 8.1 Admin Flows
### 8.2 Manager Flows
### 8.3 Adjuster Flows
### 8.4 Finance Flows
### 8.5 Vendor Flows

## 9. Real-Time Features
### 9.1 Socket.IO Architecture
### 9.2 Real-Time Bidding
### 9.3 Live Notifications

## 10. External Integrations
### 10.1 Payment (Paystack)
### 10.2 Storage (Cloudinary)
### 10.3 AI (Gemini, Claude)
### 10.4 KYC (Dojah)
### 10.5 Communications (Resend, Termii)

## 11. Security Implementation
### 11.1 Authentication Security
### 11.2 Authorization Patterns
### 11.3 Data Protection
### 11.4 API Security

## 12. Performance Optimization
### 12.1 Caching Strategy
### 12.2 Database Optimization
### 12.3 Image Optimization

## 13. Background Tasks
### 13.1 Cron Jobs
### 13.2 Scheduled Tasks

## 14. Testing Strategy
### 14.1 Unit Tests
### 14.2 Integration Tests
### 14.3 E2E Tests

## 15. Deployment & Infrastructure
### 15.1 Deployment Platform
### 15.2 Environment Configuration
### 15.3 CI/CD Pipeline

## Appendices
### A. Glossary
### B. File Path Reference
### C. API Endpoint Index
### D. Database Table Index
```

### 5. Verification Layer

**Purpose**: Ensure documentation accuracy through validation and round-trip testing.

**Interface**:
```typescript
interface VerificationLayer {
  verifyFileExists(path: string): Promise<boolean>;
  verifyAPIEndpointImplemented(endpoint: string): Promise<boolean>;
  verifyDatabaseTableExists(tableName: string): Promise<boolean>;
  verifyImportChain(from: string, to: string): Promise<boolean>;
  verifyFeatureIntegration(feature: string): Promise<IntegrationStatus>;
  performRoundTripTest(sourceFile: string): Promise<RoundTripResult>;
}

interface IntegrationStatus {
  feature: string;
  isIntegrated: boolean;
  usedInFiles: string[];
  apiEndpoints: string[];
  databaseTables: string[];
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
}

interface RoundTripResult {
  success: boolean;
  originalData: any;
  parsedData: any;
  prettyPrinted: string;
  reparsedData: any;
  differences: string[];
}
```

**Verification Strategies**:

1. **File Existence Verification**: Check all referenced paths exist
2. **API Endpoint Verification**: Verify route files exist and export handlers
3. **Database Table Verification**: Check schema files for table definitions
4. **Import Chain Verification**: Trace imports to confirm usage
5. **Feature Integration Verification**: Check if feature is actually wired up
6. **Round-Trip Testing**: Parse → Pretty Print → Parse → Compare

**Feature Integration Verification Example**:
```typescript
// To verify Dojah KYC is actually used:
// 1. Check src/features/kyc/services/dojah.service.ts exists
// 2. Find API routes that import dojah.service
// 3. Find components that call those API routes
// 4. Trace from vendor KYC page to Dojah service
// 5. Verify environment variables are configured
// 6. Check if there's a fallback system
```

## Data Models

### Core Data Structures

```typescript
// File Inventory
interface FileInventory {
  totalFiles: number;
  productionFiles: number;
  scriptFiles: number;
  testFiles: number;
  docFiles: number;
  categorizedFiles: CategorizedFiles;
  activeCodeMap: ActiveCodeMap;
}

interface CategorizedFiles {
  apiRoutes: FileEntry[];
  components: FileEntry[];
  services: FileEntry[];
  schemas: FileEntry[];
  migrations: FileEntry[];
  hooks: FileEntry[];
  utilities: FileEntry[];
  configurations: FileEntry[];
}

interface ActiveCodeMap {
  [filePath: string]: {
    isActive: boolean;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    importedBy: string[];
    usedInFeatures: string[];
  };
}

// Database Analysis
interface DatabaseAnalysis {
  tables: TableInfo[];
  relationships: Relationship[];
  indexes: IndexInfo[];
  migrations: MigrationInfo[];
  enums: EnumInfo[];
  materializedViews: MaterializedViewInfo[];
}

interface TableInfo {
  name: string;
  schema: string;
  columns: ColumnInfo[];
  primaryKey: string[];
  foreignKeys: ForeignKeyInfo[];
  indexes: string[];
  usedInServices: string[];
  usedInAPIRoutes: string[];
}

// Feature Analysis
interface FeatureAnalysis {
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

// User Role Analysis
interface RoleAnalysis {
  role: UserRole;
  accessiblePages: PageAccess[];
  availableActions: ActionDefinition[];
  apiEndpoints: APIAccess[];
  userFlows: UserFlowTrace[];
  permissions: Permission[];
}

interface PageAccess {
  path: string;
  component: string;
  description: string;
  requiredPermissions: string[];
}

interface APIAccess {
  endpoint: string;
  methods: HTTPMethod[];
  purpose: string;
  requiredRole: UserRole[];
}
```

## Error Handling

### Error Types

```typescript
enum DocumentationError {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PARSE_ERROR = 'PARSE_ERROR',
  INVALID_SYNTAX = 'INVALID_SYNTAX',
  IMPORT_RESOLUTION_FAILED = 'IMPORT_RESOLUTION_FAILED',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  INCOMPLETE_ANALYSIS = 'INCOMPLETE_ANALYSIS',
}

interface DocumentationErrorDetails {
  type: DocumentationError;
  message: string;
  filePath?: string;
  lineNumber?: number;
  context?: string;
  suggestion?: string;
}
```

### Error Handling Strategy

1. **Graceful Degradation**: If a file can't be parsed, document what was attempted
2. **Partial Documentation**: Generate documentation for successfully analyzed parts
3. **Error Reporting**: Include a section listing all errors encountered
4. **Confidence Levels**: Mark sections with confidence levels (high/medium/low)
5. **Manual Review Flags**: Flag areas requiring manual verification

### Error Recovery

```typescript
interface ErrorRecovery {
  attemptAlternativeParser(filePath: string): Promise<ParseResult>;
  skipFileAndContinue(filePath: string, reason: string): void;
  markForManualReview(section: string, reason: string): void;
  generatePartialDocumentation(availableData: Partial<CompleteAnalysis>): string;
}
```

## Testing Strategy

### Unit Testing

**Test Coverage**:
- Parser functions for each file type
- Analysis engine functions
- Documentation generator functions
- Verification functions

**Example Tests**:
```typescript
describe('TypeScript Parser', () => {
  it('should extract function signatures from a service file', async () => {
    const ast = await parser.parseTypeScript('src/features/cases/services/case.service.ts');
    expect(ast.functions).toContainEqual(
      expect.objectContaining({
        name: 'createCase',
        parameters: expect.any(Array),
        returnType: expect.any(String),
      })
    );
  });

  it('should identify imports correctly', async () => {
    const ast = await parser.parseTypeScript('src/features/cases/services/case.service.ts');
    expect(ast.imports).toContain(
      expect.objectContaining({
        from: '@/lib/db',
        imports: expect.arrayContaining(['db']),
      })
    );
  });
});

describe('Active Code Detection', () => {
  it('should mark files imported from API routes as active', async () => {
    const activeMap = await scanner.identifyActiveCode(['src/**/*.ts']);
    expect(activeMap['src/features/cases/services/case.service.ts'].isActive).toBe(true);
    expect(activeMap['src/features/cases/services/case.service.ts'].confidence).toBe('high');
  });

  it('should mark files not in import chain as potentially abandoned', async () => {
    const activeMap = await scanner.identifyActiveCode(['src/**/*.ts']);
    const abandonedFiles = Object.entries(activeMap)
      .filter(([_, info]) => !info.isActive)
      .map(([path, _]) => path);
    expect(abandonedFiles.length).toBeGreaterThanOrEqual(0);
  });
});

describe('Feature Integration Verification', () => {
  it('should correctly identify Dojah as primary KYC system', async () => {
    const kycAnalysis = await analyzer.analyzeFeature('kyc');
    expect(kycAnalysis.primaryIntegration).toBe('dojah');
    expect(kycAnalysis.fallbackIntegration).toBe('manual-kyc');
  });

  it('should trace KYC flow from vendor page to Dojah service', async () => {
    const flow = await analyzer.traceUserFlow('src/app/(dashboard)/vendor/kyc/tier2/page.tsx', 'vendor');
    expect(flow.apiCalls).toContainEqual(
      expect.objectContaining({
        endpoint: '/api/kyc/complete',
        service: 'dojah.service.ts',
      })
    );
  });
});
```

### Integration Testing

**Test Scenarios**:
1. End-to-end documentation generation for a small subset of files
2. Verification of generated documentation against actual codebase
3. Round-trip testing: parse → pretty print → parse → compare

```typescript
describe('Documentation Generation Integration', () => {
  it('should generate complete documentation for case management feature', async () => {
    const analysis = await analyzer.analyzeFeature('cases');
    const doc = await generator.generateFeatureDoc('cases', analysis);
    
    expect(doc).toContain('## Case Management');
    expect(doc).toContain('### Case Creation Workflow');
    expect(doc).toContain('### AI Assessment Integration');
    expect(doc).toMatch(/src\/features\/cases\/services\/case\.service\.ts/);
  });

  it('should verify all documented API endpoints exist', async () => {
    const analysis = await analyzer.analyzeComplete();
    const doc = await generator.generateCompleteDoc(analysis);
    
    const endpoints = extractEndpointsFromDoc(doc);
    for (const endpoint of endpoints) {
      const exists = await verifier.verifyAPIEndpointImplemented(endpoint);
      expect(exists).toBe(true);
    }
  });
});
```

### Round-Trip Property Testing

```typescript
describe('Round-Trip Properties', () => {
  it('should satisfy round-trip property for TypeScript parsing', async () => {
    const filePath = 'src/features/cases/services/case.service.ts';
    const result = await verifier.performRoundTripTest(filePath);
    
    expect(result.success).toBe(true);
    expect(result.differences).toHaveLength(0);
  });

  it('should satisfy round-trip property for schema parsing', async () => {
    const filePath = 'src/lib/db/schema/cases.ts';
    const result = await verifier.performRoundTripTest(filePath);
    
    expect(result.success).toBe(true);
    expect(result.differences).toHaveLength(0);
  });
});
```

## Implementation Phases

### Phase 1: Foundation (Codebase Scanner & Parser)

**Deliverables**:
1. File system scanner with categorization
2. TypeScript parser using TS Compiler API
3. Schema parser for Drizzle ORM
4. API route parser for Next.js App Router
5. Import dependency graph builder

**Validation**:
- Can scan entire `src/` directory
- Can parse all TypeScript files without errors
- Can extract all database tables from schema files
- Can identify all API routes

### Phase 2: Analysis Engine

**Deliverables**:
1. Active code detection through import tracing
2. User flow tracer
3. Data flow analyzer
4. Integration detector
5. Security pattern recognizer

**Validation**:
- Can correctly identify active vs abandoned code
- Can trace a complete user flow from page to database
- Can detect all external integrations
- Can identify authentication/authorization patterns

### Phase 3: Documentation Generator

**Deliverables**:
1. Executive summary generator
2. Tech stack documentation generator
3. Database documentation generator
4. API documentation generator
5. Feature documentation generator
6. User role documentation generator
7. Pretty printer for consistent formatting

**Validation**:
- Generates well-formatted Markdown
- Includes all required sections
- Cross-references are correct
- Code examples are properly formatted

### Phase 4: Verification & Polish

**Deliverables**:
1. File existence verifier
2. API endpoint verifier
3. Database table verifier
4. Feature integration verifier
5. Round-trip tester
6. Error reporting system

**Validation**:
- All file paths in documentation exist
- All API endpoints in documentation are implemented
- All database tables in documentation exist in schema
- Round-trip tests pass for all parsers
- Error report is comprehensive

### Phase 5: Complete Documentation Generation

**Deliverables**:
1. Complete documentation (5,000-10,000 lines)
2. Executive summary (2-3 pages)
3. Verification report
4. Error report (if any)
5. Confidence assessment

**Validation**:
- Documentation meets all requirements
- IT review-ready quality
- Accurate reflection of production codebase
- All special features documented (KYC with Dojah primary, AI with Claude/Gemini, etc.)

## Special Considerations

### 1. KYC System Documentation

**Critical Requirement**: Correctly identify Dojah as primary, manual KYC as fallback.

**Verification Steps**:
1. Read `src/features/kyc/services/dojah.service.ts`
2. Read `src/features/kyc/services/` for other KYC services
3. Trace API route `/api/kyc/complete` to see which service is called
4. Check vendor KYC pages to see which system is presented first
5. Document the actual flow, not the ideal flow

### 2. AI Integration Documentation

**Critical Requirement**: Correctly identify Claude as primary, Gemini as backup.

**Verification Steps**:
1. Read `src/features/cases/services/ai-assessment-enhanced.service.ts`
2. Check fallback chain implementation
3. Verify which AI is called first
4. Document cost optimization strategies (prompt caching)
5. Document mock mode for testing

### 3. Abandoned Code Detection

**Strategy**:
1. Build complete import graph starting from entry points
2. Mark all files in the graph as "active"
3. Files not in the graph are "potentially abandoned"
4. Check if "abandoned" files are referenced in comments or docs
5. Flag for manual review if uncertain

### 4. Script vs Production Code

**Distinction**:
- **Production Code**: In `src/`, imported by pages/API routes/components
- **Scripts**: In `scripts/`, used for diagnostics/maintenance, not part of app
- **Docs**: In `docs/`, historical documentation, may be outdated
- **Tests**: In `tests/`, test code, not production features

**Documentation Approach**:
- Focus on production code in `src/`
- Mention scripts only in "Development Tools" section
- Don't treat docs as source of truth
- Don't document test code as features

## Conclusion

This design provides a comprehensive architecture for generating accurate, IT-review-ready documentation by systematically auditing the actual production codebase. The system prioritizes reading real code over specifications, distinguishes active from abandoned code, and verifies accuracy through multiple validation strategies.

The key innovation is the **Active Code Detection** through import tracing, which ensures only actually-used code is documented, and the **Feature Integration Verification**, which confirms features are truly integrated (not just present in the codebase).

The documentation generated will be comprehensive (5,000-10,000 lines), accurate (verified through round-trip testing), and trustworthy (based on actual code, not specs).
