'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { getBrandGradient, usePublicBranding } from '@/hooks/use-public-branding';

const footerLinks = {
  company: [
    { name: 'About Us', href: '#platform' },
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Auctions', href: '#auctions' },
    { name: 'Contact', href: '#contact' },
  ],
  legal: [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Cookie Policy', href: '/cookies' },
    { name: 'NDPR Compliance', href: '/ndpr' },
  ],
  support: [
    { name: 'Help Center', href: '#faq' },
    { name: 'Contact Us', href: '#contact' },
    { name: 'FAQs', href: '#faq' },
    { name: 'Vendor Access', href: '/register' },
  ],
};

export function Footer() {
  const { branding } = usePublicBranding();
  const [email, setEmail] = useState('');
  const [subscribeStatus, setSubscribeStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleSubscribe = (event: React.FormEvent) => {
    event.preventDefault();
    setSubscribeStatus('loading');

    setTimeout(() => {
      setSubscribeStatus('success');
      setEmail('');
      setTimeout(() => setSubscribeStatus('idle'), 3000);
    }, 900);
  };

  return (
    <footer className="pt-20 pb-8 text-white" style={{ background: getBrandGradient(branding) }}>
      <div className="container mx-auto px-4">
        <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="mb-6 flex items-center space-x-3">
              <Image
                src={branding.logoPath || '/icons/icon-192.png'}
                alt={`${branding.brandName} logo`}
                width={48}
                height={48}
                className="rounded-lg object-contain"
                unoptimized
              />
              <span className="text-xl font-bold">{branding.brandName}</span>
            </Link>

            <p className="mb-6 leading-relaxed text-white/70">
              {branding.legalName} salvage management platform. Vendor onboarding, auctions, payments, documents, and recovery workflows under one controlled brand.
            </p>

            <div>
              <h4 className="mb-3 font-bold">Get platform updates</h4>
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white placeholder-white/45 outline-none transition focus:border-white/60"
                />
                <motion.button
                  type="submit"
                  disabled={subscribeStatus === 'loading'}
                  className="flex items-center gap-2 rounded-lg px-4 py-2 font-semibold disabled:opacity-60"
                  style={subscribeStatus === 'success' ? { backgroundColor: '#16a34a', color: '#ffffff' } : { backgroundColor: branding.accentColor, color: branding.primaryColor }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {subscribeStatus === 'success' ? 'Done' : <ArrowRight className="h-5 w-5" />}
                </motion.button>
              </form>
              {subscribeStatus === 'success' ? (
                <motion.p
                  className="mt-2 text-sm text-green-300"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  Thanks for subscribing.
                </motion.p>
              ) : null}
            </div>
          </div>

          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h4 className="mb-4 font-bold capitalize" style={{ color: branding.accentColor }}>
                {group}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="inline-block text-white/70 transition duration-200 hover:translate-x-1 hover:text-white"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mb-8 border-t border-white/10" />

        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="text-center text-sm text-white/55 md:text-left">
            © {new Date().getFullYear()} {branding.legalName}. All rights reserved.
            <br className="md:hidden" />
            <span className="hidden md:inline"> | </span>
            {branding.supportEmail}
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/70">
              Powered by Salvage Bridge
            </span>
            <a href={`mailto:${branding.supportEmail}`} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/20">
              Contact support
            </a>
          </div>
        </div>

        <motion.button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 left-8 z-40 hidden h-12 w-12 items-center justify-center rounded-full shadow-xl md:flex"
          style={{ backgroundColor: branding.primaryColor, color: 'var(--brand-primary-foreground)' }}
          whileHover={{ scale: 1.1, y: -5 }}
          whileTap={{ scale: 0.9 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <span className="text-2xl">↑</span>
        </motion.button>
      </div>
    </footer>
  );
}
