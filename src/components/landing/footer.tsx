'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Facebook, Twitter, Linkedin, ArrowRight } from 'lucide-react';
import { useState } from 'react';

const footerLinks = {
  company: [
    { name: 'About Us', href: '/about' },
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Careers', href: '/careers' },
    { name: 'Blog', href: '/blog' },
  ],
  legal: [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Cookie Policy', href: '/cookies' },
    { name: 'NDPR Compliance', href: '/ndpr' },
  ],
  support: [
    { name: 'Help Center', href: '/help' },
    { name: 'Contact Us', href: '#contact' },
    { name: 'FAQs', href: '#faq' },
    { name: 'Vendor Guide', href: '/guide' },
  ],
};

const socialLinks = [
  { icon: Facebook, href: 'https://facebook.com/neminsurance', label: 'Facebook' },
  { icon: Twitter, href: 'https://twitter.com/neminsurance', label: 'Twitter' },
  { icon: Linkedin, href: 'https://linkedin.com/company/neminsurance', label: 'LinkedIn' },
];

export function Footer() {
  const [email, setEmail] = useState('');
  const [subscribeStatus, setSubscribeStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setSubscribeStatus('loading');

    // Simulate subscription
    setTimeout(() => {
      setSubscribeStatus('success');
      setEmail('');
      setTimeout(() => setSubscribeStatus('idle'), 3000);
    }, 1500);
  };

  return (
    <footer className="bg-gradient-to-b from-burgundy-900 to-burgundy-950 text-white pt-20 pb-8">
      <div className="container mx-auto px-4">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center space-x-3 mb-6">
              <Image 
                src="/icons/Nem-insurance-Logo.jpg" 
                alt="NEM Insurance Logo" 
                width={48}
                height={48}
                className="object-contain rounded-lg"
              />
              <span className="font-bold text-xl">NEM Insurance</span>
            </Link>

            <p className="text-gray-300 mb-6 leading-relaxed">
              Nigeria's leading salvage management platform. Empowering vendors with AI-powered auctions, instant payments, and mobile-first technology.
            </p>

            {/* Newsletter */}
            <div>
              <h4 className="font-bold mb-3">Subscribe to our newsletter</h4>
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:border-gold-500 focus:outline-none transition-colors text-white placeholder-gray-400"
                />
                <motion.button
                  type="submit"
                  disabled={subscribeStatus === 'loading'}
                  className={`px-4 py-2 rounded-lg font-semibold flex items-center gap-2 ${
                    subscribeStatus === 'success'
                      ? 'bg-green-600'
                      : 'bg-gold-500 text-burgundy-900'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {subscribeStatus === 'success' ? '✓' : <ArrowRight className="w-5 h-5" />}
                </motion.button>
              </form>
              {subscribeStatus === 'success' && (
                <motion.p
                  className="text-green-400 text-sm mt-2"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  Thanks for subscribing!
                </motion.p>
              )}
            </div>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-bold mb-4 text-gold-400">Company</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-gray-300 hover:text-gold-400 transition-colors inline-block hover:translate-x-1 transform duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-bold mb-4 text-gold-400">Legal</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-gray-300 hover:text-gold-400 transition-colors inline-block hover:translate-x-1 transform duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="font-bold mb-4 text-gold-400">Support</h4>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-gray-300 hover:text-gold-400 transition-colors inline-block hover:translate-x-1 transform duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 mb-8" />

        {/* Bottom Footer */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Copyright */}
          <div className="text-gray-400 text-sm text-center md:text-left">
            © {new Date().getFullYear()} NEM Insurance Plc. All rights reserved.
            <br className="md:hidden" />
            <span className="hidden md:inline"> | </span>
            199 Ikorodu Road, Obanikoro, Lagos, Nigeria
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <motion.a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-gold-500 flex items-center justify-center transition-colors group"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Icon className="w-5 h-5 text-gray-300 group-hover:text-burgundy-900 transition-colors" />
                </motion.a>
              );
            })}
          </div>
        </div>

        {/* Back to Top Button */}
        <motion.button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 left-8 w-12 h-12 bg-burgundy-700 hover:bg-burgundy-600 rounded-full flex items-center justify-center shadow-xl z-40 hidden md:flex"
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
