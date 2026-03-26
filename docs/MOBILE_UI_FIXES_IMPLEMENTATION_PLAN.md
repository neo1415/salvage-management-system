# Mobile UI/UX Fixes - Implementation Plan

## Priority Order

### HIGH PRIORITY (Immediate Fixes)

1. **Notification Dropdown** - ✅ Already fixed (has mobile positioning)
2. **My Cases Header Layout** - Fix stacking on mobile
3. **Bid History Cards** - Remove location/watching, stack prices
4. **Transaction History** - Fix pagination overflow and card layout
5. **Finance Payments** - Fix grace period button overflow

### MEDIUM PRIORITY

6. **Create Case Page** - Fix input field backgrounds
7. **Bid History Timeline** - Make mobile responsive
8. **Wallet Page** - Update escrow info text

### LOW PRIORITY (Non-Mobile Specific)

9. **Profile Picture Fallback** - Fix for all screens
10. **Auction Sorting** - Backend API changes

---

## Implementation Notes

- All fixes use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`)
- Desktop layouts remain unchanged
- Mobile breakpoint: < 640px (sm)
- Test on actual mobile devices after implementation

