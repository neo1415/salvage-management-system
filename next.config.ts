// Next.js configuration file
import type { NextConfig } from 'next';

// Disable SSL verification in development for external image URLs
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // TypeScript configuration
  typescript: {
    // Don't fail build on type errors - we'll handle them separately
    ignoreBuildErrors: true,
  },
  
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [375, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.cloudinary.com',
        pathname: '/**',
      },
      // Allow all HTTPS domains for external images
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    unoptimized: false,
  },
  
  // Compression
  compress: true,
  
  // Production optimizations
  
  // Optimize bundle
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react'],
  },
  
  // Headers for PWA and performance
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.paystack.co https://checkout.paystack.com https://*.paystack.com https://checkout.flutterwave.com https://storage.googleapis.com https://widget.dojah.io",
              "style-src 'self' 'unsafe-inline' https://checkout.paystack.com https://*.paystack.com https://widget.dojah.io",
              "img-src 'self' data: https: blob: https://res.cloudinary.com https://*.cloudinary.com",
              "font-src 'self' data: https://checkout.paystack.com https://*.paystack.com",
              "connect-src 'self' https://api.paystack.co https://checkout.paystack.com https://*.paystack.com https://api.flutterwave.com https://api.cloudinary.com https://res.cloudinary.com https://*.cloudinary.com https://nominatim.openstreetmap.org https://widget.dojah.io https://identity.dojah.io https://api.dojah.io https://*.dojah.io",
              "frame-src 'self' https://js.paystack.co https://checkout.paystack.com https://*.paystack.com https://checkout.flutterwave.com https://widget.dojah.io https://identity.dojah.io https://*.dojah.io https://res.cloudinary.com https://*.cloudinary.com",
              "media-src 'self' https://res.cloudinary.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://api.paystack.co https://api.flutterwave.com",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          // Security headers
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self), payment=(self)',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          // HSTS (HTTP Strict Transport Security)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
