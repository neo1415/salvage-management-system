// Next.js configuration file
import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN || process.env.SENTRY_TOKEN;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  
  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
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
        hostname: '**.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'identity.dojah.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'widget.dojah.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.googleapis.com',
        pathname: '/**',
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
    serverActions: {
      bodySizeLimit: '30mb',
    },
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
              "connect-src 'self' https://api.paystack.co https://checkout.paystack.com https://*.paystack.com https://api.flutterwave.com https://api.cloudinary.com https://res.cloudinary.com https://*.cloudinary.com https://nominatim.openstreetmap.org https://widget.dojah.io https://identity.dojah.io https://api.dojah.io https://*.dojah.io https://www.googleapis.com",
              "frame-src 'self' https://js.paystack.co https://checkout.paystack.com https://*.paystack.com https://checkout.flutterwave.com https://widget.dojah.io https://identity.dojah.io https://*.dojah.io https://res.cloudinary.com https://*.cloudinary.com https://www.google.com https://maps.google.com",
              "media-src 'self' blob: https://res.cloudinary.com https://widget.dojah.io https://identity.dojah.io https://*.dojah.io",
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
            value: 'camera=(self "https://identity.dojah.io" "https://widget.dojah.io"), microphone=(self "https://identity.dojah.io" "https://widget.dojah.io"), fullscreen=(self "https://identity.dojah.io" "https://widget.dojah.io"), geolocation=(self "https://identity.dojah.io" "https://widget.dojah.io"), payment=(self)',
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
        source: '/manifest.:ext(json|webmanifest)',
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

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "salvage-bridge",

  project: "salvage",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
