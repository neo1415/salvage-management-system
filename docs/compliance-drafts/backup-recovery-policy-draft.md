# Backup and Recovery Policy Draft

Status: Draft for operational review  

## Purpose

Define how production data is backed up, restored, and tested for insurer-specific deployments.

## Required Decisions Per Client

- database provider and plan
- backup frequency
- backup retention
- restore point objective (RPO)
- restore time objective (RTO)
- who can request restore
- who can approve restore
- restore test cadence

## Minimum Recommended Controls

1. Automated database backups.
2. Documented restore procedure.
3. At least quarterly restore test for production-like data.
4. Backup access restricted to authorized personnel.
5. Backup encryption according to provider capability.
6. Incident process for failed backups.
7. Separate handling for uploaded media/documents.

## Application Data Requiring Coverage

- users/vendors
- KYC records and verification evidence
- cases and uploaded media metadata
- auctions and bids
- wallets, deposits, payments, wallet transactions
- release forms/documents
- audit logs
- business policy versions
- notifications
- reports and scheduled jobs

## Current Note

The repository includes backup/restore scripts, but client production readiness should be based on full database/provider backup guarantees and tested restore evidence, not only repository scripts.

