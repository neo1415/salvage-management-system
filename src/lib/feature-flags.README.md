# Feature Flag System

A comprehensive feature flag system for gradual rollout of new features with user-level opt-in/opt-out functionality.

## Overview

The feature flag system enables safe, gradual rollout of new features by:
- **Percentage-based rollout**: Control what percentage of users see new features (10%, 50%, 100%)
- **User-level overrides**: Allow users to opt-in or opt-out of specific features
- **Persistent state**: User preferences are saved in localStorage and persist across sessions
- **Cross-tab synchronization**: Changes sync automatically across browser tabs
- **Type-safe**: Full TypeScript support with type checking

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Feature Flag System                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Feature Flag Configuration                  │  │
│  │  - Flag name and description                         │  │
│  │  - Rollout percentage (0-100%)                       │  │
│  │  - Global enabled/disabled state                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         User Override Storage (localStorage)          │  │
│  │  - Per-user opt-in/opt-out preferences              │  │
│  │  - Persists across sessions                         │  │
│  │  - Syncs across browser tabs                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Feature Flag Evaluation                     │  │
│  │  Priority:                                           │  │
│  │  1. User override (if exists)                       │  │
│  │  2. Global enabled flag                             │  │
│  │  3. Percentage-based rollout (stable hash)          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Available Feature Flags

### 1. Modern Filters (`modern-filters`)
- **Description**: Modern faceted filter UI with chips and dropdowns
- **Status**: Fully rolled out (100%)
- **Components**: FacetedFilter, FilterChip, SearchInput

### 2. Card Redesign (`card-redesign`)
- **Description**: Reduced verbosity card design with max 5 fields
- **Status**: Fully rolled out (100%)
- **Components**: Case cards, auction cards, vendor cards

### 3. Icon Replacement (`icon-replacement`)
- **Description**: Lucide React icons replacing emoji characters
- **Status**: Fully rolled out (100%)
- **Components**: All dashboard components

## Usage

### Basic Usage in Components

```typescript
import { useFeatureFlag } from '@/hooks/use-feature-flag';

function MyComponent() {
  const { enabled } = useFeatureFlag('modern-filters');

  return (
    <div>
      {enabled ? (
        <ModernFilterUI />
      ) : (
        <LegacyFilterUI />
      )}
    </div>
  );
}
```

### Using the Wrapper Component

```typescript
import { FeatureFlagWrapper } from '@/components/ui/feature-flag-wrapper';

function MyComponent() {
  return (
    <FeatureFlagWrapper
      flag="modern-filters"
      fallback={<LegacyFilterUI />}
    >
      <ModernFilterUI />
    </FeatureFlagWrapper>
  );
}
```

### Programmatic Access

```typescript
import { isFeatureEnabled, optInToFeature, optOutOfFeature } from '@/lib/feature-flags';

// Check if feature is enabled
const isEnabled = isFeatureEnabled('modern-filters', userId);

// Opt-in to a feature
optInToFeature('modern-filters');

// Opt-out of a feature
optOutOfFeature('modern-filters');

// Clear user override
clearFeatureOverride('modern-filters');
```

### User Settings UI

```typescript
import { FeatureFlagSettings } from '@/components/ui/feature-flag-settings';

function SettingsPage() {
  return (
    <div>
      <h1>Feature Flags</h1>
      <FeatureFlagSettings userId={currentUser.id} />
    </div>
  );
}
```

## API Reference

### Core Functions

#### `isFeatureEnabled(flag, userId?)`
Check if a feature flag is enabled for a user.

**Parameters:**
- `flag: FeatureFlagName` - The feature flag to check
- `userId?: string` - Optional user ID for percentage-based rollout

**Returns:** `boolean` - Whether the feature is enabled

**Priority:**
1. User override (if exists)
2. Global enabled flag
3. Percentage-based rollout

#### `optInToFeature(flag)`
Opt-in to a feature (user override).

**Parameters:**
- `flag: FeatureFlagName` - The feature flag to enable

#### `optOutOfFeature(flag)`
Opt-out of a feature (user override).

**Parameters:**
- `flag: FeatureFlagName` - The feature flag to disable

#### `clearFeatureOverride(flag)`
Clear user override and use default rollout.

**Parameters:**
- `flag: FeatureFlagName` - The feature flag to reset

#### `getAllFeatureFlags(userId?)`
Get all feature flags with their current state.

**Parameters:**
- `userId?: string` - Optional user ID for percentage-based rollout

**Returns:** `Record<FeatureFlagName, boolean>` - All flags and their states

#### `getFeatureFlagConfig(flag)`
Get feature flag configuration.

**Parameters:**
- `flag: FeatureFlagName` - The feature flag to get config for

**Returns:** `FeatureFlagConfig | undefined` - The flag configuration

### React Hooks

#### `useFeatureFlag(flag, userId?)`
React hook for using feature flags in components.

