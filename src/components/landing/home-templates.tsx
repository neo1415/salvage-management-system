'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { BrandingPolicy } from '@/features/business-policy/types';
import { getReadableTextColor } from '@/features/branding/brand-colors';
import { normalizeHomepageTemplate, resolveTemplateTheme } from './template-config';
import { Navigation } from './navigation';
import { HeroSection } from './hero-section';
import BelowFoldSections from './below-fold-sections';
import { ContactSection } from './contact-section';

type HomeTemplatesProps = {
  branding: BrandingPolicy;
  showLegacyBelowFold: boolean;
};

type TemplateVariant = 'editorial' | 'command' | 'orbit' | 'terminal';

const auctionLots = [
  {
    id: 'RCL-2847',
    name: '2022 BMW 5 Series',
    condition: 'Flood / total loss',
    bid: 'NGN 8.4M',
    time: '2h 14m',
    image: '/assets/hero-1.png',
  },
  {
    id: 'RCL-3102',
    name: '2021 Tesla Model 3',
    condition: 'Rear collision',
    bid: 'NGN 12.8M',
    time: '47m',
    image: '/assets/hero-2.png',
  },
  {
    id: 'RCL-1984',
    name: '2023 Toyota Camry',
    condition: 'Side impact',
    bid: 'NGN 4.2M',
    time: '6h 30m',
    image: '/assets/Hero-3.png',
  },
];

const processSteps = [
  ['01', 'Intake', 'Capture claim assets, documents, photos, AI notes, and location evidence.'],
  ['02', 'Review', 'Route approval, valuation, KYC, and fraud signals through controlled workflows.'],
  ['03', 'Auction', 'Run verified bidding with deposits, extensions, notifications, and audit trails.'],
  ['04', 'Settle', 'Generate branded documents, collect payment, and reconcile recovery value.'],
];

function getProcessSteps(copy: BrandingPolicy['homepageCopy']) {
  return [
    ['01', copy.workflowStepOneTitle || 'Intake', copy.workflowStepOneBody || processSteps[0][2]],
    ['02', copy.workflowStepTwoTitle || 'Review', copy.workflowStepTwoBody || processSteps[1][2]],
    ['03', copy.workflowStepThreeTitle || 'Auction', copy.workflowStepThreeBody || processSteps[2][2]],
    ['04', copy.workflowStepFourTitle || 'Settle', copy.workflowStepFourBody || processSteps[3][2]],
  ];
}

function getOperationsCards(copy: BrandingPolicy['homepageCopy']) {
  return [
    ['01', copy.operationsCardOneTitle || 'Vendor access', copy.operationsCardOneBody || 'Verification, registration fees, KYC tier, and bid limits keep vendor access controlled.'],
    ['02', copy.operationsCardTwoTitle || 'Auction rules', copy.operationsCardTwoBody || 'Reserve rules, extensions, document windows, and deadlines stay clear.'],
    ['03', copy.operationsCardThreeTitle || 'Payment steps', copy.operationsCardThreeBody || 'Wallet, deposit, and settlement steps help finance teams close each recovery.'],
  ];
}

function getProofCards(copy: BrandingPolicy['homepageCopy']) {
  return [
    [copy.proofCardOneTitle || 'Verified vendor access', copy.proofCardOneBody || 'KYC, registration fees, bid limits, and manual review keep access controlled.'],
    [copy.proofCardTwoTitle || 'Auditable auction flow', copy.proofCardTwoBody || 'Reserve rules, extensions, documents, payment deadlines, and fraud gates are traceable.'],
    [copy.proofCardThreeTitle || 'Branded documents', copy.proofCardThreeBody || 'Letterheads, legal names, support contacts, waivers, receipts, and reports stay consistent.'],
    [copy.proofCardFourTitle || 'Operational support', copy.proofCardFourBody || 'Email, SMS, push, contact forms, and reminders use the active brand details.'],
  ];
}

function cssVars(branding: BrandingPolicy, theme: 'day' | 'night') {
  return {
    '--wl-primary': branding.primaryColor,
    '--wl-accent': branding.accentColor,
    '--wl-dark': theme === 'night' ? '#0C0C0B' : '#111827',
    '--wl-light': theme === 'night' ? '#F4F3EE' : '#FFFFFF',
    '--wl-muted': theme === 'night' ? '#88877F' : '#64748B',
    '--wl-soft': theme === 'night' ? '#ECEAE3' : '#F3F4F6',
  } as CSSProperties;
}

function BrandWordmark({ branding, light = false }: { branding: BrandingPolicy; light?: boolean }) {
  const showImage = Boolean(branding.logoPath);
  return (
    <Link href="/" className="inline-flex items-center gap-3">
      {showImage ? (
        <Image src={branding.logoPath} alt={`${branding.brandName} logo`} width={34} height={34} className="h-8 w-8 rounded-md object-contain" unoptimized />
      ) : (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: branding.accentColor }} />
      )}
      <span className={`font-black tracking-[-0.04em] ${light ? 'text-[#F4F3EE]' : 'text-[#0C0C0B]'}`}>{branding.brandName}</span>
    </Link>
  );
}

