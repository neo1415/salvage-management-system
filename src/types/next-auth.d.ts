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
    };
    accessToken?: string;
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
    needsPhoneNumber?: boolean;
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
    userAgent?: string;
    accessToken?: string;
  }
}
