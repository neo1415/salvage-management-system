# Archived Import Scripts

## Overview

This directory contains legacy vehicle data import scripts that have been **superseded by the new enterprise seeding system**.

These scripts are preserved for historical reference only and should **NOT** be used for new data imports.

## Why These Scripts Were Archived

The original import scripts had several limitations:
- **Not idempotent**: Running them multiple times created duplicate data
- **No error handling**: Single record failures would stop the entire import
- **No tracking**: No way to know which scripts had been executed
- **Inconsistent structure**: Each script had slightly different patterns
- **No deployment integration**: Required manual execution on fresh deployments

## New Seeding System

All vehicle data imports now use the **enterprise-grade seeding system** located in:

```
scripts/seeds/
├── audi/
│   ├── audi-valuations.seed.ts
│   └── audi-damage-deductions.seed.ts
├── hyundai/
│   ├── hyundai-valuations.seed.ts
│   └── hyundai-damage-deductions.seed.ts
├── kia/
│   ├── kia-valuations.seed.ts
│   └── kia-damage-deductions.seed.ts
├── lexus/
│   ├── lexus-valuations.seed.ts
│   └── lexus-damage-deductions.seed.ts
├── mercedes/
│   ├── mercedes-valuations.seed.ts
│   └── mercedes-damage-deductions.seed.ts
├── nissan/
│   ├── nissan-valuations.seed.ts
│   └── nissan-damage-deductions.seed.ts
├── toyota/
│   ├── toyota-valuations.seed.ts
│   └── toyota-damage-deductions.seed.ts
├── run-all-seeds.ts
└── README.md
```

## Benefits of New System

✅ **Idempotent**: Safe to run multiple times without creating duplicates  
✅ **Error resilient**: Individual record failures don't stop the entire import  
✅ **Registry tracking**: Tracks which seeds have been executed  
✅ **Consistent structure**: All seeds follow the same template pattern  
✅ **Automatic deployment**: Seeds run automatically on fresh deployments  
✅ **Batch processing**: Efficient handling of large datasets  
✅ **Comprehensive logging**: Detailed execution reports and audit trails  

## How to Use the New System

### Run All Seeds
```bash
tsx scripts/seeds/run-all-seeds.ts
```

### Run a Specific Make
```bash
tsx scripts/seeds/toyota/toyota-valuations.seed.ts
```

### Force Re-run (Update Existing Data)
```bash
tsx scripts/seeds/toyota/toyota-valuations.seed.ts --force
```

### Dry Run (Validate Without Changes)
```bash
tsx scripts/seeds/toyota/toyota-valuations.seed.ts --dry-run
```

## Documentation

For complete documentation on the new seeding system, see:
- **scripts/seeds/README.md** - Comprehensive guide
- **.kiro/specs/enterprise-data-seeding-system/** - Full specification

## Archived Scripts

The following legacy scripts are preserved in this directory:

### Mercedes
- `import-mercedes-valuations.ts`
- `import-mercedes-damage-deductions.ts`

### Toyota
- `import-toyota-damage-deductions.ts`
- `import-toyota-damage-deductions-correct.ts`
- `import-all-toyota-models.ts`
- `import-all-toyota-comprehensive.ts`
- `import-toyota-data-complete.ts`
- `import-toyota-nigeria-data.ts`
- `import-toyota-nigeria-data-direct.ts`
- `import-remaining-toyota-models.ts`
- `import-rav4-sienna-lc-prado-venza-avalon.ts`
- `import-lc-prado-venza-avalon.ts`
- `import-remaining-toyota-direct.ts`
- `quick-import-toyota.ts`

### Nissan
- `import-nissan-valuations.ts`
- `import-nissan-damage-deductions.ts`

### Hyundai/Kia
- `import-hyundai-kia-valuations.ts`
- `import-hyundai-kia-damage-deductions.ts`

### Lexus
- `import-lexus-valuations.ts`
- `import-lexus-damage-deductions.ts`

### Audi
- `import-audi-valuations-direct.ts`
- `import-audi-damage-deductions.ts`
- `import-audi-data.ts`
- `import-audi-fixed.ts`

### Generic/Utility
- `import-damage-deductions.ts`
- `direct-import-all-vehicles.ts`
- `direct-import-all-vehicles-complete.ts`
- `import-toyota-direct-db.ts`
- `reimport-all-vehicle-data.ts`
- `restore-all-vehicle-data.ts`
- `restore-all-missing-vehicles.ts`

## Migration Notes

All data from these archived scripts has been successfully migrated to the new seeding system. The new seed scripts contain identical data but with improved:
- Idempotent upsert logic
- Validation and error handling
- Registry tracking
- Batch processing
- Audit logging

## Questions?

If you need to reference the old import logic or data format, these archived scripts are available for review. However, **all new imports should use the scripts/seeds/ system**.

For questions about the new seeding system, see the documentation in `scripts/seeds/README.md`.
