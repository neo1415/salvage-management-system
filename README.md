# Salvage Management System - NEM Insurance

Mobile-first, AI-enhanced salvage management platform for NEM Insurance Nigeria.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.3+ (strict mode)
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: NextAuth.js v5
- **State Management**: Zustand
- **Real-time**: Socket.io
- **PWA**: Service Workers with Workbox

## Project Structure

```
salvage-management-system/
├── src/
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # Reusable UI components
│   │   ├── ui/                # Base components
│   │   ├── forms/             # Form components
│   │   ├── auction/           # Auction components
│   │   └── layout/            # Layout components
│   ├── features/              # Feature modules (Clean Architecture)
│   │   ├── auth/
│   │   ├── vendors/
│   │   ├── cases/
│   │   ├── auctions/
│   │   ├── payments/
│   │   └── notifications/
│   ├── lib/                   # Shared libraries
│   │   ├── db/               # Database
│   │   ├── redis/            # Redis client
│   │   ├── storage/          # File storage
│   │   ├── integrations/     # External APIs
│   │   ├── auth/             # Auth config
│   │   ├── socket/           # Socket.io
│   │   └── utils/            # Utilities
│   ├── store/                # Zustand stores
│   ├── hooks/                # Global custom hooks
│   ├── types/                # TypeScript types
│   └── middleware.ts         # Next.js middleware
├── public/                   # Static assets
│   ├── icons/               # PWA icons
│   ├── manifest.json        # PWA manifest
│   └── sw.js               # Service worker
└── tests/                   # Tests
    ├── unit/
    ├── integration/
    └── e2e/
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL database

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test:unit` - Run unit tests
- `npm run test:integration` - Run integration tests
- `npm run test:e2e` - Run end-to-end tests

## Color Scheme

- **Burgundy**: #800020 (Primary brand color)
- **Gold**: #FFD700 (Accent color)
- **White**: #FFFFFF (Background)

## Architecture

This project follows Clean Architecture principles with strict separation of concerns:

1. **Presentation Layer**: Next.js pages and React components
2. **Application Layer**: Use cases and business logic
3. **Domain Layer**: Entities and domain rules
4. **Infrastructure Layer**: Database, APIs, and external services

## License

Proprietary - NEM Insurance Nigeria
