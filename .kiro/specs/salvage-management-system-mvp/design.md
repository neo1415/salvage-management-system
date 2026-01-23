# Design Document

## Overview

The Salvage Management System is a mobile-first Progressive Web Application (PWA) built using Next.js 15 with the App Router architecture. The system follows Clean Architecture principles with strict separation of concerns, enabling maintainability, testability, and scalability from 100 to 100,000+ users without major rewrites.

### Technology Stack

**Frontend & Backend (Monolithic)**
- **Framework**: Next.js 15 (App Router) with TypeScript (strict mode)
- **Language**: TypeScript 5.3+ (strict mode enabled)
- **Database**: PostgreSQL 15+ on Supabase
- **ORM**: Drizzle ORM
- **Authentication**: NextAuth.js v5
- **State Management**: Zustand
- **Styling**: Tailwind CSS (Burgundy #800020, White #FFFFFF, Gold #FFD700)
- **Forms**: React Hook Form + Zod validation
- **Real-time**: Socket.io
- **File Storage**: Cloudinary
- **Payments**: Paystack (primary) + Flutterwave (backup)
- **SMS/OTP**: Termii
- **Email**: Resend
- **Testing**: Vitest + Playwright + Testing Library
- **Charts**: Recharts

**Third-Party Integrations**
- Google Cloud Vision API (damage assessment)
- Google Document AI (OCR for NIN/CAC)
- Mono/Okra API (BVN verification)
- TinyPNG API (image compression)
- Paystack/Flutterwave (payments)
- Termii/Africa's Talking (SMS)
- Resend (email)

### Design Principles

1. **Mobile-First**: 70%+ traffic will be mobile, design for mobile screens first
2. **Offline-First**: PWA with service workers for offline capability
3. **Clean Architecture**: Strict layer separation (presentation → application → domain → infrastructure)
4. **Type Safety**: TypeScript strict mode, no `any` types
5. **Security by Design**: NDPR compliance, encrypted sensitive data, audit trails
6. **Performance**: API <500ms, Mobile load <2s, Real-time <1s
7. **Scalability**: Stateless servers, Redis caching, horizontal scaling ready


## Architecture

### Landing Page Design

#### Overview

The landing page serves as the first touchpoint for potential vendors and showcases the platform's value proposition through modern, interactive UI components. The design follows 2025-2026 trends with scroll-triggered animations, micro-interactions, and 3D elements while maintaining professional aesthetics aligned with NEM Insurance branding.

#### Visual Design System

**Color Palette**:
- Primary: Burgundy (#800020) - NEM Insurance brand color
- Secondary: Gold (#FFD700) - Accent and CTAs
- Neutral: White (#FFFFFF), Gray (#F5F5F5), Dark Gray (#333333)
- Gradients: Burgundy to Gold for hero backgrounds and interactive elements

**Typography**:
- Headlines: Inter Bold/Black with gradient fills (Burgundy → Gold)
- Subheadlines: Inter Semibold
- Body: Inter Regular
- Kinetic text effects: Letter-by-letter reveals on scroll

**Spacing & Layout**:
- Mobile-first responsive grid (12 columns)
- Asymmetric modular layout with generous white space
- Z-pattern for feature sections, F-pattern for content blocks

#### Component Specifications

##### 1. Hero Section

**Layout**:
```
┌─────────────────────────────────────────────────┐
│  [Logo]              [Nav: Home | How It Works | │
│                       Pricing | Contact | Login] │
│                                                   │
│  Transform Salvage Recovery                      │
│  with AI-Powered Auctions                        │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│  (Typing animation with cursor blink)            │
│                                                   │
│  Instant payments • Real-time bidding •          │
│  Mobile-first platform for Nigerian vendors      │
│                                                   │
│  [Start Bidding →]  [Watch Demo ▶]              │
│                                                   │
│  [Morphing background shapes & particles]        │
└─────────────────────────────────────────────────┘
```

**Animations**:
- Headline types out character-by-character (1.5s duration)
- Background shapes morph between circles, squares, and organic forms
- Gradient shifts from Burgundy to Gold on scroll
- SVG line drawings animate in (stroke-dashoffset animation)
- Parallax effect on background elements (0.5x scroll speed)

**Implementation**:
```typescript
// src/components/landing/hero-section.tsx
import { motion } from 'framer-motion';
import { TypeAnimation } from 'react-type-animation';

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-burgundy-900 to-burgundy-700">
      {/* Morphing background shapes */}
      <motion.div
        className="absolute inset-0 opacity-20"
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 90, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div className="w-96 h-96 bg-gold-500 rounded-full blur-3xl" />
      </motion.div>

      <div className="container mx-auto px-4 z-10">
        <motion.h1
          className="text-5xl md:text-7xl font-black mb-6 bg-gradient-to-r from-white to-gold-400 bg-clip-text text-transparent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <TypeAnimation
            sequence={[
              'Transform Salvage Recovery',
              1000,
              'Transform Salvage Recovery\nwith AI-Powered Auctions',
            ]}
            wrapper="span"
            cursor={true}
            repeat={0}
          />
        </motion.h1>

        <motion.p
          className="text-xl md:text-2xl text-gray-200 mb-8 max-w-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          Instant payments • Real-time bidding • Mobile-first platform for Nigerian vendors
        </motion.p>

        <motion.div
          className="flex flex-col sm:flex-row gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
        >
          <button className="px-8 py-4 bg-gold-500 text-burgundy-900 font-bold rounded-lg hover:bg-gold-400 transition-all hover:scale-105 hover:shadow-xl">
            Start Bidding →
          </button>
          <button className="px-8 py-4 border-2 border-white text-white font-bold rounded-lg hover:bg-white hover:text-burgundy-900 transition-all">
            Watch Demo ▶
          </button>
        </motion.div>
      </div>
    </section>
  );
}
```

##### 2. Value Propositions Section

**Layout**: 4-column grid on desktop, 2-column on tablet, 1-column on mobile

**Cards**:
1. ⚡ Instant Paystack Payments
2. 📱 Mobile-First PWA
3. 🤖 AI Damage Assessment
4. 🏆 Gamified Leaderboards

**Micro-Interactions**:
- Cards lift on hover (translateY: -8px)
- Icons bounce on hover
- Background glow effect pulses
- Shimmer animation on hover

**Implementation**:
```typescript
// src/components/landing/value-props.tsx
import { motion } from 'framer-motion';

const valueProps = [
  {
    icon: '⚡',
    title: 'Instant Paystack Payments',
    description: 'Get paid in minutes, not days. Secure card payments with automatic verification.',
  },
  // ... other props
];

export function ValuePropsSection() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <motion.h2
          className="text-4xl md:text-5xl font-black text-center mb-16 bg-gradient-to-r from-burgundy-900 to-gold-600 bg-clip-text text-transparent"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Why Vendors Choose Us
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {valueProps.map((prop, index) => (
            <motion.div
              key={index}
              className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer group"
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
            >
              <motion.div
                className="text-6xl mb-4"
                whileHover={{ scale: 1.2, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {prop.icon}
              </motion.div>
              <h3 className="text-xl font-bold mb-2 text-burgundy-900">{prop.title}</h3>
              <p className="text-gray-600">{prop.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

##### 3. Interactive 3D Product Mockups

**Features**:
- Draggable/rotatable 3D dashboard preview
- Parallax layers for mobile app screens
- Hover zoom on screenshots

**Libraries**:
- Spline for 3D models
- Three.js for WebGL rendering
- React Three Fiber for React integration

**Implementation**:
```typescript
// src/components/landing/product-showcase.tsx
import Spline from '@splinetool/react-spline';
import { motion, useScroll, useTransform } from 'framer-motion';

export function ProductShowcase() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -50]);

  return (
    <section className="py-20 bg-burgundy-900 text-white overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div style={{ y }}>
            <h2 className="text-4xl md:text-5xl font-black mb-6">
              Experience the Platform
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Intuitive dashboard, real-time bidding, and instant notifications—all in one place.
            </p>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <span className="text-gold-500">✓</span>
                <span>Live auction countdown timers</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-gold-500">✓</span>
                <span>One-tap bid placement with OTP</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="text-gold-500">✓</span>
                <span>Instant payment confirmation</span>
              </li>
            </ul>
          </motion.div>

          <motion.div
            className="relative h-[600px]"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <Spline scene="https://prod.spline.design/your-scene-url/scene.splinecode" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
```

##### 4. How It Works Section

**Layout**: Zigzag pattern with alternating image/text blocks

**Steps**:
1. Register & Verify (BVN verification)
2. Browse Auctions (AI-assessed items)
3. Place Bids (Real-time with OTP)
4. Pay Instantly (Paystack integration)
5. Collect Salvage (Pickup authorization)

**Animations**:
- Steps slide in from alternating sides
- Progress line draws as user scrolls
- Icons animate on viewport entry

##### 5. Social Proof & Trust Indicators

**Elements**:
- Animated stat counters (₦10M+ processed, 500+ vendors)
- Customer testimonials carousel with photos
- "Powered by NEM Insurance" badge
- Security badges (BVN verified, SSL encrypted)

**Implementation**:
```typescript
// src/components/landing/stats-counter.tsx
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

export function StatsCounter({ end, suffix = '', duration = 2 }: { end: number; suffix?: string; duration?: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const { ref, inView } = useInView({ triggerOnce: true });

  useEffect(() => {
    if (inView) {
      const controls = animate(count, end, { duration });
      return controls.stop;
    }
  }, [inView, count, end, duration]);

  return (
    <motion.span ref={ref}>
      {rounded}
      {suffix}
    </motion.span>
  );
}
```

##### 6. Collapsible FAQ Section

**Questions**:
- How do I get verified?
- What payment methods are supported?
- How does the bidding work?
- What are the fees?
- Is my data secure?

**Animations**:
- Smooth height transitions (max-height with transition)
- Rotate chevron icon on expand
- Subtle background color change on hover

##### 7. Sticky Floating CTA

**Behavior**:
- Appears after scrolling 30% of page
- Morphs text based on scroll position
- Shows progress bar
- Pulses every 5 seconds to draw attention

**Implementation**:
```typescript
// src/components/landing/floating-cta.tsx
import { motion, useScroll, useTransform } from 'framer-motion';

export function FloatingCTA() {
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);
  const ctaText = useTransform(scrollYProgress, (latest) => {
    if (latest < 0.5) return 'Start Free';
    if (latest < 0.8) return 'Join 500+ Vendors';
    return 'Get Started Now';
  });

  return (
    <motion.div
      className="fixed bottom-8 right-8 z-50"
      style={{ opacity }}
    >
      <motion.button
        className="px-6 py-3 bg-gold-500 text-burgundy-900 font-bold rounded-full shadow-2xl hover:scale-105 transition-transform"
        animate={{
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 3,
        }}
      >
        {ctaText}
        <motion.div
          className="h-1 bg-burgundy-900 mt-2 rounded-full"
          style={{ width: useTransform(scrollYProgress, [0, 1], ['0%', '100%']) }}
        />
      </motion.button>
    </motion.div>
  );
}
```

##### 8. Footer Section

**Content**:
- Company info (NEM Insurance Plc)
- Contact details (phone, email, address)
- Quick links (Privacy Policy, Terms of Service)
- Social media icons
- Embedded Google Maps

#### Required Libraries

```json
{
  "dependencies": {
    "framer-motion": "^11.0.0",
    "react-type-animation": "^3.2.0",
    "@splinetool/react-spline": "^2.2.6",
    "three": "^0.160.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.95.0",
    "react-intersection-observer": "^9.5.3",
    "aos": "^3.0.0-beta.6",
    "gsap": "^3.12.5"
  }
}
```

#### Performance Optimization

**Lazy Loading**:
- Images use Next.js Image component with lazy loading
- 3D models load on viewport entry
- Animations trigger only when in view

**Code Splitting**:
- Heavy animation libraries loaded dynamically
- Spline 3D models loaded asynchronously

**Caching**:
- Static assets cached with service worker
- CDN for images and videos

**Metrics**:
- Lighthouse score target: 90+ (Performance, Accessibility, Best Practices, SEO)
- First Contentful Paint: <1.5s
- Time to Interactive: <3s on 3G

### Clean Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  (Next.js App Router Pages, React Components, API Routes)   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│     (Use Cases, Services, Business Logic Orchestration)     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                            │
│        (Entities, Value Objects, Domain Rules)              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
│  (Database, External APIs, File Storage, Cache, Queue)      │
└─────────────────────────────────────────────────────────────┘
```

### Next.js 15 App Router Structure

```
salvage-management-system/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # Auth route group
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── verify-otp/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/              # Protected route group
│   │   │   ├── adjuster/
│   │   │   │   ├── cases/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── manager/
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── approvals/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── vendors/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── vendor/
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── auctions/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── kyc/
│   │   │   │   │   ├── tier1/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── tier2/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── wallet/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── finance/
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── payments/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── layout.tsx
│   │   │   └── admin/
│   │   │       ├── users/
│   │   │       │   └── page.tsx
│   │   │       ├── fraud/
│   │   │       │   └── page.tsx
│   │   │       └── layout.tsx
│   │   ├── api/                      # API Routes
│   │   │   ├── auth/
│   │   │   │   ├── [...nextauth]/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── register/
│   │   │   │   │   └── route.ts
│   │   │   │   └── verify-otp/
│   │   │   │       └── route.ts
│   │   │   ├── vendors/
│   │   │   │   ├── route.ts
│   │   │   │   ├── [id]/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── verify-bvn/
│   │   │   │   │   └── route.ts
│   │   │   │   └── tier2-kyc/
│   │   │   │       └── route.ts
│   │   │   ├── cases/
│   │   │   │   ├── route.ts
│   │   │   │   ├── [id]/
│   │   │   │   │   └── route.ts
│   │   │   │   └── approve/
│   │   │   │       └── route.ts
│   │   │   ├── auctions/
│   │   │   │   ├── route.ts
│   │   │   │   ├── [id]/
│   │   │   │   │   └── route.ts
│   │   │   │   └── [id]/
│   │   │   │       └── bids/
│   │   │   │           └── route.ts
│   │   │   ├── payments/
│   │   │   │   ├── route.ts
│   │   │   │   ├── verify/
│   │   │   │   │   └── route.ts
│   │   │   │   └── wallet/
│   │   │   │       └── route.ts
│   │   │   ├── webhooks/
│   │   │   │   ├── paystack/
│   │   │   │   │   └── route.ts
│   │   │   │   └── flutterwave/
│   │   │   │       └── route.ts
│   │   │   └── socket/
│   │   │       └── route.ts
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Landing page
│   │   └── globals.css               # Global styles
│   ├── components/                   # Reusable UI components
│   │   ├── ui/                       # Base UI components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── modal.tsx
│   │   │   └── countdown-timer.tsx
│   │   ├── forms/                    # Form components
│   │   │   ├── vendor-registration-form.tsx
│   │   │   ├── case-creation-form.tsx
│   │   │   └── bid-form.tsx
│   │   ├── auction/                  # Auction-specific components
│   │   │   ├── auction-card.tsx
│   │   │   ├── bid-history-chart.tsx
│   │   │   └── auction-countdown.tsx
│   │   └── layout/                   # Layout components
│   │       ├── header.tsx
│   │       ├── sidebar.tsx
│   │       └── mobile-nav.tsx
│   ├── features/                     # Feature-specific logic
│   │   ├── auth/
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── otp.service.ts
│   │   │   ├── hooks/
│   │   │   │   └── use-auth.ts
│   │   │   └── types.ts
│   │   ├── vendors/
│   │   │   ├── services/
│   │   │   │   ├── vendor.service.ts
│   │   │   │   ├── bvn-verification.service.ts
│   │   │   │   └── kyc.service.ts
│   │   │   ├── hooks/
│   │   │   │   └── use-vendor.ts
│   │   │   └── types.ts
│   │   ├── cases/
│   │   │   ├── services/
│   │   │   │   ├── case.service.ts
│   │   │   │   └── ai-assessment.service.ts
│   │   │   ├── hooks/
│   │   │   │   └── use-cases.ts
│   │   │   └── types.ts
│   │   ├── auctions/
│   │   │   ├── services/
│   │   │   │   ├── auction.service.ts
│   │   │   │   ├── bidding.service.ts
│   │   │   │   └── realtime.service.ts
│   │   │   ├── hooks/
│   │   │   │   ├── use-auctions.ts
│   │   │   │   └── use-bidding.ts
│   │   │   └── types.ts
│   │   ├── payments/
│   │   │   ├── services/
│   │   │   │   ├── payment.service.ts
│   │   │   │   ├── paystack.service.ts
│   │   │   │   └── escrow.service.ts
│   │   │   ├── hooks/
│   │   │   │   └── use-payments.ts
│   │   │   └── types.ts
│   │   └── notifications/
│   │       ├── services/
│   │       │   ├── notification.service.ts
│   │       │   ├── sms.service.ts
│   │       │   └── email.service.ts
│   │       └── types.ts
│   ├── lib/                          # Shared libraries
│   │   ├── db/                       # Database
│   │   │   ├── drizzle.ts
│   │   │   ├── schema/
│   │   │   │   ├── users.ts
│   │   │   │   ├── vendors.ts
│   │   │   │   ├── cases.ts
│   │   │   │   ├── auctions.ts
│   │   │   │   ├── bids.ts
│   │   │   │   ├── payments.ts
│   │   │   │   └── audit-logs.ts
│   │   │   └── migrations/
│   │   ├── redis/                    # Redis client
│   │   │   └── client.ts
│   │   ├── storage/                  # File storage
│   │   │   └── cloudinary.ts
│   │   ├── integrations/             # External APIs
│   │   │   ├── google-vision.ts
│   │   │   ├── google-document-ai.ts
│   │   │   ├── bvn-verification.ts
│   │   │   ├── paystack.ts
│   │   │   ├── termii.ts
│   │   │   └── resend.ts
│   │   ├── auth/                     # Auth config
│   │   │   └── next-auth.config.ts
│   │   ├── socket/                   # Socket.io server
│   │   │   └── server.ts
│   │   └── utils/                    # Utilities
│   │       ├── validation.ts
│   │       ├── encryption.ts
│   │       ├── formatting.ts
│   │       └── constants.ts
│   ├── store/                        # Zustand state management
│   │   ├── auth-store.ts
│   │   ├── auction-store.ts
│   │   └── notification-store.ts
│   ├── hooks/                        # Global custom hooks
│   │   ├── use-offline.ts
│   │   ├── use-geolocation.ts
│   │   └── use-speech-to-text.ts
│   ├── types/                        # Global TypeScript types
│   │   ├── api.ts
│   │   ├── database.ts
│   │   └── common.ts
│   └── middleware.ts                 # Next.js middleware
├── public/                           # Static assets
│   ├── icons/
│   ├── images/
│   ├── manifest.json                 # PWA manifest
│   └── sw.js                         # Service worker
├── tests/                            # Tests
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── drizzle.config.ts                 # Drizzle ORM config
├── next.config.js                    # Next.js config
├── tailwind.config.ts                # Tailwind config
├── tsconfig.json                     # TypeScript config
└── package.json
```


## Components and Interfaces

### Core Domain Entities

#### User Entity

```typescript
// src/types/database.ts
export interface User {
  id: string; // UUID
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  fullName: string;
  dateOfBirth: Date;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  loginDeviceType: DeviceType | null;
}

export enum UserRole {
  VENDOR = 'vendor',
  CLAIMS_ADJUSTER = 'claims_adjuster',
  SALVAGE_MANAGER = 'salvage_manager',
  FINANCE_OFFICER = 'finance_officer',
  SYSTEM_ADMIN = 'system_admin',
}

export enum UserStatus {
  UNVERIFIED_TIER_0 = 'unverified_tier_0',
  PHONE_VERIFIED_TIER_0 = 'phone_verified_tier_0',
  VERIFIED_TIER_1 = 'verified_tier_1',
  VERIFIED_TIER_2 = 'verified_tier_2',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

export enum DeviceType {
  MOBILE = 'mobile',
  DESKTOP = 'desktop',
  TABLET = 'tablet',
}
```

#### Vendor Entity

```typescript
export interface Vendor {
  id: string; // UUID
  userId: string; // FK to User
  businessName: string | null;
  tier: VendorTier;
  bvnEncrypted: string | null; // AES-256 encrypted
  bvnVerifiedAt: Date | null;
  cacNumber: string | null;
  tin: string | null;
  bankAccountNumber: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  categories: AssetType[];
  status: VendorStatus;
  performanceStats: VendorPerformanceStats;
  rating: number; // 0-5
  approvedBy: string | null; // FK to User
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export enum VendorTier {
  TIER_1_BVN = 'tier1_bvn',
  TIER_2_FULL = 'tier2_full',
}

export enum VendorStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  SUSPENDED = 'suspended',
}

export interface VendorPerformanceStats {
  totalBids: number;
  totalWins: number;
  winRate: number; // percentage
  avgPaymentTimeHours: number;
  onTimePickupRate: number; // percentage
  fraudFlags: number;
}
```

#### Salvage Case Entity

```typescript
export interface SalvageCase {
  id: string; // UUID
  claimReference: string;
  assetType: AssetType;
  assetDetails: AssetDetails;
  marketValue: number; // Decimal(12,2)
  estimatedSalvageValue: number; // Decimal(12,2)
  reservePrice: number; // Decimal(12,2)
  damageSeverity: DamageSeverity;
  aiAssessment: AIAssessment;
  gpsLocation: GeoPoint;
  locationName: string;
  photos: string[]; // Cloudinary URLs
  voiceNotes: string[]; // Text transcriptions
  status: CaseStatus;
  createdBy: string; // FK to User
  approvedBy: string | null; // FK to User
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
}

export enum AssetType {
  VEHICLE = 'vehicle',
  PROPERTY = 'property',
  ELECTRONICS = 'electronics',
}

export interface AssetDetails {
  // Vehicle-specific
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  // Property-specific
  propertyType?: string;
  address?: string;
  // Electronics-specific
  brand?: string;
  serialNumber?: string;
}

export enum DamageSeverity {
  MINOR = 'minor', // 40-60% value
  MODERATE = 'moderate', // 20-40% value
  SEVERE = 'severe', // 5-20% value
}

export interface AIAssessment {
  labels: string[];
  confidenceScore: number; // 0-100
  damagePercentage: number; // 0-100
  processedAt: Date;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export enum CaseStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  ACTIVE_AUCTION = 'active_auction',
  SOLD = 'sold',
  CANCELLED = 'cancelled',
}
```

#### Auction Entity

```typescript
export interface Auction {
  id: string; // UUID
  caseId: string; // FK to SalvageCase
  startTime: Date;
  endTime: Date;
  originalEndTime: Date;
  extensionCount: number;
  currentBid: number | null; // Decimal(12,2)
  currentBidder: string | null; // FK to Vendor
  minimumIncrement: number; // Decimal(12,2)
  status: AuctionStatus;
  watchingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum AuctionStatus {
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  EXTENDED = 'extended',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}
```

#### Bid Entity

```typescript
export interface Bid {
  id: string; // UUID
  auctionId: string; // FK to Auction
  vendorId: string; // FK to Vendor
  amount: number; // Decimal(12,2)
  otpVerified: boolean;
  ipAddress: string;
  deviceType: DeviceType;
  createdAt: Date;
}
```

#### Payment Entity

```typescript
export interface Payment {
  id: string; // UUID
  auctionId: string; // FK to Auction
  vendorId: string; // FK to Vendor
  amount: number; // Decimal(12,2)
  paymentMethod: PaymentMethod;
  paymentReference: string | null;
  paymentProofUrl: string | null; // Cloudinary URL
  escrowStatus: EscrowStatus;
  status: PaymentStatus;
  verifiedBy: string | null; // FK to User
  verifiedAt: Date | null;
  autoVerified: boolean;
  paymentDeadline: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum PaymentMethod {
  PAYSTACK = 'paystack',
  FLUTTERWAVE = 'flutterwave',
  BANK_TRANSFER = 'bank_transfer',
  ESCROW_WALLET = 'escrow_wallet',
}

export enum EscrowStatus {
  NONE = 'none',
  FROZEN = 'frozen',
  RELEASED = 'released',
}

export enum PaymentStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
  OVERDUE = 'overdue',
}
```

#### Escrow Wallet Entity

```typescript
export interface EscrowWallet {
  id: string; // UUID
  vendorId: string; // FK to Vendor
  balance: number; // Decimal(12,2)
  frozenAmount: number; // Decimal(12,2)
  availableBalance: number; // Decimal(12,2)
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransaction {
  id: string; // UUID
  walletId: string; // FK to EscrowWallet
  type: TransactionType;
  amount: number; // Decimal(12,2)
  balanceAfter: number; // Decimal(12,2)
  reference: string;
  description: string;
  createdAt: Date;
}

export enum TransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
  FREEZE = 'freeze',
  UNFREEZE = 'unfreeze',
}
```

#### Audit Log Entity

```typescript
export interface AuditLog {
  id: string; // UUID
  userId: string; // FK to User
  actionType: string;
  entityType: string;
  entityId: string;
  ipAddress: string;
  deviceType: DeviceType;
  userAgent: string;
  beforeState: Record<string, any> | null;
  afterState: Record<string, any> | null;
  createdAt: Date;
}
```


### Service Interfaces

#### Authentication Service

```typescript
// src/features/auth/services/auth.service.ts
export interface IAuthService {
  register(data: RegisterDTO): Promise<User>;
  login(credentials: LoginDTO): Promise<AuthResponse>;
  verifyOTP(userId: string, otp: string): Promise<boolean>;
  sendOTP(phone: string): Promise<void>;
  logout(userId: string): Promise<void>;
  refreshToken(refreshToken: string): Promise<AuthResponse>;
}

export interface RegisterDTO {
  email: string;
  phone: string;
  password: string;
  fullName: string;
  dateOfBirth: Date;
  role: UserRole;
}

export interface LoginDTO {
  emailOrPhone: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
```

#### BVN Verification Service

```typescript
// src/features/vendors/services/bvn-verification.service.ts
export interface IBVNVerificationService {
  verifyBVN(bvn: string, dob: Date, phone: string): Promise<BVNVerificationResult>;
  encryptBVN(bvn: string): Promise<string>;
  decryptBVN(encrypted: string): Promise<string>;
  maskBVN(bvn: string): string;
}

export interface BVNVerificationResult {
  verified: boolean;
  fullName: string;
  dateOfBirth: Date;
  phone: string;
  matchScore: number;
  errors: string[];
}
```

#### AI Assessment Service

```typescript
// src/features/cases/services/ai-assessment.service.ts
export interface IAIAssessmentService {
  assessDamage(imageUrls: string[]): Promise<AIAssessment>;
  extractTextFromDocument(imageUrl: string): Promise<OCRResult>;
  compressImage(imageBuffer: Buffer): Promise<Buffer>;
}

export interface OCRResult {
  text: string;
  confidence: number;
  extractedFields: Record<string, string>;
}
```

#### Bidding Service

```typescript
// src/features/auctions/services/bidding.service.ts
export interface IBiddingService {
  placeBid(auctionId: string, vendorId: string, amount: number, otp: string): Promise<Bid>;
  validateBid(auctionId: string, amount: number): Promise<ValidationResult>;
  getAuctionBids(auctionId: string): Promise<Bid[]>;
  getCurrentHighestBid(auctionId: string): Promise<Bid | null>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

#### Payment Service

```typescript
// src/features/payments/services/payment.service.ts
export interface IPaymentService {
  initiatePayment(auctionId: string, vendorId: string, method: PaymentMethod): Promise<PaymentInitiation>;
  verifyPayment(paymentId: string): Promise<Payment>;
  processWebhook(provider: string, payload: any, signature: string): Promise<void>;
  flagOverduePayments(): Promise<void>;
}

export interface PaymentInitiation {
  paymentId: string;
  paymentUrl: string;
  reference: string;
  amount: number;
  deadline: Date;
}
```

#### Notification Service

```typescript
// src/features/notifications/services/notification.service.ts
export interface INotificationService {
  sendSMS(phone: string, message: string): Promise<void>;
  sendEmail(to: string, subject: string, html: string): Promise<void>;
  sendPushNotification(userId: string, notification: PushNotification): Promise<void>;
  sendMultiChannel(userId: string, notification: MultiChannelNotification): Promise<void>;
}

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, any>;
  url?: string;
}

export interface MultiChannelNotification {
  sms?: string;
  email?: EmailContent;
  push?: PushNotification;
}

export interface EmailContent {
  subject: string;
  html: string;
}
```


## Data Models

### Database Schema (Drizzle ORM)

#### Users Table

```typescript
// src/lib/db/schema/users.ts
import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'vendor',
  'claims_adjuster',
  'salvage_manager',
  'finance_officer',
  'system_admin',
]);

