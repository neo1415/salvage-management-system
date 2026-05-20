import type { Metadata, Viewport } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { OfflineIndicator } from '@/components/pwa/offline-indicator';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { QueryProvider } from '@/lib/query-provider';
import { ToastProvider } from '@/components/ui/toast';
import { CookieConsentBanner } from '@/components/legal/cookie-consent-banner';
import { PwaSplashScreen } from '@/components/pwa/pwa-splash-screen';
import { PwaRouteTracker } from '@/components/pwa/pwa-route-tracker';

const inter = Inter({ subsets: ['latin'], display: 'swap' });
const sora = Sora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['500', '600', '700'],
});

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
    statusBarStyle: 'black-translucent',
    title: 'NEM Salvage',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
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
        <link rel="icon" href="/icons/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches||window.navigator.standalone;if(!s)return;document.documentElement.classList.add('pwa-boot-lock');var el=document.getElementById('pwa-instant-splash');if(el)el.classList.add('pwa-instant-splash--visible');window.setTimeout(function(){document.documentElement.classList.remove('pwa-boot-lock');if(el)el.classList.add('pwa-instant-splash--hide');},8000);}catch(e){document.documentElement.classList.remove('pwa-boot-lock');}})();`,
          }}
        />
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
      <body className={`${inter.className} ${sora.variable}`} suppressHydrationWarning>
        <div
          id="pwa-instant-splash"
          aria-hidden="true"
        >
          <p className="pwa-instant-title">NEM Salvage</p>
          <p className="pwa-instant-sub">Salvage auctions</p>
        </div>
        <AuthProvider>
          <QueryProvider>
            <ToastProvider>
              <PwaSplashScreen />
              <ServiceWorkerRegister />
              <OfflineIndicator />
              <InstallPrompt />
              <CookieConsentBanner />
              <div id="app-root">
                {children}
              </div>
            </ToastProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
