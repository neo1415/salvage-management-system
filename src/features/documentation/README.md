# Comprehensive Application Documentation System

## ⚠️ CRITICAL SAFETY GUARANTEE

**THIS SYSTEM IS READ-ONLY AND WILL NOT MODIFY YOUR CODEBASE**

- ✅ **ONLY READS**: Scans files, parses code, analyzes structure
- ❌ **NEVER WRITES**: No modifications to src/, no database changes, no code generation
- 📄 **OUTPUT**: Single documentation file only (in docs/ or root)

Your production code remains completely untouched. This is a passive documentation scanner, not a code modification tool.

---

## Overview

This directory contains the comprehensive application documentation generation system. The system systematically audits the salvage management and insurance auction platform codebase by reading actual production code (not specs or docs) to generate accurate, IT-review-ready documentation.

## Directory Structure

```
src/features/documentation/
├── README.md                    # This file
├── types/
│   └── index.ts                # Core TypeScript interfaces and types
├── scanner/
│   ├── codebase-scanner.ts     # File system scanner
│   ├── import-graph.ts         # Import dependency graph builder
│   └── active-code-detector.ts # Active vs abandoned code detection
├── parsers/
│   ├── typescript-parser.ts    # TypeScript AST parser
│   ├── schema-parser.ts        # Drizzle ORM schema parser
│   ├── api-route-parser.ts    # Next.js API route parser
│   ├── component-parser.ts     # React component parser
│   └── config-parser.ts        # Configuration file parser
├── analyzers/
│   ├── user-flow-tracer.ts     # User flow analysis
│   ├── data-flow-analyzer.ts   # Data flow analysis
│   ├── integration-detector.ts # External integration detection
│   ├── security-analyzer.ts    # Security pattern recognition
│   └── feature-detector.ts     # Feature usage detection
├── generators/
│   ├── executive-summary.ts    # Executive summary generator
│   ├── tech-stack.ts           # Technology stack documentation
│   ├── database-docs.ts        # Database schema documentation
│   ├── api-docs.ts             # API endpoint documentation
│   ├── feature-docs.ts         # Feature module documentation
│   ├── user-role-docs.ts       # User role documentation
│   └── complete-docs.ts        # Complete documentation orchestrator
├── verification/
│   ├── file-verifier.ts        # File existence verification
│   ├── api-verifier.ts         # API endpoint verification
│   ├── db-verifier.ts          # Database table verification
│   ├── integration-verifier.ts # Feature integration verification
│   └── round-trip-tester.ts    # Round-trip property testing
├── utils/
│   ├── pretty-printer.ts       # Markdown formatting
│   └── error-handler.ts        # Error handling utilities
└── index.ts                     # Main entry point

tests/unit/documentation/        # Unit tests
tests/integration/documentation/ # Integration tests
```

## Key Principles

### 1. Read Actual Code, Not Docs/Specs/Scripts

The system distinguishes between:
- **Production code** in `src/` (what's actually used)
- **Scripts** in `scripts/` (diagnostic tools, not part of app)
- **Docs** in `docs/` (historical, may be outdated)
- **Tests** (not production features)

### 2. Active Code Detection

The system uses import tracing to identify:
- **Active code**: Files in the import chain from entry points
- **Abandoned code**: Files not imported by any active code

### 3. Feature Integration Verification

The system verifies features are actually integrated by:
- Tracing from UI components to API routes to services
- Checking database table usage
- Identifying external service calls

### 4. Accuracy Through Verification

The system ensures accuracy through:
- File existence verification
- API endpoint verification
- Database table verification
- Round-trip property testing (parse → pretty print → parse → compare)

## Usage

### Generate Complete Documentation

```typescript
import { generateCompleteDocumentation } from '@/features/documentation';

const documentation = await generateCompleteDocumentation({
  includePatterns: ['src/**/*.ts', 'src/**/*.tsx'],
  excludePatterns: ['scripts/**', 'docs/**', 'tests/**'],
  followImports: true,
});

// Write to file
await fs.writeFile('COMPREHENSIVE_DOCUMENTATION.md', documentation);
```

### Scan Codebase

```typescript
import { scanCodebase } from '@/features/documentation/scanner';

const inventory = await scanCodebase({
  includePatterns: ['src/**/*.ts', 'src/**/*.tsx'],
  excludePatterns: ['scripts/**', 'docs/**', 'tests/**'],
  followImports: true,
});

console.log(`Total files: ${inventory.totalFiles}`);
console.log(`Active files: ${inventory.productionFiles}`);
```

### Parse TypeScript File

```typescript
import { parseTypeScript } from '@/features/documentation/parsers';

const ast = await parseTypeScript('src/features/cases/services/case.service.ts');
console.log(`Functions: ${ast.functions.length}`);
console.log(`Classes: ${ast.classes.length}`);
```

### Trace User Flow

```typescript
import { traceUserFlow } from '@/features/documentation/analyzers';

const flow = await traceUserFlow(
  'src/app/(dashboard)/vendor/auctions/[id]/page.tsx',
  'vendor'
);

console.log(`Steps: ${flow.steps.length}`);
console.log(`API calls: ${flow.apiCalls.length}`);
```

## Testing

### Run Unit Tests

```bash
npm run test:unit -- tests/unit/documentation
```

### Run Integration Tests

```bash
npm run test:integration -- tests/integration/documentation
```

## Development Guidelines

### Adding a New Parser

1. Create parser file in `src/features/documentation/parsers/`
2. Implement parser interface
3. Add unit tests in `tests/unit/documentation/parsers/`
4. Add integration tests in `tests/integration/documentation/parsers/`
5. Update this README

### Adding a New Analyzer

1. Create analyzer file in `src/features/documentation/analyzers/`
2. Implement analyzer interface
3. Add unit tests in `tests/unit/documentation/analyzers/`
4. Add integration tests in `tests/integration/documentation/analyzers/`
5. Update this README

### Adding a New Generator

1. Create generator file in `src/features/documentation/generators/`
2. Implement generator interface
3. Add unit tests in `tests/unit/documentation/generators/`
4. Add integration tests in `tests/integration/documentation/generators/`
5. Update this README

## Special Considerations

### KYC System

The system must correctly identify:
- **Dojah** as primary KYC provider
- **Manual KYC** as fallback
- Trace actual usage in API routes and components

### AI Integration

The system must correctly identify:
- **Claude** as primary AI for damage detection
- **Gemini** as backup AI
- Fallback chain implementation

### Abandoned Code

The system flags files as potentially abandoned if:
- Not imported by any active code
- Not referenced in API routes or pages
- Not used in database queries

## Output

The system generates a single Markdown file containing:
- Executive summary (2-3 pages)
- Complete technical documentation (5,000-10,000 lines)
- Verification report
- Error report (if any)
- Confidence assessment

## License

This documentation system is part of the salvage management platform and is proprietary.