function TemplateNav({ branding, light = true }: { branding: BrandingPolicy; light?: boolean }) {
  return (
    <nav className={`fixed left-0 right-0 top-0 z-50 border-b px-5 py-4 backdrop-blur-md ${light ? 'border-white/10 bg-black/15' : 'border-black/10 bg-white/80'}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <BrandWordmark branding={branding} light={light} />
        <div className={`hidden items-center gap-7 text-[11px] font-semibold uppercase tracking-[0.16em] md:flex ${light ? 'text-white/55' : 'text-black/55'}`}>
          <a href="#platform" className="hover:text-[var(--wl-accent)]">Platform</a>
          <a href="#auctions" className="hover:text-[var(--wl-accent)]">Auctions</a>
          <a href="#workflow" className="hover:text-[var(--wl-accent)]">Workflow</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className={`rounded-full border px-4 py-2 text-sm font-semibold ${light ? 'border-white/25 text-white hover:bg-white hover:text-black' : 'border-black/20 text-black hover:bg-black hover:text-white'}`}>
            Sign in
          </Link>
          <Link href="/register" className="hidden rounded-full px-5 py-2 text-sm font-bold sm:inline-flex" style={{ backgroundColor: branding.accentColor, color: branding.primaryColor }}>
            Register
          </Link>
        </div>
      </div>
    </nav>
  );
}

function TemplateFooter({ branding, dark = true }: { branding: BrandingPolicy; dark?: boolean }) {
  const linkClass = dark ? 'text-white/45 hover:text-white' : 'text-black/50 hover:text-black';

  return (
    <footer className={`px-5 py-10 ${dark ? 'bg-[#0C0C0B] text-white' : 'bg-white text-[#0C0C0B]'}`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 border-t border-current/10 pt-8 md:flex-row md:items-start md:justify-between">
        <div>
          <BrandWordmark branding={branding} light={dark} />
          <p className={`mt-3 max-w-md text-sm leading-7 ${dark ? 'text-white/45' : 'text-black/55'}`}>
            {branding.homepageCopy.trustLine || `${branding.legalName} salvage recovery platform.`}
          </p>
        </div>
        <div className="grid gap-4 text-sm sm:grid-cols-2 md:text-right">
          <div className="flex flex-col gap-2">
            <Link href="/privacy" className={linkClass}>Privacy Policy</Link>
            <Link href="/cookies" className={linkClass}>Cookie Policy</Link>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/terms" className={linkClass}>Terms of Service</Link>
            <Link href="/ndpr" className={linkClass}>NDPR Compliance</Link>
          </div>
        </div>
      </div>
      <div className={`mx-auto mt-8 max-w-7xl text-xs ${dark ? 'text-white/30' : 'text-black/40'}`}>
        &copy; {new Date().getFullYear()} {branding.legalName}. All rights reserved.
      </div>
    </footer>
  );
}

function MediaFrame({
  lot,
  dark,
  className = '',
}: {
  lot: (typeof auctionLots)[number];
  dark: boolean;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl border ${dark ? 'border-white/10 bg-white/[0.05]' : 'border-black/10 bg-black/[0.03]'} ${className}`}>
      <Image
        src={lot.image}
        alt={`${lot.name} salvage preview`}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 100vw, 560px"
      />
      <div className={`absolute inset-0 ${dark ? 'bg-gradient-to-t from-black/80 via-black/20 to-transparent' : 'bg-gradient-to-t from-black/55 via-black/5 to-transparent'}`} />
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">Lot {lot.id}</p>
          <p className="mt-1 text-lg font-black tracking-[-0.04em] text-white">{lot.name}</p>
        </div>
        <p className="shrink-0 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#0C0C0B' }}>
          {lot.bid}
        </p>
      </div>
    </div>
  );
}

function Splash({ branding }: { branding: BrandingPolicy }) {
  return (
    <motion.div
      className="fixed inset-0 z-[9000] grid place-items-center bg-[#0C0C0B]"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0, pointerEvents: 'none' }}
      transition={{ delay: 1.15, duration: 0.55 }}
      aria-hidden
    >
      <div className="absolute inset-x-0 top-8 overflow-hidden border-y border-white/10 py-3 text-[10px] uppercase tracking-[0.3em] text-white/25">
        <motion.div className="whitespace-nowrap" animate={{ x: ['0%', '-50%'] }} transition={{ repeat: Infinity, duration: 16, ease: 'linear' }}>
          Loading salvage recovery - Loading auctions - Loading compliance - Loading payments - Loading salvage recovery - Loading auctions - Loading compliance - Loading payments -
        </motion.div>
      </div>
      <div className="text-center">
        <p className="font-black text-5xl tracking-[-0.06em] text-[#F4F3EE] sm:text-7xl">{branding.brandName}</p>
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.32em]" style={{ color: branding.accentColor }}>Recovery loading</p>
      </div>
      <div className="absolute inset-x-0 bottom-8 overflow-hidden border-y border-white/10 py-3 text-[10px] uppercase tracking-[0.3em] text-white/25">
        <motion.div className="whitespace-nowrap" animate={{ x: ['-50%', '0%'] }} transition={{ repeat: Infinity, duration: 18, ease: 'linear' }}>
          Verified vendors - Case intake - Branded documents - Audit trails - Verified vendors - Case intake - Branded documents - Audit trails -
        </motion.div>
      </div>
    </motion.div>
  );
}

