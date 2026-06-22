# Pickup Evidence Comparison

## Executive Summary

Pickup evidence comparison protects the insurer and buyer from a common salvage dispute: the asset shown during assessment is not the same asset, quantity, or visible condition presented at pickup.

The system compares the original inspection photos captured during case creation with the vendor's pickup photos. It does not show the vendor the AI valuation or reserve math. It records an internal evidence result for staff review and marks the handoff as clean, review-needed, or materially discrepant.

## User Flow Story

1. A claims adjuster visits the loss location and creates a salvage case.
2. The adjuster captures photos and records the inspection location, claim reference, insurance class, branch, broker/agency details, and asset information.
3. AI assessment stores the visible evidence: asset identity, visible condition, quantity clues, damage severity, and valuation context.
4. A salvage manager reviews the case, resolves warnings, confirms broker/agency, and approves the case for auction.
5. A vendor wins the auction, signs the required documents, pays, and receives pickup authorization.
6. At pickup, the vendor can upload pickup photos from the handoff location.
7. The system compares original inspection photos with pickup photos and stores a staff-facing result:
   - `matches_expected`: the asset appears materially consistent.
   - `review_needed`: evidence is incomplete, unclear, or has image integrity warnings.
   - `material_discrepancy`: visible evidence suggests missing units, removed parts, materially worse condition, wrong asset, or quantity mismatch.
8. Staff review the pickup queue. If a discrepancy exists, they can inspect the evidence before confirming release.

## AI Provider Flow

The comparison service tries providers in this order:

1. Gemini vision comparison.
2. Claude vision fallback if Gemini is unavailable or fails.
3. Rule-based fallback if both AI providers fail.

The rule-based fallback never invents a discrepancy. It marks the result as `review_needed` and asks staff to manually compare the original and pickup evidence.

## Prompt Used For Comparison

The comparison prompt is asset-aware. It tells the model:

- Original photos are from the insurer/adjuster inspection.
- Pickup photos are from the buyer/vendor handoff.
- Compare visible identity, condition, quantity, and obvious missing components.
- Do not estimate price.
- Do not infer hidden mechanical condition.
- Do not mark a material discrepancy unless the visual evidence clearly supports it.

For vehicles and machinery, it focuses on missing components, different item, removed parts, plate/VIN/serial clues, and materially worse visible condition.

For stock, goods-in-transit, fire, property, furniture, agriculture, or bulk materials, it focuses on unit count, package condition, contamination, burn/water damage, missing units, and whether the same class of goods appears to be present.

## Example AI Output

```json
{
  "status": "material_discrepancy",
  "confidence": 88,
  "findings": [
    "Original photos show approximately 10 cement bags; pickup photos show 8 visible bags.",
    "Two bags visible in the original inspection set are not visible in pickup evidence.",
    "Pickup photos are clear enough to compare quantity, but angle coverage is not identical."
  ],
  "recommendedAction": "Pause staff pickup confirmation and request manager review with original and pickup photo sets."
}
```

## Image Integrity Checks

Before staff rely on pickup or case photos, the app inspects each image for basic integrity signals:

- supported file signature and MIME type;
- whether the image can be decoded;
- pixel dimensions and very low resolution warnings;
- SHA-256 hash for later evidence traceability;
- EXIF/IPTC/XMP metadata presence;
- metadata indicators of editing or generated-image tools.

Missing metadata is a warning, not a hard block, because browser uploads, compression, and Cloudinary processing can legitimately remove EXIF. Editing or generative metadata also triggers review rather than automatic rejection, because the safest operational posture is to preserve evidence, flag risk, and let authorized staff decide.

## Security And Legal Boundaries

The app can preserve evidence, flag visible discrepancies, record hashes, and create an audit trail. It cannot physically prevent somebody from removing parts before pickup. The prevention layer is operational: fast assessment, controlled release, clear handoff evidence, pickup confirmation workflow, and escalation when evidence changes.

Legal signing rules for the bill of sale, liability waiver, and pickup authorization should still be validated by the insurer's legal team. The app supports company-authorized signatures in generated documents and vendor signatures where required, but the exact signature obligation is a business/legal policy decision.
