import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { OfflineIndicator } from '@/components/pwa/offline-indicator';
import { AuthProvider } from '@/lib/auth/auth-provider';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com'),
  title: 'Salvage Management System - AI-Powered Auctions for Nigerian Vendors | NEM Insurance',
  description: 'Transform salvage recovery with AI-powered auctions. Instant Paystack payments, real-time bidding, mobile PWA. Join 500+ Nigerian vendors. BVN verification, escrow wallet, gamified leaderboards.',
  keywords: ['salvage auctions', 'Nigerian vendors', 'AI damage assessment', 'Paystack payments', 'NEM Insurance', 'mobile auctions', 'real-time bidding', 'salvage management'],
  authors: [{ name: 'NEM Insurance Plc' }],
  creator: 'NEM Insurance Plc',
  publisher: 'NEM Insurance Plc',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Salvage Management',
  },
  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: 'https://salvage.nem-insurance.com',
    title: 'Salvage Management System - AI-Powered Auctions for Nigerian Vendors',
    description: 'Transform salvage recovery with AI-powered auctions. Instant payments, real-time bidding, mobile-first platform for Nigerian vendors.',
    siteName: 'NEM Insurance Salvage Management',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'NEM Insurance Salvage Management System',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Salvage Management System - AI-Powered Auctions',
    description: 'Transform salvage recovery with AI-powered auctions. Instant payments, real-time bidding for Nigerian vendors.',
    images: ['/twitter-image.jpg'],
    creator: '@neminsurance',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#800020',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="canonical" href="https://salvage.nem-insurance.com" />
        <link rel="icon" href="/icons/Nem-insurance-Logo.jpg" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'NEM Insurance Plc',
              url: 'https://salvage.nem-insurance.com',
              logo: 'https://salvage.nem-insurance.com/icons/Nem-insurance-Logo.jpg',
              description: 'Nigeria\'s leading salvage management platform with AI-powered auctions',
              address: {
                '@type': 'PostalAddress',
                streetAddress: '199 Ikorodu Road, Obanikoro',
                addressLocality: 'Lagos',
                addressCountry: 'NG',
              },
              contactPoint: {
                '@type': 'ContactPoint',
                telephone: '+234-02-014489560',
                contactType: 'Customer Service',
                email: 'nemsupport@nem-insurance.com',
              },
              sameAs: [
                'https://facebook.com/neminsurance',
                'https://twitter.com/neminsurance',
                'https://linkedin.com/company/neminsurance',
              ],
            }),
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          <ServiceWorkerRegister />
          <OfflineIndicator />
          <InstallPrompt />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