**Parameters:**
- `flag: FeatureFlagName` - The feature flag to check
- `userId?: string` - Optional user ID for percentage-based rollout

**Returns:**
```typescript
{
  enabled: boolean;           // Whether the feature is enabled
  hasOverride: boolean;       // Whether user has an override
  overrideValue: boolean | null; // User's override value
  optIn: () => void;         // Function to opt-in
  optOut: () => void;        // Function to opt-out
  clearOverride: () => void; // Function to clear override
}
```

## Rollout Strategy

### Phase 1: 10% Rollout
```typescript
const FEATURE_FLAGS = {
  'new-feature': {
    name: 'new-feature',
    description: 'New feature description',
    rolloutPercentage: 10,
    enabled: true,
  },
};
```

### Phase 2: 50% Rollout
```typescript
const FEATURE_FLAGS = {
  'new-feature': {
    name: 'new-feature',
    description: 'New feature description',
    rolloutPercentage: 50,
    enabled: true,
  },
};
```

### Phase 3: 100% Rollout
```typescript
const FEATURE_FLAGS = {
  'new-feature': {
    name: 'new-feature',
    description: 'New feature description',
    rolloutPercentage: 100,
    enabled: true,
  },
};
```

### Emergency Rollback
```typescript
const FEATURE_FLAGS = {
  'new-feature': {
    name: 'new-feature',
    description: 'New feature description',
    rolloutPercentage: 0,
    enabled: false, // Disable globally
  },
};
```

## Testing

### Unit Tests
```bash
npm run test:unit -- tests/unit/lib/feature-flags.test.ts
```

### Integration Tests
```bash
npm run test:integration -- tests/integration/feature-flags/feature-flag-integration.test.tsx
```

## Best Practices

### 1. Always Provide Fallback
```typescript
// Good
<FeatureFlagWrapper flag="new-feature" fallback={<OldFeature />}>
  <NewFeature />
</FeatureFlagWrapper>

// Bad - no fallback
<FeatureFlagWrapper flag="new-feature">
  <NewFeature />
</FeatureFlagWrapper>
```

### 2. Use Consistent User IDs
```typescript
// Good - consistent user ID
const userId = currentUser.id;
const enabled = isFeatureEnabled('new-feature', userId);

// Bad - inconsistent user ID
const enabled = isFeatureEnabled('new-feature', Math.random().toString());
```

### 3. Test Both States
```typescript
it('should work with feature enabled', () => {
  optInToFeature('new-feature');
  // Test enabled state
});

it('should work with feature disabled', () => {
  optOutOfFeature('new-feature');
  // Test disabled state
});
```

### 4. Clean Up After Tests
```typescript
afterEach(() => {
  localStorage.clear();
});
```

## Troubleshooting

### Feature flag not updating
- Check if user has an override set
- Clear localStorage and try again
- Verify the flag configuration is correct

### Cross-tab sync not working
- Ensure localStorage is not disabled
- Check browser console for errors
- Verify storage event listeners are set up

### Percentage rollout inconsistent
- Ensure you're using the same user ID
- Check if user has an override set
- Verify the hash function is working correctly

## Migration Guide

### Adding a New Feature Flag

1. Add the flag to `FEATURE_FLAGS` in `src/lib/feature-flags.ts`:
```typescript
const FEATURE_FLAGS: Record<FeatureFlagName, FeatureFlagConfig> = {
  // ... existing flags
  'my-new-feature': {
    name: 'my-new-feature',
    description: 'My new feature description',
    rolloutPercentage: 10, // Start with 10%
    enabled: true,
  },
};
```

2. Add the flag name to the type:
```typescript
export type FeatureFlagName = 
  | 'modern-filters'
  | 'card-redesign'
  | 'icon-replacement'
  | 'my-new-feature'; // Add here
```

3. Wrap your feature with the flag:
```typescript
<FeatureFlagWrapper flag="my-new-feature" fallback={<OldFeature />}>
  <NewFeature />
</FeatureFlagWrapper>
```

### Removing a Feature Flag

Once a feature is fully rolled out and stable:

1. Remove the flag from `FEATURE_FLAGS`
2. Remove the flag name from the type
3. Remove the wrapper and use the new feature directly
4. Clean up any fallback code

## Performance Considerations

- **localStorage access**: Minimal overhead, cached in memory
- **Hash calculation**: O(n) where n is user ID length, very fast
- **Re-renders**: Only when flag state changes
- **Bundle size**: ~2KB minified + gzipped

## Security Considerations

- Feature flags are client-side only
- User overrides are stored in localStorage (not secure)
- Do not use for security-critical features
- Server-side validation is still required

## Support

For questions or issues:
1. Check this README
2. Review the test files for examples
3. Check the implementation in `src/lib/feature-flags.ts`
4. Contact the development team
