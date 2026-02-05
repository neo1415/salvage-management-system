/**
 * Check Session Token Script
 * 
 * This script helps debug Socket.IO authentication issues by:
 * 1. Fetching the current session
 * 2. Decoding the access token
 * 3. Verifying the token format
 * 4. Checking if vendorId is present
 */

import { auth } from '../src/lib/auth/next-auth.config';

async function checkSessionToken() {
  console.log('🔍 Checking session token...\n');

  try {
    // Get current session
    const session = await auth();

    if (!session) {
      console.log('❌ No active session found');
      console.log('   Please log in first\n');
      return;
    }

    console.log('✅ Session found');
    console.log('   User ID:', session.user.id);
    console.log('   Email:', session.user.email);
    console.log('   Role:', session.user.role);
    console.log('   VendorId:', session.user.vendorId || 'Not set');
    console.log('');

    // Check access token
    if (!session.accessToken) {
      console.log('❌ No access token in session');
      console.log('   This is the problem! Access token is missing.\n');
      return;
    }

    console.log('✅ Access token found');
    console.log('   Token preview:', session.accessToken.substring(0, 50) + '...');
    console.log('');

    // Check if token is a JWT
    if (!session.accessToken.startsWith('eyJ')) {
      console.log('❌ Access token is not a JWT');
      console.log('   Expected format: eyJ...');
      console.log('   Actual format:', session.accessToken.substring(0, 20));
      console.log('   This is the problem! Token should be a JWT.\n');
      return;
    }

    console.log('✅ Access token is a valid JWT format');
    console.log('');

    // Decode JWT (without verification)
    try {
      const parts = session.accessToken.split('.');
      if (parts.length !== 3) {
        console.log('❌ Invalid JWT structure');
        console.log('   Expected 3 parts, got:', parts.length);
        return;
      }

      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      console.log('✅ JWT payload decoded:');
      console.log('   Subject (sub):', payload.sub);
      console.log('   Role:', payload.role);
      console.log('   VendorId:', payload.vendorId || 'Not set');
      console.log('   Email:', payload.email);
      console.log('   Expires:', new Date(payload.exp * 1000).toLocaleString());
      console.log('');

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        console.log('❌ Token is expired');
        console.log('   Expired at:', new Date(payload.exp * 1000).toLocaleString());
        console.log('   Current time:', new Date().toLocaleString());
        console.log('   Please log out and log in again.\n');
        return;
      }

      console.log('✅ Token is not expired');
      console.log('');

      // Verify token signature
      const jwt = require('jsonwebtoken');
      try {
        jwt.verify(session.accessToken, process.env.NEXTAUTH_SECRET!);
        console.log('✅ Token signature is valid');
        console.log('');
      } catch (err) {
        console.log('❌ Token signature is invalid');
        console.log('   Error:', err instanceof Error ? err.message : 'Unknown error');
        console.log('   This means the token was not signed with the correct secret.\n');
        return;
      }

      console.log('🎉 All checks passed!');
      console.log('   Your session token is valid and should work with Socket.IO.\n');

    } catch (err) {
      console.log('❌ Failed to decode JWT');
      console.log('   Error:', err instanceof Error ? err.message : 'Unknown error');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error checking session:', error);
  }
}

// Run the check
checkSessionToken().catch(console.error);
