import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Clear all NextAuth session cookies
 * Useful for debugging when user is deleted from DB but session still exists
 */
export async function GET() {
  const cookieStore = await cookies();
  
  // Clear all NextAuth cookies
  const cookieNames = [
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.callback-url',
  ];

  cookieNames.forEach((name) => {
    cookieStore.delete(name);
  });

  return NextResponse.json({ 
    success: true, 
    message: 'Session cleared. You can now register/login again.' 
  });
}
