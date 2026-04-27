# Bidding OTP Frontend Migration Guide

## Overview

This guide helps frontend developers migrate from authentication OTP endpoints to bidding-specific OTP endpoints for auction bidding.

## Why This Change?

**Problem**: Vendors were getting locked out after 3 bids in 30 minutes due to restrictive authentication rate limits.

**Solution**: Use bidding-specific endpoints with higher rate limits (15 per 30 min + 5 per auction per 5 min).

## Migration Steps

### Step 1: Identify Bidding OTP Calls

Find all places where OTP is requested/verified for bidding:

```typescript
// ❌ OLD - Using authentication endpoints
await fetch('/api/auth/send-otp', { ... });
await fetch('/api/auth/verify-otp', { ... });
```

### Step 2: Update to Bidding Endpoints

Replace with auction-specific endpoints:

```typescript
// ✅ NEW - Using bidding endpoints
await fetch(`/api/auctions/${auctionId}/otp/send`, { ... });
await fetch(`/api/auctions/${auctionId}/otp/verify`, { ... });
```

## Code Examples

### Before (Incorrect)

```typescript
// components/BidModal.tsx
const handleRequestOTP = async () => {
  try {
    const response = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: user.phone })
    });
    
    const data = await response.json();
    if (data.success) {
      setOtpSent(true);
    }
  } catch (error) {
    console.error('Failed to send OTP:', error);
  }
};

const handleVerifyOTP = async () => {
  try {
    const response = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        phone: user.phone,
        otp: otpValue 
      })
    });
    
    const data = await response.json();
    if (data.success) {
      setOtpVerified(true);
    }
  } catch (error) {
    console.error('Failed to verify OTP:', error);
  }
};
```

### After (Correct)

```typescript
// components/BidModal.tsx
const handleRequestOTP = async () => {
  try {
    // ✅ Use auction-specific endpoint
    const response = await fetch(`/api/auctions/${auctionId}/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
      // No body needed - phone is from session
    });
    
    const data = await response.json();
    if (data.success) {
      setOtpSent(true);
      toast.success('OTP sent to your phone');
    } else {
      toast.error(data.error || 'Failed to send OTP');
    }
  } catch (error) {
    console.error('Failed to send OTP:', error);
    toast.error('Failed to send OTP. Please try again.');
  }
};

