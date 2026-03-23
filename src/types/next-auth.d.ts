import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  /**
   * Extend the built-in session type
   */
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      status: string;
      phone?: string;
      dateOfBirth?: string;
      requirePasswordChange?: boolean;
      needsPhoneNumber?: boolean;
      vendorId?: string;
    };
    accessToken?: string;
    sessionId?: string; // Unique session identifier to prevent session hijacking
  }

  /**
   * Extend the built-in user type
   */
  interface User {
    id: string;
    email: string;
    name: string;
    role?: string;
    status?: string;
    phone?: string;
    dateOfBirth?: string;
    needsPhoneNumber?: boolean;
    requirePasswordChange?: boolean;
    vendorId?: string;
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extend the built-in JWT type
   */
  interface JWT {
    id: string;
    email: string;
    role: string;
    status: string;
    phone?: string;
    dateOfBirth?: string;
    userAgent?: string;
    accessToken?: string;
    requirePasswordChange?: boolean;
    needsPhoneNumber?: boolean;
    sessionId?: string; // Unique session identifier to prevent token reuse
    vendorId?: string;
  }
}
