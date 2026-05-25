'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePublicBranding } from '@/hooks/use-public-branding';

export function Navigation() {
  const { branding } = usePublicBranding();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Contact', href: '#contact' },
  ];

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-lg'
          : 'bg-transparent'
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <Image 
              src={branding.logoPath || '/icons/Nem-insurance-Logo.jpg'} 
              alt={`${branding.brandName} logo`} 
              width={40}
              height={40}
              className="object-contain rounded"
              priority
            />
            <span className={`font-bold text-lg transition-colors ${
              isScrolled ? 'text-burgundy-800' : 'text-white'
            }`}>
              {branding.brandName}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                onClick={(e) => scrollToSection(e, link.href)}
                className={`font-medium transition-colors hover:text-gold-500 ${
                  isScrolled ? 'text-gray-700' : 'text-white'
                }`}
              >
                {link.name}
              </a>
            ))}
            <Link
              href="/login"
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                isScrolled
                  ? 'hover:text-white'
                  : 'border-white text-white hover:bg-white hover:text-burgundy-800'
              }`}
              style={isScrolled ? { borderColor: branding.primaryColor, color: branding.primaryColor } : undefined}
            >
              Login
            </Link>
            <Link
              href="/register"
              className="px-6 py-2 font-bold rounded-lg transition-all hover:scale-105 hover:shadow-lg"
              style={{ backgroundColor: branding.accentColor, color: branding.primaryColor }}
            >
              Sign Up
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className={`md:hidden p-2 rounded-lg transition-colors ${
              isScrolled ? 'text-burgundy-800' : 'text-white'
            }`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu — CSS only (no exit animations) to avoid DOM errors on route change */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 py-4 bg-white rounded-lg shadow-xl animate-in fade-in duration-200">
            <div className="flex flex-col space-y-4 px-4">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => scrollToSection(e, link.href)}
                  className="text-gray-700 font-medium hover:text-gold-500 transition-colors py-2"
                >
                  {link.name}
                </a>
              ))}
              <Link
                href="/login"
                prefetch
                className="px-4 py-2 text-center border-2 rounded-lg hover:text-white transition-all"
                style={{ borderColor: branding.primaryColor, color: branding.primaryColor }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Login
              </Link>
              <Link
                href="/register"
                className="px-6 py-2 text-center font-bold rounded-lg transition-all hover:opacity-90"
                style={{ backgroundColor: branding.accentColor, color: branding.primaryColor }}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Sign Up
              </Link>
            </div>
          </div>
        )}
      </div>
    </motion.nav>
  );
}
