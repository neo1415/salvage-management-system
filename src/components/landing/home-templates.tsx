'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { CSSProperties, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  Gavel,
  Search,
  Users,
  WalletCards,
} from 'lucide-react';
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

// Default Recovery Command media. These can later be exposed in the template
// editor as configurable uploads while keeping this template production-ready.
const recoveryCommandAssets = {
  heroYard: '/assets/recovery-command/hero-yard.png',
  damageReview: '/assets/recovery-command/damage-review.png',
  operationsRoom: '/assets/recovery-command/operations-room.png',
  pickupReady: '/assets/recovery-command/pickup-ready.png',
  fieldInspection: '/assets/recovery-command/field-inspection.png',
};

const recoveryCommandStages = [
  'Case Created',
  'Damage Assessment',
  'Reserve Set',
  'Auction Live',
  'Documents Signed',
  'Payment Confirmed',
  'Pickup Released',
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

function getDisplayInkColor(branding: BrandingPolicy, dark: boolean) {
  if (dark) return '#FFFFFF';
  if (!/^#[0-9A-Fa-f]{6}$/.test(branding.primaryColor)) return '#0F172A';
  const red = parseInt(branding.primaryColor.slice(1, 3), 16);
  const green = parseInt(branding.primaryColor.slice(3, 5), 16);
  const blue = parseInt(branding.primaryColor.slice(5, 7), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 210 ? '#0F172A' : branding.primaryColor;
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
  const accentText = getReadableTextColor(branding.accentColor);
  const displayInk = getDisplayInkColor(branding, dark);
  const shell = dark ? 'bg-[#080D14] text-white' : 'bg-[#F5F7FA] text-slate-950';
  const muted = dark ? 'text-white/62' : 'text-slate-600';
  const heroTitle = copy.heroTitle || 'Recover more value from every salvage asset.';
  const heroSubtitle = copy.heroSubtitle || 'Run salvage cases, auctions, vendor bidding, documents, payments, and fraud monitoring from one controlled workflow.';

  return (
    <main className={`min-h-screen overflow-hidden ${shell}`} style={cssVars(branding, theme)}>
      {branding.splashEnabled ? <RecoveryCommandSplash branding={branding} dark={dark} /> : null}
      <RecoveryCommandNav branding={branding} dark={dark} />

      <section id="platform" className="relative px-5 pb-20 pt-28 sm:pt-32 lg:pb-28">
        <div className="absolute inset-x-0 top-0 h-[640px] opacity-70" style={{ background: `radial-gradient(circle at 18% 18%, ${branding.accentColor}24, transparent 34%), radial-gradient(circle at 82% 8%, ${branding.primaryColor}22, transparent 28%)` }} />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <p className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ borderColor: `${branding.accentColor}55`, color: branding.accentColor }}>
              <CircleDot className="h-3.5 w-3.5" />
              {copy.eyebrow || 'Insurance salvage command center'}
            </p>
            <h1 className="mt-7 max-w-3xl text-[clamp(2.8rem,5.5vw,5.45rem)] font-black leading-[0.95]" style={{ color: displayInk }}>
              {heroTitle}
            </h1>
            <p className={`mt-7 max-w-2xl text-lg leading-8 sm:text-xl ${muted}`}>
              {heroSubtitle}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="#contact" className="group inline-flex items-center justify-center gap-2 rounded-xl px-6 py-4 text-sm font-black shadow-lg transition-transform hover:-translate-y-0.5" style={{ backgroundColor: branding.primaryColor, color: primaryText }}>
                {copy.primaryCtaLabel || 'Request Demo'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a href="#workflow" className={`inline-flex items-center justify-center rounded-xl border px-6 py-4 text-sm font-black transition-colors hover:border-[var(--wl-accent)] hover:text-[var(--wl-accent)] ${dark ? 'border-white/15 text-white' : 'border-slate-300 text-slate-950'}`}>
                {copy.secondaryCtaLabel && copy.secondaryCtaLabel.toLowerCase() !== 'sign in' ? copy.secondaryCtaLabel : 'View Workflow'}
              </a>
            </div>
            <div className={`mt-8 grid max-w-2xl gap-3 text-sm sm:grid-cols-3 ${muted}`}>
              {['Case ownership', 'Verified bidding', 'Payment handoff'].map((item) => (
                <div key={item} className={`rounded-xl border px-4 py-3 ${dark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white/70'}`}>
                  <CheckCircle2 className="mb-2 h-4 w-4" style={{ color: branding.accentColor }} />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>

          <CommandCenterMockup branding={branding} dark={dark} />
        </div>
      </section>

      <RecoveryWorkflowRail branding={branding} dark={dark} />
      <RecoveryControlsShowcase branding={branding} dark={dark} />
      <RecoveryWhySection branding={branding} dark={dark} />
      <RecoveryCommandContact branding={branding} dark={dark} />
      <RecoveryCommandFooter branding={branding} dark={dark} accentText={accentText} />
    </main>
  );
}

function RecoveryCommandSplash({ branding, dark }: { branding: BrandingPolicy; dark: boolean }) {
  const reduceMotion = useReducedMotion();
  const logo = branding.logoPath || '/icons/icon-192.png';
  const stages = ['Case', 'Assessment', 'Auction', 'Documents', 'Payment'];

  return (
    <motion.div
      className={`fixed inset-0 z-[9000] grid place-items-center ${dark ? 'bg-[#070B12]' : 'bg-slate-950'} text-white`}
      initial={{ opacity: 1 }}
      animate={{ opacity: 0, pointerEvents: 'none' }}
      transition={{ delay: reduceMotion ? 0.35 : 1.25, duration: reduceMotion ? 0.2 : 0.45 }}
      aria-hidden
    >
      <div className="absolute inset-0 opacity-35" style={{ background: `radial-gradient(circle at 50% 45%, ${branding.accentColor}40, transparent 34%)` }} />
      <div className="relative w-full max-w-xl px-6 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/10 p-2 shadow-2xl">
          <Image src={logo} alt="" width={48} height={48} className="h-12 w-12 rounded-xl object-contain" unoptimized />
        </div>
        <p className="mt-5 text-4xl font-black tracking-[-0.06em]">{branding.brandName}</p>
        <div className="mt-8 flex items-center justify-between gap-1 sm:gap-2">
          {stages.map((stage, index) => (
            <div key={stage} className="flex flex-1 items-center">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <motion.span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: branding.accentColor }}
                  animate={reduceMotion ? undefined : { scale: [1, 1.6, 1], opacity: [0.55, 1, 0.55] }}
                  transition={{ delay: index * 0.12, duration: 0.9, repeat: Infinity, repeatDelay: 0.8 }}
                />
                <span className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">{stage}</span>
              </div>
              {index < stages.length - 1 ? <span className="h-px flex-1 bg-white/18" /> : null}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function RecoveryCommandNav({ branding, dark }: { branding: BrandingPolicy; dark: boolean }) {
  const accentText = getReadableTextColor(branding.accentColor);
  const navLinks = [
    ['Platform', '#platform'],
    ['Workflow', '#workflow'],
    ['Controls', '#controls'],
    ['For Insurers', '#insurers'],
    ['Contact', '#contact'],
  ];

  return (
    <nav className={`fixed left-0 right-0 top-0 z-50 border-b px-4 py-3 backdrop-blur-xl ${dark ? 'border-white/10 bg-[#080D14]/78' : 'border-slate-200/70 bg-white/80'}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <BrandWordmark branding={branding} light={dark} />
        <div className={`hidden items-center gap-6 text-[11px] font-bold uppercase tracking-[0.14em] lg:flex ${dark ? 'text-white/55' : 'text-slate-500'}`}>
          {navLinks.map(([label, href]) => (
            <a key={label} href={href} className="transition-colors hover:text-[var(--wl-accent)]">{label}</a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className={`rounded-xl border px-4 py-2 text-sm font-black transition-colors hover:border-[var(--wl-accent)] hover:text-[var(--wl-accent)] ${dark ? 'border-white/15 text-white' : 'border-slate-300 text-slate-950'}`}>
            Sign in
          </Link>
          <Link href="/register" className="hidden rounded-xl px-4 py-2 text-sm font-black shadow-sm sm:inline-flex" style={{ backgroundColor: branding.accentColor, color: accentText }}>
            Register
          </Link>
        </div>
      </div>
    </nav>
  );
}

function CommandCenterMockup({ branding, dark }: { branding: BrandingPolicy; dark: boolean }) {
  const card = dark ? 'border-white/10 bg-white/[0.07]' : 'border-slate-200 bg-white/92';
  const muted = dark ? 'text-white/55' : 'text-slate-500';

  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.65, delay: 0.15 }}
    >
      <div className={`relative overflow-hidden rounded-[2rem] border p-3 shadow-2xl ${dark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white'}`}>
        <div className="relative h-[460px] overflow-hidden rounded-[1.45rem] sm:h-[560px]">
          <Image src={recoveryCommandAssets.heroYard} alt="Salvage vehicles in a controlled auction yard" fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 720px" />
          <div className={`absolute inset-0 ${dark ? 'bg-slate-950/28' : 'bg-white/10'}`} />
          <div className="absolute inset-x-4 bottom-4 grid gap-3 md:grid-cols-[1fr_0.82fr]">
            <div className={`rounded-2xl border p-4 shadow-xl backdrop-blur-xl ${card}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: branding.accentColor }}>Salvage case</p>
                <span className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ backgroundColor: `${branding.accentColor}22`, color: branding.accentColor }}>In review</span>
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-[-0.04em]">2020 Toyota Camry</h2>
              <p className={`mt-1 text-sm ${muted}`}>Front impact - Lagos inspection yard</p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  ['Reserve', 'Set'],
                  ['Auction', 'Live'],
                  ['Vendors', 'Verified'],
                ].map(([label, value]) => (
                  <div key={label} className={`rounded-xl border p-3 ${dark ? 'border-white/10 bg-slate-950/45' : 'border-slate-200 bg-slate-50'}`}>
                    <p className={`text-[10px] uppercase tracking-[0.14em] ${muted}`}>{label}</p>
                    <p className="mt-1 font-black">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={`rounded-2xl border p-4 shadow-xl backdrop-blur-xl ${card}`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
                <div>
                  <p className="font-black">Fraud signal review</p>
                  <p className={`mt-1 text-sm leading-6 ${muted}`}>Bid velocity and identity checks routed for approval.</p>
                </div>
              </div>
              <div className="mt-4 h-2 rounded-full bg-current/10">
                <motion.div className="h-2 rounded-full" style={{ width: '68%', backgroundColor: branding.accentColor }} initial={{ width: '28%' }} whileInView={{ width: '68%' }} viewport={{ once: true }} transition={{ duration: 0.7 }} />
              </div>
            </div>
          </div>
        </div>
        <motion.div className={`absolute right-8 top-10 hidden w-72 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl md:block ${card}`} animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
          <p className={`text-[10px] uppercase tracking-[0.16em] ${muted}`}>Document progress</p>
          <div className="mt-3 flex items-center gap-3">
            <FileCheck2 className="h-6 w-6" style={{ color: branding.accentColor }} />
            <div className="flex-1">
              <p className="font-black">2 of 2 signed</p>
              <div className="mt-2 h-1.5 rounded-full bg-current/10">
                <div className="h-1.5 rounded-full" style={{ width: '100%', backgroundColor: branding.accentColor }} />
              </div>
            </div>
          </div>
        </motion.div>
        <motion.div className={`absolute -left-4 top-36 hidden w-64 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl lg:block ${card}`} animate={{ y: [0, 10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>
          <p className={`text-[10px] uppercase tracking-[0.16em] ${muted}`}>Payment status</p>
          <div className="mt-3 flex items-center gap-3">
            <WalletCards className="h-6 w-6" style={{ color: branding.accentColor }} />
            <div>
              <p className="font-black">Deposit held</p>
              <p className={`text-sm ${muted}`}>Finance handoff ready</p>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function RecoveryWorkflowRail({ branding, dark }: { branding: BrandingPolicy; dark: boolean }) {
  const muted = dark ? 'text-white/58' : 'text-slate-600';
  const panel = dark ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white';
  const displayInk = getDisplayInkColor(branding, dark);

  return (
    <section id="workflow" className={`px-5 py-24 ${dark ? 'bg-[#0B111A]' : 'bg-white'}`}>
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[360px_1fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: branding.accentColor }}>Workflow</p>
            <h2 className="mt-4 text-3xl font-black leading-tight md:text-5xl" style={{ color: displayInk }}>
              One governed path from claim intake to pickup release.
            </h2>
          </div>
          <p className={`max-w-2xl text-base leading-8 lg:justify-self-end ${muted}`}>
            Each step shows the next operational gate, so claims, salvage, finance, and vendor teams know what is waiting and what has already cleared.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-[1.7rem] border border-current/10">
          <div className="grid md:grid-cols-7">
            {recoveryCommandStages.map((stage, index) => (
              <motion.div
                key={stage}
                className={`relative min-h-44 border-b border-r border-current/10 p-5 last:border-r-0 md:border-b-0 ${panel}`}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: index * 0.04, duration: 0.42 }}
              >
                <p className="font-mono text-xs" style={{ color: branding.accentColor }}>{String(index + 1).padStart(2, '0')}</p>
                <h3 className="mt-8 text-lg font-black tracking-[-0.03em]">{stage}</h3>
                <span className="absolute bottom-5 left-5 right-5 h-1 rounded-full bg-current/10">
                  <motion.span className="block h-1 rounded-full" style={{ backgroundColor: branding.accentColor }} initial={{ width: 0 }} whileInView={{ width: '100%' }} viewport={{ once: true }} transition={{ delay: 0.12 + index * 0.06, duration: 0.45 }} />
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RecoveryControlsShowcase({ branding, dark }: { branding: BrandingPolicy; dark: boolean }) {
  const muted = dark ? 'text-white/58' : 'text-slate-600';
  const panel = dark ? 'border-white/10 bg-white/[0.055]' : 'border-slate-200 bg-white';
  const displayInk = getDisplayInkColor(branding, dark);
  const features = [
    [ClipboardCheck, 'Intake', 'Claim asset, photos, voice notes, documents, and inspection location.'],
    [Search, 'Assess', 'Structured damage review and reserve recommendation support.'],
    [Gavel, 'Auction', 'Verified bidders, reserve gates, extensions, and bid controls.'],
    [WalletCards, 'Deposit', 'Auction-specific deposit hold and finance visibility.'],
    [FileCheck2, 'Documents', 'Bill of sale and waiver progress before payment release.'],
    [CreditCard, 'Payment', 'Clear payment authorization state and pickup handoff.'],
  ] as const;
  const mediaCards = [
    {
      title: 'Damage review',
      body: 'Inspection evidence and assessment status stay attached to the case.',
      image: recoveryCommandAssets.damageReview,
      icon: Search,
    },
    {
      title: 'Field handoff',
      body: 'Pickup, documents, and payment status move together instead of living in separate threads.',
      image: recoveryCommandAssets.pickupReady,
      icon: FileCheck2,
    },
  ] as const;

  return (
    <section id="controls" className={`px-5 py-24 ${dark ? 'bg-[#080D14]' : 'bg-[#F5F7FA]'}`}>
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[0.86fr_1.14fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: branding.accentColor }}>Control room</p>
            <h2 className="mt-4 text-3xl font-black leading-tight md:text-5xl" style={{ color: displayInk }}>
              See the handoff before it becomes a delay.
            </h2>
          </div>
          <p className={`max-w-2xl text-base leading-8 lg:justify-self-end ${muted}`}>
            The page should feel like the product: evidence, approvals, vendor access, deposits, documents, and pickup release all moving through one controlled lane.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            className={`relative min-h-[560px] overflow-hidden rounded-[2rem] border ${panel}`}
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
          >
            <Image src={recoveryCommandAssets.fieldInspection} alt="Field inspection with a verified salvage case" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 720px" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/82 via-slate-950/18 to-transparent" />
            <div className="absolute inset-x-5 bottom-5">
              <div className="grid gap-3 rounded-[1.6rem] border border-white/15 bg-white/12 p-4 text-white shadow-2xl backdrop-blur-xl sm:grid-cols-3">
                {[
                  ['Case', 'Verified'],
                  ['Auction', 'Ready'],
                  ['Reserve', 'Set'],
                ].map(([label, value], index) => (
                  <motion.div
                    key={label}
                    className="rounded-2xl bg-white/12 p-4"
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">0{index + 1} {label}</span>
                    <p className="mt-2 text-xl font-black">{value}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          <div className="grid gap-4">
            {mediaCards.map(({ title, body, image, icon: Icon }, index) => (
              <motion.article
                key={title}
                className={`group grid min-h-64 overflow-hidden rounded-[2rem] border ${panel} md:grid-cols-[0.9fr_1.1fr]`}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ delay: index * 0.08, duration: 0.45 }}
              >
                <div className="relative min-h-56 overflow-hidden md:min-h-0">
                  <Image src={image} alt={`${title} visual`} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="(max-width: 1024px) 100vw, 360px" />
                  <div className="absolute inset-0 bg-slate-950/12" />
                </div>
                <div className="flex flex-col justify-between p-6">
                  <div>
                    <Icon className="h-7 w-7" style={{ color: branding.accentColor }} />
                    <h3 className="mt-5 text-2xl font-black" style={{ color: displayInk }}>{title}</h3>
                    <p className={`mt-3 text-sm leading-7 ${muted}`}>{body}</p>
                  </div>
                  <div className="mt-6 h-2 rounded-full bg-current/10">
                    <motion.span className="block h-2 rounded-full" style={{ backgroundColor: branding.accentColor }} initial={{ width: '34%' }} whileInView={{ width: index === 0 ? '72%' : '100%' }} viewport={{ once: true }} transition={{ duration: 0.7 }} />
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>

        <div className={`mt-4 rounded-[2rem] border p-4 ${panel}`}>
          <div className="grid gap-3 md:grid-cols-6">
            {features.map(([Icon, title, body], index) => (
              <motion.div
                key={title}
                className={`group rounded-2xl border p-4 transition-shadow ${dark ? 'border-white/10 bg-slate-950/25 hover:bg-white/[0.08]' : 'border-slate-200 bg-slate-50 hover:bg-white hover:shadow-lg'}`}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ delay: index * 0.035, duration: 0.35 }}
                whileHover={{ y: -5 }}
              >
                <div className="flex items-center justify-between gap-3">
                  <Icon className="h-5 w-5" style={{ color: branding.accentColor }} />
                  <span className={`font-mono text-[10px] ${muted}`}>{String(index + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-5 text-base font-black" style={{ color: displayInk }}>{title}</h3>
                <p className={`mt-2 text-xs leading-6 ${muted}`}>{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RecoveryWhySection({ branding, dark }: { branding: BrandingPolicy; dark: boolean }) {
  const muted = dark ? 'text-white/58' : 'text-slate-600';
  const panel = dark ? 'border-white/10 bg-white/[0.045]' : 'border-slate-200 bg-white';
  const displayInk = getDisplayInkColor(branding, dark);
  const points = [
    'Reduce manual follow-up between claims, salvage, finance, and vendors.',
    'Keep reserve status, auction progress, document signing, and payment state visible.',
    'Give managers cleaner approval points before pickup authorization is released.',
    'Support audit-ready records without making vendors the center of the homepage story.',
  ];

  return (
    <section id="insurers" className={`px-5 py-24 ${dark ? 'bg-[#0B111A]' : 'bg-white'}`}>
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div className="relative min-h-[440px] overflow-hidden rounded-[2rem] border border-current/10">
          <Image src={recoveryCommandAssets.operationsRoom} alt="Insurance operations leaders reviewing salvage auction workflow" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 620px" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: branding.accentColor }}>For insurers</p>
          <h2 className="mt-4 text-3xl font-black leading-tight md:text-5xl" style={{ color: displayInk }}>
            Faster recovery starts with a cleaner operating picture.
          </h2>
          <p className={`mt-5 max-w-2xl text-base leading-8 ${muted}`}>
            {branding.brandName} frames salvage as a managed workflow: case evidence enters once, approvals stay visible, bidders are controlled, and finance sees what is ready for payment.
          </p>
          <div className="mt-8 grid gap-3">
            {points.map((point) => (
              <div key={point} className={`flex gap-3 rounded-2xl border p-4 ${panel}`}>
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: branding.accentColor }} />
                <p className={`text-sm leading-7 ${muted}`}>{point}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RecoveryCommandContact({ branding, dark }: { branding: BrandingPolicy; dark: boolean }) {
  const [formData, setFormData] = useState({ name: '', email: '', company: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const accentText = getReadableTextColor(branding.accentColor);
  const panel = dark ? 'border-white/10 bg-white/[0.045]' : 'border-slate-200 bg-white';
  const muted = dark ? 'text-white/58' : 'text-slate-600';
  const displayInk = getDisplayInkColor(branding, dark);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus('loading');

    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.name,
        email: formData.email,
        phone: formData.company,
        message: `Company: ${formData.company || 'Not provided'}\n\n${formData.message}`,
      }),
    }).catch(() => null);

    if (response?.ok) {
      setStatus('success');
      setFormData({ name: '', email: '', company: '', message: '' });
    } else {
      setStatus('error');
    }

    window.setTimeout(() => setStatus('idle'), 3500);
  };

  return (
    <section id="contact" className={`px-5 py-24 ${dark ? 'bg-[#080D14]' : 'bg-[#F5F7FA]'}`}>
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.82fr_1.18fr]">
        <div className={`rounded-[2rem] border p-7 ${panel}`}>
          <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: branding.accentColor }}>Contact</p>
          <h2 className="mt-4 text-3xl font-black leading-tight md:text-4xl" style={{ color: displayInk }}>
            See the recovery workflow in context.
          </h2>
          <p className={`mt-5 text-base leading-8 ${muted}`}>
            Tell us how your salvage, claims, and finance teams work today. The demo can focus on the approval and handoff points that matter most.
          </p>
          <div className="mt-8 space-y-4 text-sm">
            <p><span className={muted}>Support:</span> <span className="font-bold">{branding.supportEmail}</span></p>
            <p><span className={muted}>Phone:</span> <span className="font-bold">{branding.supportPhone || 'Configured in enterprise setup'}</span></p>
            <p><span className={muted}>Company:</span> <span className="font-bold">{branding.legalName}</span></p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className={`rounded-[2rem] border p-5 sm:p-7 ${panel}`}>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ['name', 'Name', 'Ada Okafor', 'text'],
              ['email', 'Work email', 'ada@insurer.com', 'email'],
              ['company', 'Company', branding.legalName, 'text'],
            ].map(([name, label, placeholder, type]) => (
              <label key={name} className={name === 'company' ? 'sm:col-span-2' : ''}>
                <span className="text-sm font-bold">{label}</span>
                <input
                  required={name !== 'company'}
                  type={type}
                  name={name}
                  value={formData[name as keyof typeof formData]}
                  onChange={(event) => setFormData((current) => ({ ...current, [name]: event.target.value }))}
                  placeholder={placeholder}
                  className={`mt-2 w-full rounded-xl border px-4 py-3 outline-none transition-colors focus:border-[var(--wl-accent)] ${dark ? 'border-white/10 bg-white/[0.06] text-white placeholder:text-white/35' : 'border-slate-200 bg-slate-50 text-slate-950 placeholder:text-slate-400'}`}
                />
              </label>
            ))}
            <label className="sm:col-span-2">
              <span className="text-sm font-bold">Message</span>
              <textarea
                required
                rows={5}
                value={formData.message}
                onChange={(event) => setFormData((current) => ({ ...current, message: event.target.value }))}
                placeholder="Tell us about your salvage recovery process..."
                className={`mt-2 w-full resize-none rounded-xl border px-4 py-3 outline-none transition-colors focus:border-[var(--wl-accent)] ${dark ? 'border-white/10 bg-white/[0.06] text-white placeholder:text-white/35' : 'border-slate-200 bg-slate-50 text-slate-950 placeholder:text-slate-400'}`}
              />
            </label>
          </div>
          <button type="submit" disabled={status === 'loading'} className="mt-5 inline-flex w-full items-center justify-center rounded-xl px-6 py-4 text-sm font-black disabled:opacity-60" style={{ backgroundColor: branding.accentColor, color: accentText }}>
            {status === 'loading' ? 'Sending...' : status === 'success' ? 'Message sent' : status === 'error' ? 'Try again' : 'Request Demo'}
          </button>
        </form>
      </div>
    </section>
  );
}

function RecoveryCommandFooter({ branding, dark, accentText }: { branding: BrandingPolicy; dark: boolean; accentText: string }) {
  const linkClass = dark ? 'text-white/48 hover:text-white' : 'text-slate-500 hover:text-slate-950';

  return (
    <footer className={`px-5 py-12 ${dark ? 'bg-[#070B12] text-white' : 'bg-white text-slate-950'}`}>
      <div className="mx-auto grid max-w-7xl gap-8 border-t border-current/10 pt-8 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <BrandWordmark branding={branding} light={dark} />
          <p className={`mt-4 max-w-md text-sm leading-7 ${dark ? 'text-white/48' : 'text-slate-600'}`}>
            {branding.homepageCopy.trustLine || 'Controlled salvage recovery for claims, salvage, finance, and vendor teams.'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {['Platform', 'Workflow', 'Controls', 'For Insurers', 'Contact'].map((label) => (
            <a key={label} href={`#${label === 'For Insurers' ? 'insurers' : label.toLowerCase()}`} className={linkClass}>{label}</a>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Link href="/privacy" className={linkClass}>Privacy</Link>
          <Link href="/terms" className={linkClass}>Terms</Link>
          <Link href="/cookies" className={linkClass}>Cookies</Link>
          <a href={`mailto:${branding.supportEmail}`} className="font-bold" style={{ color: branding.accentColor }}>{branding.supportEmail}</a>
        </div>
      </div>
      <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-3 text-xs opacity-55 sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} {branding.legalName}. All rights reserved.</p>
        <span className="w-fit rounded-full px-3 py-1 font-bold" style={{ backgroundColor: branding.accentColor, color: accentText }}>Recovery Command</span>
      </div>
    </footer>
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