const handleVerifyOTP = async () => {
  try {
    // ✅ Use auction-specific endpoint
    const response = await fetch(`/api/auctions/${auctionId}/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otp: otpValue })
      // Phone is from session
    });
    
    const data = await response.json();
    if (data.success) {
      setOtpVerified(true);
      toast.success('OTP verified successfully');
    } else {
      toast.error(data.error || 'Invalid OTP');
    }
  } catch (error) {
    console.error('Failed to verify OTP:', error);
    toast.error('Failed to verify OTP. Please try again.');
  }
};
```

## Complete Bidding Flow

```typescript
// components/BidModal.tsx
import { useState } from 'react';
import { toast } from 'sonner';

interface BidModalProps {
  auctionId: string;
  currentBid: number;
  minimumIncrement: number;
  onSuccess: () => void;
}

export function BidModal({ auctionId, currentBid, minimumIncrement, onSuccess }: BidModalProps) {
  const [bidAmount, setBidAmount] = useState(currentBid + minimumIncrement);
  const [otpSent, setOtpSent] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [loading, setLoading] = useState(false);

  // Step 1: Request OTP
  const handleRequestOTP = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/auctions/${auctionId}/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      if (data.success) {
        setOtpSent(true);
        toast.success('OTP sent to your phone');
      } else {
        toast.error(data.error || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Failed to send OTP:', error);
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async () => {
    if (otpValue.length !== 6) {
      toast.error('Please enter a 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/auctions/${auctionId}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: otpValue })
      });
      
      const data = await response.json();
      if (data.success) {
        setOtpVerified(true);
        toast.success('OTP verified successfully');
      } else {
        toast.error(data.error || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Failed to verify OTP:', error);
      toast.error('Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Place Bid
  const handlePlaceBid = async () => {
    if (!otpVerified) {
      toast.error('Please verify OTP first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/auctions/${auctionId}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: bidAmount,
          otp: otpValue // Still required for bid placement
        })
      });
      
      const data = await response.json();
      if (data.success) {
        toast.success('Bid placed successfully!');
        onSuccess();
      } else {
        toast.error(data.error || 'Failed to place bid');
      }
    } catch (error) {
      console.error('Failed to place bid:', error);
      toast.error('Failed to place bid. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Bid Amount Input */}
      <div>
        <label>Bid Amount</label>
        <input
          type="number"
          value={bidAmount}
          onChange={(e) => setBidAmount(Number(e.target.value))}
          min={currentBid + minimumIncrement}
          disabled={otpSent}
        />
      </div>

      {/* Step 1: Request OTP */}
      {!otpSent && (
        <button onClick={handleRequestOTP} disabled={loading}>
          {loading ? 'Sending...' : 'Request OTP'}
        </button>
      )}

      {/* Step 2: Verify OTP */}
      {otpSent && !otpVerified && (
        <div>
          <label>Enter OTP</label>
          <input
            type="text"
            value={otpValue}
            onChange={(e) => setOtpValue(e.target.value)}
            maxLength={6}
            placeholder="123456"
          />
          <button onClick={handleVerifyOTP} disabled={loading}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </div>
      )}

      {/* Step 3: Place Bid */}
      {otpVerified && (
        <button onClick={handlePlaceBid} disabled={loading}>
          {loading ? 'Placing Bid...' : 'Place Bid'}
        </button>
      )}
    </div>
  );
}
```

## Error Handling

### Rate Limit Errors

```typescript
const handleRequestOTP = async () => {
  try {
    const response = await fetch(`/api/auctions/${auctionId}/otp/send`, {
      method: 'POST'
    });
    
    const data = await response.json();
    
    if (!data.success) {
      // Handle specific error messages
      if (data.error.includes('Too many OTP requests')) {
        toast.error('Rate limit exceeded. Please wait before requesting another OTP.');
      } else if (data.error.includes('Too many bid attempts')) {
        toast.error('Too many bids on this auction. Please wait 5 minutes.');
      } else {
        toast.error(data.error);
      }
    }
  } catch (error) {
    toast.error('Failed to send OTP. Please try again.');
  }
};
```

### OTP Verification Errors

```typescript
const handleVerifyOTP = async () => {
  try {
    const response = await fetch(`/api/auctions/${auctionId}/otp/verify`, {
      method: 'POST',
      body: JSON.stringify({ otp: otpValue })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      // Handle specific error messages
      if (data.error.includes('expired')) {
        toast.error('OTP expired. Please request a new one.');
        setOtpSent(false);
        setOtpValue('');
      } else if (data.error.includes('attempts remaining')) {
        toast.error(data.error); // Shows remaining attempts
      } else if (data.error.includes('Maximum verification attempts')) {
        toast.error('Too many failed attempts. Please request a new OTP.');
        setOtpSent(false);
        setOtpValue('');
      } else {
        toast.error(data.error);
      }
    }
  } catch (error) {
    toast.error('Failed to verify OTP. Please try again.');
  }
};
```

## Testing Checklist

- [ ] OTP send works for bidding
- [ ] OTP verify works for bidding
- [ ] Bid placement works after OTP verification
- [ ] Rate limit error messages display correctly
- [ ] OTP expiry handled gracefully
- [ ] Invalid OTP shows remaining attempts
- [ ] UI disables during loading states
- [ ] Success/error toasts display correctly

## Common Issues

### Issue: "Unauthorized" error
**Cause**: User not logged in
**Solution**: Check session before showing bid modal

### Issue: "Vendor profile not found"
**Cause**: User is not a vendor
**Solution**: Only show bidding UI to vendors

### Issue: "Too many OTP requests"
**Cause**: Hit rate limit (15 per 30 min or 5 per auction per 5 min)
**Solution**: Show clear error message with wait time

### Issue: OTP not received
**Cause**: SMS delivery delay or Termii API issue
**Solution**: Allow resend after 30 seconds

## API Response Examples

### Success Responses

```json
// OTP Send Success
{
  "success": true,
  "message": "OTP sent successfully"
}

// OTP Verify Success
{
  "success": true,
  "message": "OTP verified successfully"
}

// Bid Placement Success
{
  "success": true,
  "bid": {
    "id": "bid-123",
    "auctionId": "auction-456",
    "vendorId": "vendor-789",
    "amount": "150000",
    "createdAt": "2026-04-27T10:30:00Z"
  }
}
```

### Error Responses

```json
// Rate Limit (Global)
{
  "success": false,
  "error": "Too many OTP requests. Please try again in 30 minutes."
}

// Rate Limit (Per-Auction)
{
  "success": false,
  "error": "Too many bid attempts for this auction. Please wait 5 minutes."
}

// OTP Expired
{
  "success": false,
  "error": "OTP expired or not found. Please request a new OTP."
}

// Invalid OTP
{
  "success": false,
  "error": "Invalid OTP. 2 attempts remaining."
}

// Max Attempts Exceeded
{
  "success": false,
  "error": "Maximum verification attempts exceeded. Please request a new OTP."
}
```

## Rollback Plan

If issues arise, frontend can temporarily revert to old endpoints:

```typescript
// Rollback to authentication endpoints
const USE_BIDDING_ENDPOINTS = false; // Feature flag

const otpSendUrl = USE_BIDDING_ENDPOINTS
  ? `/api/auctions/${auctionId}/otp/send`
  : '/api/auth/send-otp';

const otpVerifyUrl = USE_BIDDING_ENDPOINTS
  ? `/api/auctions/${auctionId}/otp/verify`
  : '/api/auth/verify-otp';
```

## Questions?

- **Backend Documentation**: `docs/BIDDING_OTP_RATE_LIMITS_FIX.md`
- **Quick Reference**: `docs/BIDDING_OTP_QUICK_REFERENCE.md`
- **API Routes**: `src/app/api/auctions/[id]/otp/`
