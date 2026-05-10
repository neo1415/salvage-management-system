# Documentation Parser System

This directory contains the parser system for the comprehensive application documentation generator. The parsers extract structured information from different types of source code files.

## Overview

The parser system is designed to read actual production code and extract structured information that can be used to generate comprehensive documentation. It follows the principle of **reading actual code, not specs or docs**.

## Parsers

### 1. TypeScript Parser (`typescript-parser.ts`)

Extracts structured information from TypeScript files using the TypeScript Compiler API.

**Capabilities:**
- Extract imports and exports
- Extract function signatures with parameters and return types
- Extract class definitions with properties and methods
- Extract interface definitions
- Extract type aliases
- Extract constant definitions
- Extract JSDoc comments

**Usage:**
```typescript
import { TypeScriptParser } from './typescript-parser';

const parser = new TypeScriptParser();
const result = await parser.parseTypeScript('src/features/cases/services/case.service.ts');

if (result.success) {
  console.log('Functions:', result.data.functions);
  console.log('Classes:', result.data.classes);
  console.log('Interfaces:', result.data.interfaces);
}
```

### 2. Schema Parser (`schema-parser.ts`)

Extracts database schema information from Drizzle ORM schema files.

**Capabilities:**
- Extract table definitions
- Extract column definitions with types and constraints
- Extract primary keys and foreign keys
- Extract indexes (from SQL comments)
- Extract enum definitions
- Infer relationships between tables

**Usage:**
```typescript
import { SchemaParser } from './schema-parser';

const parser = new SchemaParser();
const result = await parser.parseSchema('src/lib/db/schema/cases.ts');

if (result.success) {
  result.data.forEach(schema => {
    console.log('Table:', schema.tableName);
    console.log('Columns:', schema.columns);
    console.log('Foreign Keys:', schema.foreignKeys);
  });
}
```

### 3. API Route Parser (`api-route-parser.ts`)

Extracts API endpoint information from Next.js App Router route files.

**Capabilities:**
- Extract route path from file path
- Extract HTTP method handlers (GET, POST, PUT, PATCH, DELETE)
- Detect authentication requirements
- Detect authorization requirements (roles)
- Extract middleware usage
- Identify request/response patterns

**Usage:**
```typescript
import { APIRouteParser } from './api-route-parser';

const parser = new APIRouteParser();
const result = await parser.parseAPIRoute('src/app/api/cases/route.ts');

if (result.success) {
  console.log('Path:', result.data.path);
  console.log('Methods:', result.data.methods);
  console.log('Handlers:', result.data.handlers);
  console.log('Auth Required:', result.data.authentication.required);
}
```

### 4. Component Parser (`component-parser.ts`)

Extracts component information from React/Next.js component files.

**Capabilities:**
- Extract component name and export type
- Extract props definitions
- Extract React hooks usage
- Extract state variables (from useState)
- Extract API calls (fetch, axios)
- Extract child components

**Usage:**
```typescript
import { ComponentParser } from './component-parser';

const parser = new ComponentParser();
const result = await parser.parseComponent('src/components/cases/case-form.tsx');

if (result.success) {
  console.log('Component:', result.data.name);
  console.log('Props:', result.data.props);
  console.log('Hooks:', result.data.hooks);
  console.log('API Calls:', result.data.apiCalls);
}
```

### 5. Configuration Parser (`config-parser.ts`)

Extracts configuration information from various config files.

**Capabilities:**
- Parse package.json (dependencies, scripts, metadata)
- Parse .env files (environment variables)
- Parse next.config.ts (Next.js configuration)
- Parse middleware.ts (middleware configuration)
- Parse generic JSON config files

**Usage:**
```typescript
import { ConfigParser } from './config-parser';

const parser = new ConfigParser();

// Parse package.json
const pkgResult = await parser.parseConfig('package.json');
if (pkgResult.success) {
  console.log('Dependencies:', pkgResult.data.dependencies);
}

// Parse .env.example
const envResult = await parser.parseConfig('.env.example');
if (envResult.success) {
  console.log('Environment Variables:', envResult.data.environmentVariables);
}
```

## Types

All parsers use strongly-typed interfaces defined in `types.ts`:

- `TypeScriptAST` - Structured TypeScript file information
- `SchemaDefinition` - Database schema information
- `APIRouteDefinition` - API endpoint information
- `ComponentDefinition` - React component information
- `ConfigDefinition` - Configuration file information

## Error Handling

All parsers return a `ParseResult<T>` which includes:

```typescript
interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: ParserError;
}
```

Error types:
- `FILE_NOT_FOUND` - File does not exist
- `PARSE_ERROR` - Error parsing the file
- `INVALID_SYNTAX` - Invalid syntax in the file
- `UNSUPPORTED_FILE_TYPE` - File type not supported

## Design Principles

1. **Read Actual Code**: Parsers read production code in `src/`, not docs or scripts
2. **Graceful Degradation**: If a file can't be parsed, return an error but continue
3. **Type Safety**: All extracted information is strongly typed
4. **No Side Effects**: Parsers are read-only and never modify source files
5. **Performance**: Use efficient parsing strategies (AST traversal, regex where appropriate)

## Implementation Status

- [x] TypeScript Parser (Task 4.1)
- [x] Schema Parser (Task 4.2)
- [x] API Route Parser (Task 4.3)
- [x] Component Parser (Task 4.4)
- [x] Configuration Parser (Task 4.5)
- [ ] Unit Tests (Task 4.6 - Optional, skipped)

## Next Steps

The parser system is now complete and ready to be integrated with:

1. **Codebase Scanner** - To discover files to parse
2. **Analysis Engine** - To build relationships and trace flows
3. **Documentation Generator** - To produce formatted documentation

## Safety Guarantee

⚠️ **READ-ONLY SYSTEM**: This parser system is completely read-only. It:
- ✅ Only reads source files
- ✅ Extracts structured information
- ❌ Never modifies any files
- ❌ Never writes to the database
- ❌ Never generates code

Your production codebase remains completely untouched.