export function WhiteLabelHomeTemplates({ branding, showLegacyBelowFold }: HomeTemplatesProps) {
  const template = normalizeHomepageTemplate(branding.homepageTemplate);
  const theme = resolveTemplateTheme(branding);

  if (template === 'nem_salvage') {
    return (
      <main className="min-h-screen bg-white">
        <Navigation />
        <HeroSection />
        {showLegacyBelowFold && <BelowFoldSections />}
      </main>
    );
  }

  if (template === 'recovery_command') return <RecoveryCommand branding={branding} theme={theme} />;
  if (template === 'claims_orbit') return <ClaimsOrbit branding={branding} theme={theme} />;
  if (template === 'executive_terminal') return <ExecutiveTerminal branding={branding} theme={theme} />;
  return <ReclaimEditorial branding={branding} theme={theme} />;
}

function ReclaimEditorial({ branding, theme }: { branding: BrandingPolicy; theme: 'day' | 'night' }) {
  const copy = branding.homepageCopy;
  const accentText = getReadableTextColor(branding.accentColor);
  return (
    <main className="min-h-screen bg-[#C6C4BD] font-sans" style={cssVars(branding, theme)}>
      {branding.splashEnabled ? <Splash branding={branding} /> : null}
      <TemplateNav branding={branding} light />
      <section className="relative flex min-h-screen flex-col justify-end overflow-hidden bg-[#0C0C0B] px-5 pb-12 pt-28 text-[#F4F3EE]">
        <div className="absolute left-0 right-0 top-20 overflow-hidden border-y border-white/10 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/25">
          <motion.div className="flex min-w-max gap-8 whitespace-nowrap" animate={{ x: ['0%', '-50%'] }} transition={{ repeat: Infinity, duration: 22, ease: 'linear' }}>
            {[...auctionLots, ...auctionLots].map((lot, index) => (
              <span key={`${lot.id}-${index}`}>{lot.id} - {lot.name} - <span style={{ color: branding.accentColor }}>{lot.bid} rising</span></span>
            ))}
          </motion.div>
        </div>
        <div className="mx-auto w-full max-w-7xl">
          <p className="mb-8 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">
            <span className="h-px w-8 bg-white/35" /> {copy.eyebrow}
          </p>
          <div className="border-y border-white/10">
            {['Re', 'claim', 'Value'].map((word, index) => (
              <motion.div
                key={word}
                className="flex items-center gap-4 border-b border-white/10 py-3 last:border-b-0"
                initial={{ opacity: 0, y: 46 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + index * 0.12, duration: 0.7 }}
              >
                <span className="min-w-0 flex-1 font-black leading-none tracking-[-0.07em] text-[clamp(54px,10vw,116px)]" style={word === 'claim' ? { color: branding.accentColor } : undefined}>{word}</span>
                <span className="hidden h-[58px] w-[188px] shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/[0.06] sm:block">
                  <span className="grid h-full place-items-center font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">{index === 0 ? 'Live lots' : index === 1 ? 'Bid flow' : 'Payouts'}</span>
                </span>
                <span className="hidden w-32 shrink-0 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-white/40 md:block">{index === 0 ? 'Auction' : index === 1 ? 'Platform' : 'Recovered'}</span>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <h1 className="max-w-4xl text-3xl font-black leading-tight tracking-[-0.05em] sm:text-5xl">{copy.heroTitle}</h1>
              <p className="mt-4 max-w-2xl text-base font-light leading-8 text-white/55">{copy.heroSubtitle}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="rounded-full px-6 py-4 text-center text-sm font-bold" style={{ backgroundColor: branding.accentColor, color: accentText }}>{copy.primaryCtaLabel}</Link>
              <Link href="/login" className="rounded-full border border-white/25 px-6 py-4 text-center text-sm font-bold text-white">{copy.secondaryCtaLabel || 'Sign in'}</Link>
            </div>
          </div>
          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {auctionLots.map((lot, index) => (
              <MediaFrame key={lot.id} lot={lot} dark className={index === 1 ? 'h-56 md:h-64' : 'h-48 md:h-56'} />
            ))}
          </div>
        </div>
      </section>
      <section id="platform" className="bg-[#F4F3EE] px-5 py-24 text-[#0C0C0B]">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#88877F]">About {branding.brandName}</p>
            <h2 className="mt-8 max-w-xl text-4xl font-black leading-tight tracking-[-0.05em]">{copy.supportingText}</h2>
          </div>
          <div className="grid gap-0.5">
            {[
              [copy.statOneValue, copy.statOneLabel],
              [copy.statTwoValue, copy.statTwoLabel],
              [copy.statThreeValue, copy.statThreeLabel],
              ['Audit', 'Traceable decisions'],
            ].map(([value, label]) => (
              <div key={`${value}-${label}`} className="flex items-center justify-between border border-black/10 bg-[#ECEAE3] px-6 py-5">
                <span className="text-3xl font-black tracking-[-0.04em]">{value}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#88877F]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <EditorialRecoveryBrief branding={branding} />
      <ProcessAndLots branding={branding} dark variant="editorial" />
      <TemplateProofAndContact branding={branding} dark variant="editorial" />
      <ContactSection />
      <TemplateFooter branding={branding} dark />
    </main>
  );
}

function RecoveryCommand({ branding, theme }: { branding: BrandingPolicy; theme: 'day' | 'night' }) {
  const copy = branding.homepageCopy;
  const dark = theme === 'night';
  const primaryText = getReadableTextColor(branding.primaryColor);
  return (
    <main className={`min-h-screen ${dark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-950'}`} style={cssVars(branding, theme)}>
      {branding.splashEnabled ? <Splash branding={branding} /> : null}
      <TemplateNav branding={branding} light={dark} />
      <section className="px-5 pb-20 pt-32">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em]" style={{ color: branding.accentColor }}>{copy.eyebrow || 'Recovery command center'}</p>
            <h1 className="mt-6 text-5xl font-black leading-[0.95] tracking-[-0.06em] sm:text-7xl">{copy.heroTitle}</h1>
            <p className={`mt-6 max-w-xl text-lg leading-8 ${dark ? 'text-white/60' : 'text-slate-600'}`}>{copy.heroSubtitle}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="rounded-md px-6 py-4 text-center text-sm font-bold" style={{ backgroundColor: branding.primaryColor, color: primaryText }}>{copy.primaryCtaLabel}</Link>
              <Link href="/login" className={`rounded-md border px-6 py-4 text-center text-sm font-bold ${dark ? 'border-white/15 text-white' : 'border-slate-300 text-slate-900'}`}>{copy.secondaryCtaLabel || 'Sign in'}</Link>
            </div>
          </div>
          <MediaFrame lot={auctionLots[0]} dark={dark} className="h-72 lg:hidden" />
          <div className={`rounded-lg border p-3 shadow-2xl ${dark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white'}`}>
            <MediaFrame lot={auctionLots[1]} dark={dark} className="mb-3 h-56" />
            <div className="grid gap-3 md:grid-cols-3">
              {[[copy.statOneLabel, copy.statOneValue], [copy.statTwoLabel, copy.statTwoValue], [copy.statThreeLabel, copy.statThreeValue]].map(([label, value]) => (
                <div key={label} className={`rounded-md p-4 ${dark ? 'bg-slate-900' : 'bg-slate-50'}`}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
                  <p className="mt-3 text-3xl font-black tracking-[-0.04em]">{value}</p>
                </div>
              ))}
            </div>
            <div className={`mt-3 rounded-md p-5 ${dark ? 'bg-slate-900' : 'bg-slate-100'}`}>
              <div className="mb-5 flex items-center justify-between">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-500">Live recovery board</p>
                <span className="rounded-full bg-red-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-red-500">Live</span>
              </div>
              <div className="space-y-3">
                {auctionLots.map((lot) => (
                  <div key={lot.id} className={`grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-md border p-3 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-white'}`}>
                    <span className="font-mono text-xs text-slate-500">{lot.id}</span>
                    <div><p className="font-bold">{lot.name}</p><p className="text-sm text-slate-500">{lot.condition}</p></div>
                    <p className="font-black" style={{ color: branding.accentColor }}>{lot.bid}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <CommandOperationsBand branding={branding} dark={dark} />
      <ProcessAndLots branding={branding} dark={dark} variant="command" />
      <TemplateProofAndContact branding={branding} dark={dark} variant="command" />
      <ContactSection />
      <TemplateFooter branding={branding} dark={dark} />
    </main>
  );
}

function ClaimsOrbit({ branding, theme }: { branding: BrandingPolicy; theme: 'day' | 'night' }) {
  const copy = branding.homepageCopy;
  const dark = theme === 'night';
  const accentText = getReadableTextColor(branding.accentColor);
  const [active, setActive] = useState(0);
  const processCards = useMemo(() => getProcessSteps(copy), [copy]);
  const cards = useMemo(() => processCards.map((step) => ({ step, lot: auctionLots[Number(step[0]) % auctionLots.length] })), [processCards]);
  useEffect(() => {
    const timer = setInterval(() => setActive((value) => (value + 1) % cards.length), 3200);
    return () => clearInterval(timer);
  }, [cards.length]);

  return (
    <main className={`min-h-screen overflow-hidden ${dark ? 'bg-[#101014] text-white' : 'bg-[#FAFAF7] text-zinc-950'}`} style={cssVars(branding, theme)}>
      {branding.splashEnabled ? <Splash branding={branding} /> : null}
      <TemplateNav branding={branding} light={dark} />
      <section className="relative px-5 pb-20 pt-32">
        <div className="absolute right-0 top-24 hidden h-[520px] w-[38vw] overflow-hidden rounded-l-[32px] opacity-25 lg:block">
          <Image src={auctionLots[2].image} alt="Salvage asset background" fill className="object-cover" sizes="38vw" />
        </div>
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_520px] lg:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em]" style={{ color: branding.accentColor }}>{copy.eyebrow || 'Connected recovery pipeline'}</p>
            <h1 className="mt-6 text-5xl font-black leading-none tracking-[-0.06em] sm:text-7xl">{copy.heroTitle}</h1>
            <p className={`mt-6 max-w-2xl text-lg leading-8 ${dark ? 'text-white/58' : 'text-zinc-600'}`}>{copy.heroSubtitle}</p>
            <div className="mt-8 flex gap-3">
              <Link href="/register" className="rounded-full px-6 py-4 text-sm font-bold" style={{ backgroundColor: branding.accentColor, color: accentText }}>{copy.primaryCtaLabel}</Link>
              <Link href="/login" className={`rounded-full border px-6 py-4 text-sm font-bold ${dark ? 'border-white/20 text-white' : 'border-zinc-300 text-zinc-950'}`}>{copy.secondaryCtaLabel || 'Sign in'}</Link>
            </div>
          </div>
          <div className="relative min-h-[460px]">
            {cards.map(({ step, lot }, index) => {
              const selected = index === active;
              return (
                <motion.button
                  key={step[0]}
                  type="button"
                  onClick={() => setActive(index)}
                  className={`absolute left-1/2 top-1/2 w-72 rounded-2xl border p-5 text-left shadow-xl backdrop-blur ${dark ? 'border-white/10 bg-white/10' : 'border-zinc-200 bg-white/90'}`}
                  animate={{
                    x: Math.cos((index / cards.length) * Math.PI * 2) * (selected ? 44 : 150) - 144,
                    y: Math.sin((index / cards.length) * Math.PI * 2) * (selected ? 18 : 130) - 90,
                    scale: selected ? 1.08 : 0.86,
                    opacity: selected ? 1 : 0.68,
                    zIndex: selected ? 10 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                >
                  <p className="font-mono text-xs uppercase tracking-[0.18em]" style={{ color: branding.accentColor }}>{step[0]} - {step[1]}</p>
                  <p className="mt-4 text-lg font-black">{lot.name}</p>
                  <p className={`mt-2 text-sm leading-6 ${dark ? 'text-white/55' : 'text-zinc-600'}`}>{step[2]}</p>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>
      <OrbitPipelineBand branding={branding} dark={dark} />
      <ProcessAndLots branding={branding} dark={dark} variant="orbit" />
      <TemplateProofAndContact branding={branding} dark={dark} variant="orbit" />
      <ContactSection />
      <TemplateFooter branding={branding} dark={dark} />
    </main>
  );
}

function ExecutiveTerminal({ branding, theme }: { branding: BrandingPolicy; theme: 'day' | 'night' }) {
  const copy = branding.homepageCopy;
  const dark = theme === 'night';
  const primaryText = getReadableTextColor(branding.primaryColor);
  return (
    <main className={`min-h-screen ${dark ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-950'}`} style={cssVars(branding, theme)}>
      <section className="grid min-h-screen lg:grid-cols-[440px_1fr]">
        <aside className={`flex flex-col justify-between border-r p-8 ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-neutral-200 bg-neutral-50'}`}>
          <BrandWordmark branding={branding} light={dark} />
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em]" style={{ color: branding.accentColor }}>{copy.eyebrow || 'Private salvage portal'}</p>
            <h1 className="mt-6 text-5xl font-black leading-none tracking-[-0.06em]">{copy.heroTitle}</h1>
            <p className={`mt-6 leading-8 ${dark ? 'text-white/60' : 'text-neutral-600'}`}>{copy.heroSubtitle}</p>
            <div className="mt-8 flex flex-col gap-3">
              <Link href="/login" className="rounded-md px-5 py-4 text-center font-bold" style={{ backgroundColor: branding.primaryColor, color: primaryText }}>{copy.secondaryCtaLabel || 'Sign in'}</Link>
              <Link href="/register" className={`rounded-md border px-5 py-4 text-center font-bold ${dark ? 'border-white/15 text-white' : 'border-neutral-300 text-neutral-950'}`}>{copy.primaryCtaLabel}</Link>
            </div>
          </div>
          <p className={`text-xs ${dark ? 'text-white/35' : 'text-neutral-500'}`}>{copy.trustLine}</p>
        </aside>
        <section className="flex items-center px-6 py-24 lg:px-16">
          <div className="grid w-full gap-3">
            <MediaFrame lot={auctionLots[0]} dark={dark} className="mb-4 h-64" />
            {processSteps.map((step) => (
              <div key={step[0]} className={`grid gap-5 rounded-lg border p-6 md:grid-cols-[90px_1fr] ${dark ? 'border-white/10 bg-white/[0.03]' : 'border-neutral-200 bg-neutral-50'}`}>
                <p className="font-mono text-sm" style={{ color: branding.accentColor }}>{step[0]}</p>
                <div><h2 className="text-2xl font-black tracking-[-0.04em]">{step[1]}</h2><p className={`mt-2 leading-7 ${dark ? 'text-white/55' : 'text-neutral-600'}`}>{step[2]}</p></div>
              </div>
            ))}
          </div>
        </section>
      </section>
      <TerminalDossierBand branding={branding} dark={dark} />
      <ProcessAndLots branding={branding} dark={dark} variant="terminal" />
      <TemplateProofAndContact branding={branding} dark={dark} variant="terminal" />
      <ContactSection />
      <TemplateFooter branding={branding} dark={dark} />
    </main>
  );
}

function EditorialRecoveryBrief({ branding }: { branding: BrandingPolicy }) {
  const copy = branding.homepageCopy;
  return (
    <section className="bg-[#0C0C0B] px-5 py-20 text-[#F4F3EE]">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="border border-white/10 p-8 md:p-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: branding.accentColor }}>
            Recovery brief
          </p>
          <h2 className="mt-8 max-w-3xl text-5xl font-black leading-none tracking-[-0.06em]">
            {copy.recoveryBriefTitle || 'One clear path from claim intake to signed handover.'}
          </h2>
          <p className="mt-6 max-w-2xl text-sm leading-8 text-white/55">
            {copy.recoveryBriefBody || 'This style frames salvage as a premium recovery journey while still showing trust markers, auction inventory, and contact points.'}
          </p>
        </div>
        <div className="grid gap-0.5">
          {[
            ['Evidence', 'Photos, notes, KYC, and audit trails stay attached to each recovery decision.'],
            ['Liquidity', 'Verified vendors compete in controlled auctions with payment and document gates.'],
            ['Identity', `${branding.brandName} appears consistently across public pages, documents, and email.`],
          ].map(([title, body]) => (
            <div key={title} className="border border-white/10 bg-white/[0.04] p-7">
              <p className="text-2xl font-black tracking-[-0.04em]">{title}</p>
              <p className="mt-3 text-sm leading-7 text-white/50">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CommandOperationsBand({ branding, dark }: { branding: BrandingPolicy; dark: boolean }) {
  const copy = branding.homepageCopy;
  const shell = dark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-950';
  const panel = dark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white';
  const muted = dark ? 'text-white/55' : 'text-slate-600';
  const cards = getOperationsCards(copy);

  return (
    <section className={`px-5 py-20 ${shell}`}>
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[360px_1fr]">
        <div className={`rounded-lg border p-6 ${panel}`}>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: branding.accentColor }}>
            {copy.operationsSectionEyebrow || 'Control stack'}
          </p>
          <h2 className="mt-5 text-4xl font-black leading-none tracking-[-0.05em]">{copy.operationsSectionTitle || 'Recovery rules on one board.'}</h2>
          <p className={`mt-5 text-sm leading-7 ${muted}`}>
            {copy.operationsSectionSubtitle || 'Best for teams that want the homepage to feel like a control room for claims, auctions, payments, and documents.'}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {cards.map(([step, title, body]) => (
            <article key={step} className={`rounded-lg border p-6 ${panel}`}>
              <span className="font-mono text-xs" style={{ color: branding.accentColor }}>{step}</span>
              <h3 className="mt-8 text-2xl font-black tracking-[-0.04em]">{title}</h3>
              <p className={`mt-4 text-sm leading-7 ${muted}`}>{body}</p>
              <div className="mt-6 h-2 rounded-full bg-current/10">
                <div className="h-2 rounded-full" style={{ width: `${60 + Number(step) * 10}%`, backgroundColor: branding.accentColor }} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function OrbitPipelineBand({ branding, dark }: { branding: BrandingPolicy; dark: boolean }) {
  const copy = branding.homepageCopy;
  const shell = dark ? 'bg-[#101014] text-white' : 'bg-[#FAFAF7] text-zinc-950';
  const muted = dark ? 'text-white/55' : 'text-zinc-600';
  const steps = getProcessSteps(copy);

  return (
    <section className={`relative overflow-hidden px-5 py-24 ${shell}`}>
      <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-current/10" />
      <div className="absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-current/10" />
      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: branding.accentColor }}>
            {copy.operationsSectionEyebrow || 'Connected loop'}
          </p>
          <h2 className="mt-5 text-5xl font-black leading-none tracking-[-0.06em]">{copy.operationsSectionTitle || 'Claims, vendors, payments, and documents stay in orbit.'}</h2>
          <p className={`mt-5 text-sm leading-7 ${muted}`}>
            {copy.operationsSectionSubtitle || 'This style is built for an animated, relationship-driven story where each team sees how their work connects.'}
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-4">
          {steps.map((step, index) => (
            <motion.div
              key={step[0]}
              className={`rounded-full border p-7 text-center backdrop-blur ${dark ? 'border-white/10 bg-white/[0.06]' : 'border-zinc-200 bg-white/80'}`}
              animate={{ y: [0, index % 2 === 0 ? -10 : 10, 0] }}
              transition={{ repeat: Infinity, duration: 5 + index, ease: 'easeInOut' }}
            >
              <p className="font-mono text-xs" style={{ color: branding.accentColor }}>{step[0]}</p>
              <h3 className="mt-6 text-xl font-black">{step[1]}</h3>
              <p className={`mt-3 text-xs leading-6 ${muted}`}>{step[2]}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TerminalDossierBand({ branding, dark }: { branding: BrandingPolicy; dark: boolean }) {
  const copy = branding.homepageCopy;
  const shell = dark ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-950';
  const row = dark ? 'border-white/10 bg-white/[0.03]' : 'border-neutral-200 bg-neutral-50';
  const muted = dark ? 'text-white/50' : 'text-neutral-600';
  const cards = getOperationsCards(copy);

  return (
    <section className={`px-5 py-20 ${shell}`}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: branding.accentColor }}>{copy.operationsSectionEyebrow || 'Executive dossier'}</p>
            <h2 className="mt-4 text-4xl font-black tracking-[-0.05em]">{copy.operationsSectionTitle || 'Minimal surface, complete operating record.'}</h2>
          </div>
          <p className={`max-w-xl text-sm leading-7 ${muted}`}>
            {copy.operationsSectionSubtitle || 'This style is intentionally quiet for teams that want a controlled entry point.'}
          </p>
        </div>
        <div className="overflow-hidden rounded-md border border-current/10">
          {cards.map(([, title, body], index) => (
            <div key={title} className={`grid gap-4 border-b border-current/10 p-5 last:border-b-0 md:grid-cols-[72px_240px_1fr] ${row}`}>
              <p className="font-mono text-xs" style={{ color: branding.accentColor }}>#{String(index + 1).padStart(2, '0')}</p>
              <p className="font-mono text-sm uppercase tracking-[0.12em]">{title}</p>
              <p className={`text-sm leading-7 ${muted}`}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProcessAndLots({ branding, dark, variant }: { branding: BrandingPolicy; dark: boolean; variant: TemplateVariant }) {
  const accentText = getReadableTextColor(branding.accentColor);
  const copy = branding.homepageCopy;
  const steps = getProcessSteps(copy);
  const workflowTitle = variant === 'command'
    ? 'Operations command sequence'
    : variant === 'orbit'
      ? 'Claims-to-capital orbit'
      : variant === 'terminal'
        ? 'Control room protocol'
        : 'Workflow';
  const auctionTitle = variant === 'command'
    ? 'Command board inventory'
    : variant === 'orbit'
      ? 'Assets in motion'
      : variant === 'terminal'
        ? 'Executive lot ledger'
        : 'Auction-ready inventory';
  const workflowCardClass = variant === 'orbit'
    ? 'rounded-full aspect-square flex flex-col justify-center text-center'
    : variant === 'terminal'
      ? 'rounded-md font-mono'
      : variant === 'command'
        ? 'rounded-lg'
        : '';

  return (
    <>
      <section id="workflow" className={`px-5 py-20 ${dark ? 'bg-[#0C0C0B] text-[#F4F3EE]' : 'bg-white text-slate-950'}`}>
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: branding.accentColor }}>{copy.workflowTitle || workflowTitle}</p>
          {copy.workflowSubtitle ? <p className={`mt-3 max-w-2xl text-sm leading-7 ${dark ? 'text-white/50' : 'text-slate-600'}`}>{copy.workflowSubtitle}</p> : null}
          <div className={`mt-8 grid md:grid-cols-4 ${variant === 'orbit' ? 'gap-5' : 'gap-0.5'}`}>
            {steps.map((step) => (
              <div key={step[0]} className={`border p-7 ${workflowCardClass} ${dark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-50'}`}>
                <p className="font-mono text-xs text-slate-500">{step[0]}</p>
                <h3 className="mt-8 text-2xl font-black tracking-[-0.04em]">{step[1]}</h3>
                <p className={`mt-4 text-sm leading-7 ${dark ? 'text-white/50' : 'text-slate-600'}`}>{step[2]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section id="auctions" className={`px-5 py-20 ${dark ? 'bg-[#F4F3EE] text-[#0C0C0B]' : 'bg-slate-950 text-white'}`}>
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: branding.accentColor }}>{copy.auctionSectionEyebrow || 'Live now'}</p>
              <h2 className="mt-4 text-4xl font-black tracking-[-0.05em]">{copy.auctionSectionTitle || auctionTitle}</h2>
            </div>
            <Link href="/login" className="rounded-full px-5 py-3 text-sm font-bold" style={{ backgroundColor: branding.accentColor, color: accentText }}>{copy.auctionSectionButtonLabel || 'Open workspace'}</Link>
          </div>
          <div className={`mt-10 grid md:grid-cols-3 ${variant === 'terminal' ? 'gap-3' : 'gap-0.5'}`}>
            {auctionLots.map((lot) => (
              <article key={lot.id} className={`border p-6 ${variant === 'terminal' ? 'rounded-md font-mono' : variant === 'command' ? 'rounded-lg' : ''} ${dark ? 'border-black/10 bg-[#ECEAE3]' : 'border-white/10 bg-white/[0.05]'}`}>
                <MediaFrame lot={lot} dark={!dark} className="mb-5 h-44" />
                <p className="font-mono text-xs opacity-55">Lot {lot.id}</p>
                <h3 className="mt-3 text-xl font-black tracking-[-0.04em]">{lot.name}</h3>
                <p className="mt-2 text-sm opacity-60">{lot.condition}</p>
                <div className="mt-6 flex items-end justify-between border-t border-current/10 pt-5">
                  <div><p className="font-mono text-[10px] uppercase opacity-50">Current bid</p><p className="text-2xl font-black" style={{ color: branding.accentColor }}>{lot.bid}</p></div>
                  <Link href="/login" className="rounded-full bg-current px-4 py-2 text-sm font-bold"><span className={dark ? 'text-[#F4F3EE]' : 'text-slate-950'}>Bid</span></Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function TemplateProofAndContact({ branding, dark, variant }: { branding: BrandingPolicy; dark: boolean; variant: TemplateVariant }) {
  const copy = branding.homepageCopy;
  const accentText = getReadableTextColor(branding.accentColor);
  const surfaceClass = dark ? 'bg-[#0C0C0B] text-[#F4F3EE]' : 'bg-white text-slate-950';
  const panelClass = dark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-slate-50';
  const mutedClass = dark ? 'text-white/55' : 'text-slate-600';
  const sectionLabel = variant === 'command'
    ? 'Command assurance'
    : variant === 'orbit'
      ? 'Orbit controls'
      : variant === 'terminal'
        ? 'Access dossier'
        : 'Trust and access';
  const gridClass = variant === 'terminal'
    ? 'grid gap-3'
    : variant === 'orbit'
      ? 'grid gap-5 md:grid-cols-2'
      : 'grid gap-3 md:grid-cols-2';
  const cardShape = variant === 'orbit' ? 'rounded-3xl' : variant === 'terminal' ? 'rounded-md font-mono' : 'rounded-xl';
  const proofCards = getProofCards(copy);
  const contactItems = [
    ['Support', branding.supportEmail],
    ['Phone', branding.supportPhone || 'Configured in enterprise setup'],
    ['Legal entity', branding.legalName],
  ];

  return (
    <section id="platform-proof" className={`px-5 py-20 ${surfaceClass}`}>
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: branding.accentColor }}>
            {sectionLabel}
          </p>
          <h2 className="mt-5 max-w-xl text-4xl font-black leading-tight tracking-[-0.05em]">
            {copy.proofSectionTitle || copy.supportingText || 'Controlled salvage recovery from intake to settlement.'}
          </h2>
          <p className={`mt-5 max-w-xl text-sm leading-7 ${mutedClass}`}>
            {copy.proofSectionSubtitle || copy.trustLine || 'Configure vendor onboarding, auctions, documents, notifications, and public pages from one place.'}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register" className="rounded-full px-5 py-3 text-center text-sm font-bold" style={{ backgroundColor: branding.accentColor, color: accentText }}>
              {copy.primaryCtaLabel}
            </Link>
            <Link href="/contact" className={`rounded-full border px-5 py-3 text-center text-sm font-bold ${dark ? 'border-white/20 text-white' : 'border-slate-300 text-slate-950'}`}>
              Contact team
            </Link>
          </div>
        </div>
        <div className={gridClass}>
          {proofCards.map(([title, body]) => (
            <article key={title} className={`min-h-40 border p-6 ${cardShape} ${panelClass}`}>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: branding.accentColor }}>Platform</p>
              <h3 className="mt-5 text-xl font-black tracking-[-0.04em]">{title}</h3>
              <p className={`mt-3 text-sm leading-7 ${mutedClass}`}>{body}</p>
            </article>
          ))}
          <article className={`border p-6 ${cardShape} ${variant === 'terminal' ? '' : 'md:col-span-2'} ${panelClass}`}>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: branding.accentColor }}>{copy.proofContactLabel || 'Contact'}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {contactItems.map(([label, value]) => (
                <div key={label}>
                  <p className={`text-xs uppercase tracking-[0.14em] ${mutedClass}`}>{label}</p>
                  <p className="mt-2 break-words text-sm font-bold">{value}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
