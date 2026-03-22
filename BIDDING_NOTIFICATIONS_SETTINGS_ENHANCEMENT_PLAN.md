# Bidding, Notifications & Settings Enhancement Plan

## Overview
This document outlines the comprehensive enhancements needed for:
1. OTP rate limiting during bidding
2. Real-time auction updates across sessions
3. Global notification system with bell icon
4. Comprehensive settings page with profile management
5. Release form requirements analysis

## Problem Analysis

### 1. OTP Rate Limiting Issue
**Current Problem**: Rate limiting OTP sends during bidding could limit vendors to only a few bids in 30 minutes, which is problematic during competitive auctions.

**Solution Needed**:
- Separate rate limits for authentication OTP vs bidding OTP
- Authentication OTP: Strict limits (3 per 30 min) to prevent abuse
- Bidding OTP: More lenient limits (10-15 per 30 min) to allow competitive bidding
- Per-auction rate limiting to prevent spam on single auction
- IP-based monitoring for fraud detection without blocking legitimate bidding

### 2. Real-Time Updates Missing
**Current Problem**: When one vendor bids, other vendors in different sessions don't see the updated bid amount or minimum bid until they refresh.

**Solution Needed**:
- Socket.IO real-time broadcasts for all bid events
- Update current bid amount instantly
- Update minimum bid amount instantly
- Show "New bid placed" toast notifications
- Update watching count in real-time
- Update countdown timer synchronization

### 3. Notification System
**Current Problem**: No centralized notification center. Users only have notification preferences page.

