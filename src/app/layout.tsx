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
import { AppShell } from '@/components/providers/app-shell';
import { PublicBusinessPolicyProvider } from '@/hooks/public-business-policy-context';
import { businessPolicyService } from '@/features/business-policy';
import { getBrandCssVariables } from '@/features/branding/brand-colors';
import { getAppUrl } from '@/features/notifications/templates/email-urls';

const inter = Inter({ subsets: ['latin'], display: 'swap' });
const sora = Sora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['500', '600', '700'],
});

export const revalidate = 300;

function versionedAssetUrl(url: string, version: string) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const publicPolicy = await businessPolicyService.getPublicPolicy();
  const branding = publicPolicy.branding;
  const appUrl = getAppUrl();
  const title = `${branding.brandName} - Salvage Recovery And Auction Management`;
  const description =
    branding.homepageCopy.heroSubtitle ||
    `${branding.brandName} helps insurers manage salvage recovery, vendor verification, document signing, payments, and auctions.`;
  const iconUrl = versionedAssetUrl(branding.faviconPath || branding.logoPath || '/icons/icon-192.png', publicPolicy.version);
  const imageUrl = branding.logoPath || '/og-image.jpg';

  return {
    metadataBase: new URL(appUrl),
    title,
    description,
    keywords: [
      'salvage auctions',
      'insurance salvage',
      'vendor verification',
      'document signing',
      'auction management',
      'salvage recovery',
    ],
    authors: [{ name: branding.legalName || branding.brandName }],
    creator: branding.brandName,
    publisher: branding.legalName || branding.brandName,
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: branding.brandName,
    },
    icons: {
      icon: [{ url: iconUrl }],
      apple: [{ url: branding.logoPath || iconUrl }],
    },
    openGraph: {
      type: 'website',
      locale: 'en_NG',
      url: appUrl,
      title,
      description,
      siteName: branding.brandName,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${branding.brandName} salvage platform`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
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
  };
}

export async function generateViewport(): Promise<Viewport> {
  const publicPolicy = await businessPolicyService.getPublicPolicy();

  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    themeColor: publicPolicy.branding.primaryColor,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publicPolicy = await businessPolicyService.getPublicPolicy();
  const branding = publicPolicy.branding;
  const appUrl = getAppUrl();

  return (
    <html lang="en" data-scroll-behavior="smooth" style={getBrandCssVariables(branding)} suppressHydrationWarning>
      <head>
        <link rel="canonical" href={appUrl} />
        <link rel="icon" href={versionedAssetUrl(branding.faviconPath || '/icons/icon-192.png', publicPolicy.version)} />
        <link rel="apple-touch-icon" href={versionedAssetUrl(branding.faviconPath || branding.logoPath || '/icons/icon-192.png', publicPolicy.version)} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches||window.navigator.standalone;if(!s)return;if(sessionStorage.getItem('salvage-splash-session-v1')==='1')return;var recent=Number(localStorage.getItem('salvage-splash-recent-v1')||'0');if(Number.isFinite(recent)&&Date.now()-recent<600000){sessionStorage.setItem('salvage-splash-session-v1','1');return;}document.documentElement.classList.add('pwa-boot-lock');var el=document.getElementById('pwa-instant-splash');if(el)el.classList.add('pwa-instant-splash--visible');window.setTimeout(function(){document.documentElement.classList.remove('pwa-boot-lock');if(el)el.classList.add('pwa-instant-splash--hide');},8000);}catch(e){document.documentElement.classList.remove('pwa-boot-lock');}})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__PUBLIC_BUSINESS_POLICY__=${JSON.stringify(publicPolicy).replace(/</g, '\\u003c')};`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: branding.legalName,
              url: appUrl,
              logo: branding.logoPath,
              description: `${branding.brandName} salvage management platform`,
              contactPoint: {
                '@type': 'ContactPoint',
                telephone: branding.supportPhone || '',
                contactType: 'Customer Service',
                email: branding.supportEmail,
              },
            }),
          }}
        />
      </head>
      <body className={`${inter.className} ${sora.variable}`} suppressHydrationWarning>
        <div
          id="pwa-instant-splash"
          aria-hidden="true"
        >
          <p className="pwa-instant-title">{branding.brandName}</p>
          <p className="pwa-instant-sub">Salvage auctions</p>
        </div>
        <AuthProvider>
          <QueryProvider>
            <ToastProvider>
              <PublicBusinessPolicyProvider initialPolicy={publicPolicy}>
                <PwaSplashScreen />
                <ServiceWorkerRegister />
                <OfflineIndicator />
                <InstallPrompt />
                <CookieConsentBanner />
                <AppShell>
                  <div id="app-root">
                    {children}
                  </div>
                </AppShell>
              </PublicBusinessPolicyProvider>
            </ToastProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
