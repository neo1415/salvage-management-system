# Access Control Matrix

This matrix summarizes intended access boundaries for procurement review. Final permissions should be verified against the deployed configuration and tested route-by-route before production launch.

| Capability | Vendor | Claims Adjuster | Salvage Manager | Finance Officer | System Admin |
| --- | --- | --- | --- | --- | --- |
| Register / sign in | Yes | Yes | Yes | Yes | Yes |
| Complete vendor KYC | Own account | No | Review | No | Review / support |
| View own vendor wallet | Own wallet | No | Limited/admin view | Finance view | Admin view |
| Fund wallet | Own wallet | No | No | No | No |
| Browse auctions | Eligible auctions | No | Yes | Yes | Yes |
| Place bids | Eligible auctions | No | No | No | No |
| Sign documents | Own winning auctions | No | View status | View status | View status |
| Pay winning auction | Own winning auctions | No | Monitor | Monitor/verify | Monitor/admin |
| Confirm pickup | Own auction where allowed | No | Admin confirmation | View | Admin confirmation |
| Create salvage cases | No | Yes | No | No | No |
| View own cases | No | Own cases | All/managed | Finance-related | All |
| Approve/reject cases | No | No | Yes | No | Admin oversight |
| Create/end/restart auctions | No | No | Yes | Limited finance/admin routes | Admin oversight |
| View payments/reconciliation | Own payments | No | Limited | Yes | Yes |
| Review fraud alerts | No | No | Limited | Limited where payment-related | Yes |
| Configure business policy | No | No | Limited auction config | No | Yes |
| Manage users | No | No | No | No | Yes |
| View audit logs | No | No | Limited report routes | Limited payment routes | Yes |
| Generate/export reports | Own/vendor reports | Own/team where allowed | Operational/compliance | Financial | All/admin |

## Evidence

- `src/lib/auth/rbac.ts`
- `src/proxy.ts`
- `src/lib/auth/vendor-bvn-access.ts`
- `src/app/api/admin/*`
- `src/app/api/kyc/approvals/*`
- `src/app/api/finance/*`
- `src/app/api/reports/*`
- `src/app/api/auctions/*`
- `src/app/api/cases/*`

## Production Recommendation

Before enterprise launch, run an object-level authorization test sweep for:

- vendor documents
- vendor wallets
- auction payment verification
- KYC evidence
- case ownership
- reports/exports
- admin config routes

