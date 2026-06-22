---
inclusion: auto
priority: high
description: Context for Salvage pickup evidence, staff confirmation, and buyer-facing pickup UX
---

# Pickup Workflow Context

## Current Lifecycle

Case creation captures asset details, location, and inspection photos. After manager approval, auction, winner payment, documents, and pickup authorization, the pickup flow moves through:

1. `ready_for_pickup` — payment is verified and a pickup authorization document exists.
2. `vendor_confirmed` — the winning vendor submitted pickup evidence and/or confirmed the code.
3. `staff_confirmed` — manager/system admin confirms physical handoff; the transaction is complete.

Staff confirmation updates `auctions.pickup_confirmed_admin*`, keeps/sets vendor confirmation, sets the related case to `sold`, writes audit/notification records, and records pickup timing signals.

## Key Files

- Vendor pickup page: `src/app/(dashboard)/vendor/pickups/page.tsx`
- Vendor dashboard pickup prompt: `src/components/vendor/vendor-dashboard-content.tsx`
- Staff pickup queues: `src/app/(dashboard)/admin/pickups/page.tsx`, `src/app/(dashboard)/manager/pickups/page.tsx`
- Pickup desk: `src/components/pickups/pickup-confirmation-desk.tsx`
- Evidence API: `src/app/api/auctions/[id]/pickup-evidence/route.ts`
- Staff confirm APIs: `src/app/api/admin/auctions/[id]/confirm-pickup/route.ts`, `src/app/api/pickups/confirm/route.ts`
- Service: `src/features/pickups/services/pickup-confirmation.service.ts`
- Evidence comparison: `src/features/pickups/services/pickup-evidence-comparison.service.ts`
- Schema: `src/lib/db/schema/auctions.ts`, `src/lib/db/schema/pickup-evidence.ts`

## Product Language Rule

Vendor-facing pickup evidence is proof for staff review. Do not tell buyers/vendors they created a "discrepancy" just because automated comparison returns `review_needed` or `material_discrepancy`.

Use buyer-facing language like:

- "Pickup evidence submitted. Staff will review it before final release."
- "Your pickup is awaiting staff confirmation."
- "Pickup completed and released."

Reserve "discrepancy", "material discrepancy", reimbursement, and adjustment wording for staff/admin review surfaces and audit records.

## Known UX Gap

The vendor pickup page currently focuses on items awaiting evidence/staff handoff. It should clearly separate:

- Awaiting evidence submission
- Evidence submitted, awaiting staff review/release
- Staff confirmed/released/completed

Completed pickups should remain visible to the vendor with a distinct success state instead of disappearing as soon as `pickupConfirmedAdmin` becomes true.

## Video Analysis Note

Current media analysis is image-first. Cloudinary supports video resource types, but upload signing, pickup evidence UI, AI prompts, and comparison services currently expect image URLs and image MIME inputs. Video should be added as a scoped enhancement using frame extraction/key-frame analysis first, not direct full-video processing.