export const userStatusEnum = pgEnum('user_status', [
  'unverified_tier_0',
  'phone_verified_tier_0',
  'verified_tier_1',
  'verified_tier_2',
  'suspended',
  'deleted',
]);

export const deviceTypeEnum = pgEnum('device_type', ['mobile', 'desktop', 'tablet']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  status: userStatusEnum('status').notNull().default('unverified_tier_0'),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  dateOfBirth: timestamp('date_of_birth').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
  loginDeviceType: deviceTypeEnum('login_device_type'),
});

// Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
```

#### Vendors Table

```typescript
// src/lib/db/schema/vendors.ts
import { pgTable, uuid, varchar, timestamp, numeric, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const vendorTierEnum = pgEnum('vendor_tier', ['tier1_bvn', 'tier2_full']);
export const vendorStatusEnum = pgEnum('vendor_status', ['pending', 'approved', 'suspended']);
export const assetTypeEnum = pgEnum('asset_type', ['vehicle', 'property', 'electronics']);

export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  businessName: varchar('business_name', { length: 255 }),
  tier: vendorTierEnum('tier').notNull().default('tier1_bvn'),
  bvnEncrypted: varchar('bvn_encrypted', { length: 255 }),
  bvnVerifiedAt: timestamp('bvn_verified_at'),
  cacNumber: varchar('cac_number', { length: 50 }),
  tin: varchar('tin', { length: 50 }),
  bankAccountNumber: varchar('bank_account_number', { length: 20 }),
  bankName: varchar('bank_name', { length: 100 }),
  bankAccountName: varchar('bank_account_name', { length: 255 }),
  categories: assetTypeEnum('categories').array(),
  status: vendorStatusEnum('status').notNull().default('pending'),
  performanceStats: jsonb('performance_stats').notNull().default({
    totalBids: 0,
    totalWins: 0,
    winRate: 0,
    avgPaymentTimeHours: 0,
    onTimePickupRate: 0,
    fraudFlags: 0,
  }),
  rating: numeric('rating', { precision: 3, scale: 2 }).notNull().default('0.00'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Indexes
CREATE INDEX idx_vendors_user_id ON vendors(user_id);
CREATE INDEX idx_vendors_tier ON vendors(tier);
CREATE INDEX idx_vendors_status ON vendors(status);
CREATE INDEX idx_vendors_rating ON vendors(rating DESC);
```

#### Salvage Cases Table

```typescript
// src/lib/db/schema/cases.ts
import { pgTable, uuid, varchar, timestamp, numeric, jsonb, point, pgEnum } from 'drizzle-orm/pg-core';

export const damageSeverityEnum = pgEnum('damage_severity', ['minor', 'moderate', 'severe']);
export const caseStatusEnum = pgEnum('case_status', [
  'draft',
  'pending_approval',
  'approved',
  'active_auction',
  'sold',
  'cancelled',
]);

export const salvageCases = pgTable('salvage_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  claimReference: varchar('claim_reference', { length: 100 }).notNull().unique(),
  assetType: assetTypeEnum('asset_type').notNull(),
  assetDetails: jsonb('asset_details').notNull(),
  marketValue: numeric('market_value', { precision: 12, scale: 2 }).notNull(),
  estimatedSalvageValue: numeric('estimated_salvage_value', { precision: 12, scale: 2 }).notNull(),
  reservePrice: numeric('reserve_price', { precision: 12, scale: 2 }).notNull(),
  damageSeverity: damageSeverityEnum('damage_severity').notNull(),
  aiAssessment: jsonb('ai_assessment').notNull(),
  gpsLocation: point('gps_location').notNull(),
  locationName: varchar('location_name', { length: 255 }).notNull(),
  photos: varchar('photos').array().notNull(),
  voiceNotes: varchar('voice_notes').array(),
  status: caseStatusEnum('status').notNull().default('draft'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  approvedBy: uuid('approved_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  approvedAt: timestamp('approved_at'),
});

// Indexes
CREATE INDEX idx_cases_claim_reference ON salvage_cases(claim_reference);
CREATE INDEX idx_cases_status ON salvage_cases(status);
CREATE INDEX idx_cases_created_by ON salvage_cases(created_by);
CREATE INDEX idx_cases_asset_type ON salvage_cases(asset_type);
CREATE INDEX idx_cases_created_at ON salvage_cases(created_at DESC);
```

#### Auctions Table

```typescript
// src/lib/db/schema/auctions.ts
import { pgTable, uuid, timestamp, numeric, integer, pgEnum } from 'drizzle-orm/pg-core';

export const auctionStatusEnum = pgEnum('auction_status', [
  'scheduled',
  'active',
  'extended',
  'closed',
  'cancelled',
]);

export const auctions = pgTable('auctions', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id').notNull().references(() => salvageCases.id, { onDelete: 'cascade' }),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  originalEndTime: timestamp('original_end_time').notNull(),
  extensionCount: integer('extension_count').notNull().default(0),
  currentBid: numeric('current_bid', { precision: 12, scale: 2 }),
  currentBidder: uuid('current_bidder').references(() => vendors.id),
  minimumIncrement: numeric('minimum_increment', { precision: 12, scale: 2 }).notNull().default('10000.00'),
  status: auctionStatusEnum('status').notNull().default('scheduled'),
  watchingCount: integer('watching_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Indexes
CREATE INDEX idx_auctions_case_id ON auctions(case_id);
CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_end_time ON auctions(end_time);
CREATE INDEX idx_auctions_status_end_time ON auctions(status, end_time) WHERE status = 'active';
```

#### Bids Table

```typescript
// src/lib/db/schema/bids.ts
import { pgTable, uuid, timestamp, numeric, boolean, varchar } from 'drizzle-orm/pg-core';

export const bids = pgTable('bids', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id').notNull().references(() => auctions.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  otpVerified: boolean('otp_verified').notNull().default(false),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  deviceType: deviceTypeEnum('device_type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Indexes
CREATE INDEX idx_bids_auction_id ON bids(auction_id);
CREATE INDEX idx_bids_vendor_id ON bids(vendor_id);
CREATE INDEX idx_bids_created_at ON bids(created_at DESC);
CREATE INDEX idx_bids_auction_amount ON bids(auction_id, amount DESC);
```

#### Payments Table

```typescript
// src/lib/db/schema/payments.ts
import { pgTable, uuid, timestamp, numeric, boolean, varchar, pgEnum } from 'drizzle-orm/pg-core';

export const paymentMethodEnum = pgEnum('payment_method', [
  'paystack',
  'flutterwave',
  'bank_transfer',
  'escrow_wallet',
]);

export const escrowStatusEnum = pgEnum('escrow_status', ['none', 'frozen', 'released']);

export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'verified', 'rejected', 'overdue']);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id').notNull().references(() => auctions.id),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  paymentReference: varchar('payment_reference', { length: 255 }),
  paymentProofUrl: varchar('payment_proof_url', { length: 500 }),
  escrowStatus: escrowStatusEnum('escrow_status').notNull().default('none'),
  status: paymentStatusEnum('status').notNull().default('pending'),
  verifiedBy: uuid('verified_by').references(() => users.id),
  verifiedAt: timestamp('verified_at'),
  autoVerified: boolean('auto_verified').notNull().default(false),
  paymentDeadline: timestamp('payment_deadline').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Indexes
CREATE INDEX idx_payments_auction_id ON payments(auction_id);
CREATE INDEX idx_payments_vendor_id ON payments(vendor_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_deadline ON payments(payment_deadline) WHERE status = 'pending';
```

#### Escrow Wallets Table

```typescript
// src/lib/db/schema/escrow.ts
import { pgTable, uuid, timestamp, numeric, varchar, pgEnum } from 'drizzle-orm/pg-core';

export const escrowWallets = pgTable('escrow_wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().unique().references(() => vendors.id, { onDelete: 'cascade' }),
  balance: numeric('balance', { precision: 12, scale: 2 }).notNull().default('0.00'),
  frozenAmount: numeric('frozen_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  availableBalance: numeric('available_balance', { precision: 12, scale: 2 }).notNull().default('0.00'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const transactionTypeEnum = pgEnum('transaction_type', ['credit', 'debit', 'freeze', 'unfreeze']);

export const walletTransactions = pgTable('wallet_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletId: uuid('wallet_id').notNull().references(() => escrowWallets.id, { onDelete: 'cascade' }),
  type: transactionTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 12, scale: 2 }).notNull(),
  reference: varchar('reference', { length: 255 }).notNull(),
  description: varchar('description', { length: 500 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Indexes
CREATE INDEX idx_escrow_wallets_vendor_id ON escrow_wallets(vendor_id);
CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
```

#### Audit Logs Table

```typescript
// src/lib/db/schema/audit-logs.ts
import { pgTable, uuid, timestamp, varchar, jsonb } from 'drizzle-orm/pg-core';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  actionType: varchar('action_type', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  deviceType: deviceTypeEnum('device_type').notNull(),
  userAgent: varchar('user_agent', { length: 500 }).notNull(),
  beforeState: jsonb('before_state'),
  afterState: jsonb('after_state'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
```


### API Endpoints

#### Authentication Endpoints

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/verify-otp
POST   /api/auth/resend-otp
POST   /api/auth/logout
POST   /api/auth/refresh-token
GET    /api/auth/session
```

#### Vendor Endpoints

```
GET    /api/vendors
GET    /api/vendors/:id
POST   /api/vendors
PUT    /api/vendors/:id
POST   /api/vendors/verify-bvn
POST   /api/vendors/tier2-kyc
GET    /api/vendors/:id/performance
GET    /api/vendors/:id/ratings
POST   /api/vendors/:id/ratings
GET    /api/vendors/leaderboard
```

#### Salvage Case Endpoints

```
GET    /api/cases
GET    /api/cases/:id
POST   /api/cases
PUT    /api/cases/:id
DELETE /api/cases/:id
POST   /api/cases/:id/approve
POST   /api/cases/:id/reject
POST   /api/cases/:id/photos
POST   /api/cases/:id/ai-assessment
GET    /api/cases/pending-approval
```

#### Auction Endpoints

```
GET    /api/auctions
GET    /api/auctions/:id
POST   /api/auctions
PUT    /api/auctions/:id
GET    /api/auctions/:id/bids
POST   /api/auctions/:id/bids
GET    /api/auctions/:id/watching
POST   /api/auctions/:id/watch
DELETE /api/auctions/:id/watch
GET    /api/auctions/active
GET    /api/auctions/ending-soon
```

#### Payment Endpoints

```
GET    /api/payments
GET    /api/payments/:id
POST   /api/payments/initiate
POST   /api/payments/:id/verify
POST   /api/payments/:id/upload-proof
GET    /api/payments/pending
GET    /api/payments/overdue
POST   /api/payments/wallet/fund
GET    /api/payments/wallet/balance
GET    /api/payments/wallet/transactions
```

#### Webhook Endpoints

```
POST   /api/webhooks/paystack
POST   /api/webhooks/flutterwave
```

#### Admin Endpoints

```
GET    /api/admin/users
POST   /api/admin/users
PUT    /api/admin/users/:id
DELETE /api/admin/users/:id
GET    /api/admin/fraud-alerts
POST   /api/admin/fraud-alerts/:id/dismiss
POST   /api/admin/fraud-alerts/:id/suspend-vendor
GET    /api/admin/audit-logs
GET    /api/admin/system-health
```

#### Dashboard Endpoints

```
GET    /api/dashboard/manager
GET    /api/dashboard/vendor
GET    /api/dashboard/finance
GET    /api/dashboard/adjuster
```

#### Notification Endpoints

```
GET    /api/notifications
PUT    /api/notifications/preferences
POST   /api/notifications/test
```

#### Report Endpoints

```
GET    /api/reports/recovery-summary
GET    /api/reports/vendor-rankings
GET    /api/reports/payment-aging
POST   /api/reports/generate-pdf
```

### Socket.io Events

#### Client → Server Events

```typescript
// Auction watching
socket.emit('auction:watch', { auctionId: string });
socket.emit('auction:unwatch', { auctionId: string });

// Bidding
socket.emit('bid:place', { auctionId: string, amount: number, otp: string });

// Real-time updates subscription
socket.emit('subscribe:auctions', { filters?: AuctionFilters });
socket.emit('unsubscribe:auctions');
```

#### Server → Client Events

```typescript
// Auction updates
socket.on('auction:updated', (data: { auctionId: string; auction: Auction }) => {});
socket.on('auction:new-bid', (data: { auctionId: string; bid: Bid }) => {});
socket.on('auction:extended', (data: { auctionId: string; newEndTime: Date }) => {});
socket.on('auction:closed', (data: { auctionId: string; winnerId: string }) => {});
socket.on('auction:watching-count', (data: { auctionId: string; count: number }) => {});

// Vendor notifications
socket.on('vendor:outbid', (data: { auctionId: string; newBid: number }) => {});
socket.on('vendor:won', (data: { auctionId: string; amount: number }) => {});

// System notifications
socket.on('notification:new', (data: { notification: Notification }) => {});
```

### PWA Configuration

#### Service Worker Strategy

```javascript
// public/sw.js
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// Precache static assets
precacheAndRoute(self.__WB_MANIFEST);

// Cache images (CacheFirst)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Cache API responses (NetworkFirst with fallback)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);

// Background sync for case submissions
const bgSyncPlugin = new BackgroundSyncPlugin('case-submissions', {
  maxRetentionTime: 24 * 60, // Retry for up to 24 hours
});

registerRoute(
  ({ url }) => url.pathname === '/api/cases',
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'POST'
);
```

#### Manifest Configuration

```json
// public/manifest.json
{
  "name": "NEM Salvage Management System",
  "short_name": "NEM Salvage",
  "description": "Mobile-first salvage management platform for NEM Insurance Nigeria",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#800020",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Registration Input Validation

*For any* registration submission, the system should validate that email follows valid email format, phone follows Nigerian format (+234...), and password contains minimum 8 characters with at least 1 uppercase, 1 lowercase, 1 number, and 1 special character, rejecting invalid inputs and accepting valid inputs.

**Validates: Requirements 1.2, 1.3, 1.4**

### Property 2: Account Status Transitions

*For any* user account, status transitions should follow the valid state machine: unverified_tier_0 → phone_verified_tier_0 → verified_tier_1 → verified_tier_2, and no transition should skip states or move backwards except to suspended/deleted states.

**Validates: Requirements 1.6, 3.8, 4.4**

### Property 3: Comprehensive Audit Logging

*For any* user action (authentication, case management, bidding, payments, KYC verification, profile updates, admin actions), the system should create an immutable audit log entry containing user ID, action type, timestamp, IP address, device type, and before/after states where applicable.

**Validates: Requirements 11.1-11.6, 3.7, 4.6-4.12**

### Property 4: OTP Expiry and Validation

*For any* generated OTP, the code should be exactly 6 digits, expire after exactly 5 minutes, and verification should fail for expired codes, incorrect codes, or after 3 failed attempts.

**Validates: Requirements 3.3, 3.4, 3.5**

### Property 5: BVN Security (Encryption and Masking)

*For any* BVN number, when stored the system should encrypt using AES-256, when displayed the system should mask all digits except the last 4 (****7890), and decryption followed by encryption should produce the original encrypted value (round-trip property).

**Validates: Requirements 4.8, 4.9, NFR4.3**

### Property 6: BVN Verification Matching

*For any* BVN verification request, the system should call the BVN API with BVN, DOB, and phone, then match the response against registered user data, auto-approving to Tier 1 only when all fields match, and providing specific error messages for mismatches.

**Validates: Requirements 4.2, 4.3, 4.4, 4.5**

### Property 7: Case Creation Field Validation

*For any* salvage case creation, the system should validate that claim reference is unique, asset type is one of (vehicle, property, electronics), market value is positive, 3-10 photos are provided (max 5MB each), GPS coordinates are captured, and all required asset details for the selected type are present.

**Validates: Requirements 12.3-12.8, 12.10-12.12**

### Property 8: Image Compression

*For any* uploaded photo, the system should compress the image using TinyPNG API before storage, and the compressed image size should be less than or equal to the original size.

**Validates: Requirement 12.9**

### Property 9: AI Damage Assessment Completeness

*For any* set of uploaded photos, the AI assessment should return damage severity (minor/moderate/severe), confidence score (0-100), damage labels array, estimated salvage value calculated as market value × damage percentage, and reserve price at 70% of estimated value.

**Validates: Requirements 14.3-14.7**

### Property 10: Countdown Timer Formatting

*For any* auction with time remaining, the countdown timer should format as "Xd Xh Xm Xs" when >24 hours, "Xh Xm Xs" when 1-24 hours, "Xm Xs" when <1 hour, display green when >24 hours, yellow when 1-24 hours, red when <1 hour, and update every 1 second.

**Validates: Requirements 17.1-17.8**

### Property 11: Bid Validation

*For any* bid submission, the system should validate that bid amount is greater than current highest bid plus minimum increment (₦10,000), auction is in active status, vendor is Tier 1 (for bids ≤₦500k) or Tier 2 (for bids >₦500k), and OTP is verified before accepting the bid.

**Validates: Requirements 18.2, 18.3, 5.6**

### Property 12: Real-Time Bid Broadcasting

*For any* accepted bid, the system should broadcast the new bid via WebSocket to all connected clients viewing that auction within 2 seconds, and send push notification to the previous highest bidder within 5 seconds.

**Validates: Requirements 18.8, 19.4**

### Property 13: Auction Auto-Extension

*For any* auction in active status, if a bid is placed when less than 5 minutes remain, the system should extend the end time by exactly 2 minutes, change status to 'extended', notify all bidders, and continue extending unlimited times until no bids occur for 5 consecutive minutes.

**Validates: Requirements 21.1-21.6**

### Property 14: Payment Webhook Verification

*For any* Paystack webhook received, the system should verify the signature matches the expected hash, validate the payment reference exists in the database, confirm the amount matches the invoice amount, and only then mark payment as verified and auto-generate pickup authorization.

**Validates: Requirements 24.6, 24.7, 24.8**

### Property 15: Escrow Wallet Balance Invariant

*For any* escrow wallet, the invariant `balance = availableBalance + frozenAmount` should always hold true after any transaction (credit, debit, freeze, unfreeze), and the available balance should never be negative.

**Validates: Requirements 26.4-26.9**

### Property 16: Wallet Transaction Round-Trip

*For any* wallet, freezing an amount then unfreezing the same amount should restore the wallet to its original state with the same available balance and zero frozen amount.

**Validates: Requirements 26.5-26.8**

### Property 17: Payment Deadline Enforcement

*For any* auction win, the system should set payment deadline to exactly 24 hours after auction close, send SMS reminder at 12 hours before deadline, flag payment as overdue if not received within 24 hours, and forfeit auction winner if payment not received within 48 hours.

**Validates: Requirements 29.1, 30.2-30.8**

### Property 18: Fraud Detection Pattern Matching

*For any* bid submission, the system should flag as suspicious if: same IP address has bid against itself in the same auction, OR bid amount is >3x previous bid from vendor account <7 days old, OR multiple vendor accounts exist with same phone/BVN.

**Validates: Requirements 34.2-34.4**

### Property 19: Vendor Rating Calculation

*For any* vendor with N ratings, the average rating should equal the sum of all rating values divided by N, rounded to 2 decimal places, and should be recalculated after each new rating is submitted.

**Validates: Requirements 37.5, 37.6**

### Property 20: Sensitive Data Encryption Round-Trip

*For any* sensitive data (passwords, BVN, bank details), encrypting then decrypting should produce the original value, and encrypted values should not be human-readable.

**Validates: Requirements NFR4.2**

### Property 21: Tier-Based Bid Limits

*For any* bid submission, Tier 1 vendors should be blocked from bidding on auctions with reserve price >₦500,000, and Tier 2 vendors should be allowed to bid on any auction regardless of amount.

**Validates: Requirements 5.6, 6.2**

### Property 22: Case Approval Workflow

*For any* salvage case in 'pending_approval' status, when approved by Salvage Manager, the system should create an auction with start time = now, end time = now + 5 days, status = 'active', notify all matching vendors, and update case status to 'active_auction'.

**Validates: Requirements 15.6, 15.7**

### Property 23: Offline Case Sync

*For any* case created offline and stored in IndexedDB, when internet connection is restored, the system should auto-sync the case to the server, upload all photos, and update the local case with the server-generated ID.

**Validates: Requirements 13.5-13.9**

### Property 24: Multi-Channel Notification Delivery

*For any* critical notification (OTP, payment deadline, auction ending), the system should attempt delivery via all enabled channels (SMS, email, push) based on user preferences, with fallback to SMS/email if push fails, and log all delivery attempts.

**Validates: Requirements 40.1-40.6**

### Property 25: Vendor Performance Stats Update

*For any* completed auction, the winning vendor's performance stats should update: totalBids +1, totalWins +1, winRate recalculated, and avgPaymentTimeHours updated based on actual payment time.

**Validates: Requirements 32.1, 37.5**


## Error Handling

### Error Response Format

All API errors follow a consistent format:

```typescript
interface ErrorResponse {
  status: 'error';
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}
```

### Error Categories

#### Validation Errors (400)

```typescript
{
  status: 'error',
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input data',
    details: {
      fields: {
        email: 'Invalid email format',
        password: 'Password must contain at least 8 characters'
      }
    },
    timestamp: '2026-01-21T10:30:00Z',
    requestId: 'req_abc123'
  }
}
```

#### Authentication Errors (401)

```typescript
{
  status: 'error',
  error: {
    code: 'UNAUTHORIZED',
    message: 'Invalid credentials',
    timestamp: '2026-01-21T10:30:00Z',
    requestId: 'req_abc123'
  }
}
```

#### Authorization Errors (403)

```typescript
{
  status: 'error',
  error: {
    code: 'FORBIDDEN',
    message: 'Insufficient permissions',
    details: {
      required: 'salvage_manager',
      current: 'vendor'
    },
    timestamp: '2026-01-21T10:30:00Z',
    requestId: 'req_abc123'
  }
}
```

#### Business Logic Errors (422)

```typescript
{
  status: 'error',
  error: {
    code: 'BID_TOO_LOW',
    message: 'Bid amount must be at least ₦510,000',
    details: {
      minimumBid: 510000,
      submittedBid: 500000
    },
    timestamp: '2026-01-21T10:30:00Z',
    requestId: 'req_abc123'
  }
}
```

#### External Service Errors (503)

```typescript
{
  status: 'error',
  error: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'BVN verification service temporarily unavailable',
    details: {
      service: 'Mono BVN API',
      retryAfter: 60
    },
    timestamp: '2026-01-21T10:30:00Z',
    requestId: 'req_abc123'
  }
}
```

### Error Handling Strategy

#### Client-Side Error Handling

```typescript
// src/lib/utils/error-handler.ts
export class APIError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export async function handleAPIResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json();
    throw new APIError(
      errorData.error.code,
      errorData.error.message,
      response.status,
      errorData.error.details
    );
  }
  return response.json();
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof APIError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
```

#### Server-Side Error Handling

```typescript
// src/lib/utils/error-middleware.ts
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Log error with context
  logger.error({
    error: err.message,
    stack: err.stack,
    requestId: req.id,
    userId: req.user?.id,
    path: req.path,
    method: req.method,
  });

  // Send appropriate error response
  if (err instanceof ValidationError) {
    return res.status(400).json({
      status: 'error',
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.details,
        timestamp: new Date().toISOString(),
        requestId: req.id,
      },
    });
  }

  if (err instanceof AuthenticationError) {
    return res.status(401).json({
      status: 'error',
      error: {
        code: 'UNAUTHORIZED',
        message: err.message,
        timestamp: new Date().toISOString(),
        requestId: req.id,
      },
    });
  }

  // Default to 500 for unexpected errors
  return res.status(500).json({
    status: 'error',
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      requestId: req.id,
    },
  });
}
```

### Retry Logic

#### Exponential Backoff for External APIs

```typescript
// src/lib/utils/retry.ts
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

### Circuit Breaker Pattern

```typescript
// src/lib/utils/circuit-breaker.ts
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime! > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}
```


## Testing Strategy

### Dual Testing Approach

The system requires both unit tests and property-based tests for comprehensive coverage:

- **Unit Tests**: Verify specific examples, edge cases, and error conditions
- **Property Tests**: Verify universal properties across all inputs through randomization

Both approaches are complementary and necessary. Unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across a wide range of inputs.

### Property-Based Testing Configuration

**Library**: fast-check (TypeScript/JavaScript property-based testing library)

**Configuration**:
- Minimum 100 iterations per property test (due to randomization)
- Each property test must reference its design document property
- Tag format: `Feature: salvage-management-system-mvp, Property {number}: {property_text}`

**Example Property Test**:

```typescript
// tests/unit/auth/password-validation.test.ts
import fc from 'fast-check';
import { validatePassword } from '@/lib/utils/validation';

describe('Property 1: Registration Input Validation - Password', () => {
  it('should accept valid passwords with 8+ chars, 1 uppercase, 1 number, 1 special char', () => {
    // Feature: salvage-management-system-mvp, Property 1: Registration Input Validation
    fc.assert(
      fc.property(
        fc.string({ minLength: 8 }),
        fc.constantFrom('A', 'B', 'C', 'Z'),
        fc.integer({ min: 0, max: 9 }),
        fc.constantFrom('!', '@', '#', '$'),
        (base, upper, num, special) => {
          const password = base + upper + num + special;
          const result = validatePassword(password);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject passwords without uppercase letters', () => {
    // Feature: salvage-management-system-mvp, Property 1: Registration Input Validation
    fc.assert(
      fc.property(
        fc.string({ minLength: 8 }).filter(s => !/[A-Z]/.test(s)),
        (password) => {
          const result = validatePassword(password);
          expect(result.valid).toBe(false);
          expect(result.errors).toContain('Password must contain at least 1 uppercase letter');
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Unit Testing Strategy

**Framework**: Vitest + React Testing Library

**Coverage Requirements**:
- Overall: 80% minimum
- Critical paths: 100% (payment processing, BVN verification, auction closure, security/authentication)

**Example Unit Test**:

```typescript
// tests/unit/payments/paystack-webhook.test.ts
import { describe, it, expect, vi } from 'vitest';
import { verifyPaystackWebhook } from '@/features/payments/services/paystack.service';

describe('Payment Webhook Verification', () => {
  it('should verify valid Paystack webhook signature', async () => {
    const payload = {
      event: 'charge.success',
      data: {
        reference: 'ref_123',
        amount: 50000000, // ₦500,000 in kobo
        status: 'success',
      },
    };
    const signature = 'valid_signature_hash';

    const result = await verifyPaystackWebhook(payload, signature);

    expect(result.verified).toBe(true);
    expect(result.reference).toBe('ref_123');
    expect(result.amount).toBe(500000);
  });

  it('should reject webhook with invalid signature', async () => {
    const payload = { event: 'charge.success', data: {} };
    const signature = 'invalid_signature';

    await expect(verifyPaystackWebhook(payload, signature)).rejects.toThrow('Invalid webhook signature');
  });

  it('should reject webhook with mismatched amount', async () => {
    const payload = {
      event: 'charge.success',
      data: {
        reference: 'ref_123',
        amount: 30000000, // ₦300,000 but invoice is ₦500,000
        status: 'success',
      },
    };
    const signature = 'valid_signature_hash';

    await expect(verifyPaystackWebhook(payload, signature)).rejects.toThrow('Amount mismatch');
  });
});
```

### Integration Testing

**Framework**: Vitest + Supertest (API testing)

**Scope**: Test multiple components together (API → Service → Database)

**Example Integration Test**:

```typescript
// tests/integration/auctions/bidding.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { db } from '@/lib/db/drizzle';

describe('Bidding Integration Tests', () => {
  let auctionId: string;
  let vendorToken: string;

  beforeEach(async () => {
    // Setup test data
    const auction = await createTestAuction();
    auctionId = auction.id;
    vendorToken = await getVendorAuthToken();
  });

  afterEach(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  it('should place bid and broadcast to WebSocket clients', async () => {
    const bidAmount = 550000;

    const response = await request(app)
      .post(`/api/auctions/${auctionId}/bids`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .send({ amount: bidAmount, otp: '123456' });

    expect(response.status).toBe(201);
    expect(response.body.data.amount).toBe(bidAmount);

    // Verify bid was saved to database
    const bids = await db.query.bids.findMany({
      where: eq(bids.auctionId, auctionId),
    });
    expect(bids).toHaveLength(1);
    expect(bids[0].amount).toBe(bidAmount);

    // Verify auction was updated
    const auction = await db.query.auctions.findFirst({
      where: eq(auctions.id, auctionId),
    });
    expect(auction.currentBid).toBe(bidAmount);
  });
});
```

### End-to-End Testing

**Framework**: Playwright

**Scope**: Test complete user flows from UI to database

**Example E2E Test**:

```typescript
// tests/e2e/vendor-registration.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Vendor Registration Flow', () => {
  test('should complete Tier 1 registration with BVN', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/register');

    // Fill registration form
    await page.fill('[name="fullName"]', 'John Doe');
    await page.fill('[name="email"]', 'john@example.com');
    await page.fill('[name="phone"]', '+2348012345678');
    await page.fill('[name="password"]', 'Password123!');
    await page.fill('[name="dateOfBirth"]', '1990-01-01');
    await page.check('[name="termsAccepted"]');

    // Submit registration
    await page.click('button[type="submit"]');

    // Verify OTP screen appears
    await expect(page.locator('text=Enter OTP')).toBeVisible();

    // Enter OTP (mock in test environment)
    await page.fill('[name="otp"]', '123456');
    await page.click('button:has-text("Verify")');

    // Verify BVN verification screen appears
    await expect(page.locator('text=Verify your identity')).toBeVisible();

    // Enter BVN
    await page.fill('[name="bvn"]', '12345678901');
    await page.click('button:has-text("Verify BVN")');

    // Verify success message
    await expect(page.locator('text=Congratulations! You can now bid up to ₦500,000')).toBeVisible();

    // Verify redirect to vendor dashboard
    await expect(page).toHaveURL('/vendor/dashboard');

    // Verify Tier 1 badge is displayed
    await expect(page.locator('text=Tier 1')).toBeVisible();
  });
});
```

### Load Testing

**Tool**: k6

**Targets**:
- 200 concurrent users (70% mobile, 30% desktop)
- API response time <500ms (95th percentile)
- Real-time bid updates <1s latency

**Example Load Test**:

```javascript
// tests/load/auction-bidding.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 50 },  // Ramp up to 50 users
    { duration: '5m', target: 200 }, // Ramp up to 200 users
    { duration: '10m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    errors: ['rate<0.01'],            // Error rate under 1%
  },
};

export default function () {
  const auctionId = 'test-auction-id';
  const token = 'test-vendor-token';

  // Get auction details
  const auctionRes = http.get(`https://api.example.com/api/auctions/${auctionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  check(auctionRes, {
    'auction loaded': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);

  // Place bid
  const bidRes = http.post(
    `https://api.example.com/api/auctions/${auctionId}/bids`,
    JSON.stringify({ amount: 550000, otp: '123456' }),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  check(bidRes, {
    'bid placed': (r) => r.status === 201,
    'response time OK': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(2);
}
```

### Security Testing

**Scope**: OWASP Top 10 vulnerability scanning, penetration testing

**Tools**: OWASP ZAP, Burp Suite

**Test Cases**:
1. SQL Injection prevention (parameterized queries)
2. XSS prevention (input sanitization)
3. CSRF protection (CSRF tokens)
4. Authentication bypass attempts
5. Authorization bypass attempts
6. Session hijacking prevention
7. Sensitive data exposure
8. BVN encryption verification
9. Webhook signature validation
10. Rate limiting enforcement

### Mobile Testing

**Devices**: iPhone 13, Samsung Galaxy S21, Tecno Spark

**Test Cases**:
1. PWA installation
2. Offline mode functionality
3. Camera upload from mobile
4. GPS location capture
5. Touch-friendly UI (44x44px minimum)
6. Mobile network performance (3G simulation)
7. Image compression effectiveness
8. Push notification delivery
9. Responsive layout (375x667, 390x844, 414x896)
10. Service worker caching

### Test Coverage Reporting

**Tool**: Vitest coverage (c8)

**Configuration**:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.ts',
        '**/*.d.ts',
      ],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
});
```

### Continuous Integration

**CI/CD Pipeline** (GitHub Actions):

```yaml
name: CI/CD Pipeline

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npm run type-check
      
      - name: Unit tests
        run: npm run test:unit
      
      - name: Integration tests
        run: npm run test:integration
      
      - name: E2E tests
        run: npm run test:e2e
      
      - name: Coverage report
        run: npm run test:coverage
      
      - name: Security scan
        run: npm audit
```

