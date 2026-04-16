---
inclusion: auto
priority: critical
description: Mandatory principle - Always check what exists before creating new components, services, or APIs to prevent duplication and maintain codebase quality
---

# Check Before Create - Mandatory Principle

## Core Rule

**NEVER create new components, services, or APIs without first verifying what already exists.**

This is not optional. This is mandatory for maintaining codebase quality, especially in a financial system handling real money.

---

## Before Creating ANY New Code

### Step 1: Use Context-Gatherer (MANDATORY)

```
Use context-gatherer subagent to find:
- Existing components in the same category
- Existing services with similar functionality
- Existing API endpoints for the same resource
- Existing utilities or helpers
```

### Step 2: Read Existing Code (MANDATORY)

```
For each existing component/service found:
- Read the complete implementation
- Understand its current capabilities
- Identify what it does vs what you need
- Check if it can be enhanced vs creating new
```

### Step 3: Gap Analysis (MANDATORY)

```
Document:
- What exists: [list features]
- What's needed: [list requirements]
- Gap: [what's missing]
- Decision: [enhance existing OR create new]
- Justification: [why this decision]
```

### Step 4: Only Then Create (IF JUSTIFIED)

```
If creating new:
- Add comment explaining relationship to existing code
- Document why enhancement wasn't possible
- Consider future refactoring opportunities
```

---

## Checklist (Copy to Every Task)

Before creating new component/service/API:

- [ ] Used context-gatherer to find existing implementations
- [ ] Read all existing related code
- [ ] Documented gap analysis
- [ ] Justified enhancement vs new creation
- [ ] Added comments explaining relationships
- [ ] Updated documentation

---

## Examples

### ❌ BAD: Create Without Checking

```typescript
// Task: Create document signing component
// Action: Immediately create src/components/vendor/document-signing.tsx
// Result: Potential duplication, missed enhancement opportunity
```

### ✅ GOOD: Check First, Then Decide

```typescript
// Task: Create document signing component
// Step 1: Use context-gatherer to find existing document components
// Step 2: Found src/components/documents/document-signing-progress.tsx
// Step 3: Read it - it's a progress indicator, not full workflow
// Step 4: Gap analysis - need countdown, actions, deadline tracking
// Step 5: Decision - Create new (existing is read-only, different purpose)
// Step 6: Add comment explaining relationship
// Result: Justified new component with clear documentation
```

---

## Why This Matters

### For Financial Systems:
- Duplication = maintenance burden
- Duplication = inconsistent behavior
- Duplication = bugs in multiple places
- Duplication = technical debt

### For Code Quality:
- Integration > Duplication
- Enhancement > Recreation
- Reuse > Rebuild
- Clarity > Speed

### For Team Efficiency:
- Less code to maintain
- Clearer architecture
- Easier onboarding
- Faster debugging

---

## Enforcement

This principle is **NON-NEGOTIABLE** for:
- Financial transaction code
- Payment processing
- User authentication
- Data integrity operations
- Security-critical features

Violations will require:
- Immediate audit
- Refactoring plan
- Documentation update
- Process improvement

---

## Red Flags

If you find yourself:
- Creating a component with a similar name to existing one
- Implementing functionality that "feels familiar"
- Copying code patterns from elsewhere in codebase
- Unsure if something already exists

**STOP. Use context-gatherer. Verify first.**

---

## Remember

> "This application will be seriously reviewed for any code that is less than perfect when we start throwing big money in here."

Every line of code matters. Every decision matters. Take the time to do it right.

---

**Priority:** CRITICAL
**Applies To:** ALL code creation tasks
**Exceptions:** NONE