**Solution Needed**:
- Bell icon in global navigation with unread count badge
- Dropdown showing latest 3-4 notifications
- "View All" link to full notifications page
- Notification types for vendors:
  - Outbid alerts (with auction details)
  - Auction won (personalized)
  - Auction lost (generic - don't reveal winner)
  - Auction closing soon (1 hour, 30 min)
  - New auctions matching interests
  - OTP sent confirmations
  - Payment reminders
  - KYC status updates
- Mark as read/unread functionality
- Real-time notification delivery via Socket.IO

### 4. Settings Page Enhancement
**Current Problem**: Only notification preferences exist. Need comprehensive settings.

**Solution Needed**:
- **Profile Tab** (default):
  - Display user information (name, email, phone, DOB)
  - Display KYC status and tier
  - Show non-sensitive KYC info (business name, bank account - masked)
  - Hide sensitive data (BVN, NIN, documents)
  - Change password functionality
  - Profile photo upload
  
- **Notification Settings Tab**:
  - Existing notification preferences
  - Enhanced with per-notification-type controls
  
- **Transactions Tab**:
  - Wallet transaction history
  - Bid history
  - Payment history
  - Export functionality
  
- **Security Tab** (optional):
  - Two-factor authentication settings
  - Login history
  - Active sessions
  - Security alerts

### 5. Release Form Analysis
**Research Needed**:
- Investigate if release forms are needed in salvage auction flow
- Check industry best practices
- Determine if pickup authorization is sufficient
- Research legal requirements in Nigeria
- Compare with similar platforms (Copart, IAAI, etc.)

## Technical Requirements

### Rate Limiting Strategy
```typescript
// Separate rate limit configs
const RATE_LIMITS = {
  AUTH_OTP: {
    maxAttempts: 3,
    windowMs: 30 * 60 * 1000, // 30 minutes
    blockDuration: 30 * 60 * 1000
  },
  BIDDING_OTP: {
    maxAttempts: 15,
    windowMs: 30 * 60 * 1000, // 30 minutes
    perAuction: 5, // Max 5 bids per auction per 5 minutes
    auctionWindowMs: 5 * 60 * 1000
  }
};
```

### Real-Time Events
```typescript
// Socket.IO events to implement
socket.on('auction:bid-placed', (data) => {
  // Update current bid
  // Update minimum bid
  // Show toast notification
  // Update UI
});

socket.on('auction:watching-updated', (data) => {
  // Update watching count
});

socket.on('notification:new', (data) => {
  // Update bell icon badge
  // Show toast
  // Add to notification list
});
```

### Database Schema Additions
```sql
-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type VARCHAR(50), -- 'outbid', 'auction_won', 'auction_closing', etc.
  title VARCHAR(255),
  message TEXT,
  data JSONB, -- Additional context (auction_id, bid_amount, etc.)
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Notification preferences (enhance existing)
ALTER TABLE notification_preferences 
ADD COLUMN in_app_enabled BOOLEAN DEFAULT TRUE;
```

## UI/UX Requirements

### Bell Icon Component
- Position: Top right navigation, next to user avatar
- Badge: Red circle with unread count (max display: 9+)
- Dropdown: 300px width, max-height 400px
- Show latest 3-4 notifications
- "View All" button at bottom
- Empty state: "No notifications"

### Notification Item Design
- Icon based on type (🔔 outbid, 🏆 won, ⏰ closing soon)
- Title (bold)
- Message (regular)
- Timestamp (relative: "2 minutes ago")
- Unread indicator (blue dot)
- Click to mark as read and navigate to relevant page

### Settings Page Layout
- Sidebar navigation (mobile: tabs at top)
- Responsive design
- Form validation
- Success/error toasts
- Confirmation modals for sensitive actions

## Implementation Tasks

### Phase 1: Rate Limiting Fix
1. Update OTP service with separate rate limits
2. Implement per-auction bid limiting
3. Add fraud detection monitoring
4. Update bid form to handle new limits
5. Add user-friendly error messages

### Phase 2: Real-Time Updates
1. Enhance Socket.IO server with new events
2. Update auction details page to listen for events
3. Update auction listing page for real-time updates
4. Add toast notifications for bid events
5. Synchronize countdown timers across sessions
6. Test with multiple concurrent users

### Phase 3: Notification System
1. Create notifications database schema
2. Build notification service (create, read, mark as read)
3. Create bell icon component
4. Create notification dropdown component
5. Create full notifications page
6. Integrate with existing notification channels (SMS, email, push)
7. Add Socket.IO real-time delivery
8. Create notification templates for all types

### Phase 4: Settings Page
1. Create settings layout with tabs
2. Build profile tab with user info display
3. Add change password functionality
4. Build transactions tab
5. Enhance notification settings tab
6. Add security tab (optional)
7. Implement form validation and error handling

### Phase 5: Release Form Research
1. Research salvage auction industry practices
2. Review Nigerian legal requirements
3. Analyze current pickup authorization flow
4. Determine if additional release form needed
5. Document findings and recommendations

## Best Practices Research

### Notification Systems
- Reference: Airbnb, eBay, Amazon notification patterns
- Bell icon standard: Material Design, iOS Human Interface Guidelines
- Unread badge: Max 99, then show "99+"
- Grouping: Group similar notifications
- Actions: Quick actions in dropdown (mark all as read)

### Settings Pages
- Reference: GitHub, Twitter, LinkedIn settings
- Progressive disclosure: Show common settings first
- Validation: Real-time validation with clear error messages
- Confirmation: Require confirmation for destructive actions
- Accessibility: Keyboard navigation, screen reader support

### Real-Time Updates
- Reference: eBay live auctions, StockX bidding
- Optimistic updates: Update UI immediately, rollback on error
- Conflict resolution: Handle race conditions gracefully
- Connection status: Show indicator when disconnected
- Reconnection: Auto-reconnect with exponential backoff

## Security Considerations

1. **Rate Limiting**: Prevent abuse while allowing legitimate use
2. **Notification Privacy**: Don't reveal sensitive info in notifications
3. **Real-Time Auth**: Verify user identity for Socket.IO connections
4. **XSS Prevention**: Sanitize notification content
5. **CSRF Protection**: Protect settings update endpoints

## Testing Requirements

1. **Rate Limiting Tests**: Verify limits work correctly
2. **Real-Time Tests**: Test with multiple concurrent users
3. **Notification Tests**: Test all notification types
4. **Settings Tests**: Test all form validations
5. **Mobile Tests**: Test on actual mobile devices
6. **Load Tests**: Test with 50+ concurrent bidders

## Success Metrics

1. **Rate Limiting**: No legitimate bids blocked, fraud attempts caught
2. **Real-Time**: <1s latency for bid updates
3. **Notifications**: 95%+ delivery rate, <5s delivery time
4. **Settings**: <2s page load, 100% form validation coverage
5. **User Satisfaction**: 4.5+/5 rating for bidding experience

## Timeline Estimate

- Phase 1 (Rate Limiting): 2-3 days
- Phase 2 (Real-Time): 3-4 days
- Phase 3 (Notifications): 4-5 days
- Phase 4 (Settings): 3-4 days
- Phase 5 (Research): 1-2 days
- Testing & Polish: 2-3 days

**Total**: 15-21 days (3-4 weeks)

## Notes

- Use subagent for implementation
- Follow enterprise-grade standards
- Ensure production-ready code
- No bugs or issues
- Mobile-first design
- Accessibility compliant
- Performance optimized
