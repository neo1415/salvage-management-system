'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';

const heroSlides = [
  {
    title: 'Streamline Salvage Recovery',
    subtitle: '10x faster processing with AI-powered damage assessment',
    image: '/assets/hero-1.png',
  },
  {
    title: 'Win Quality Salvages Instantly',
    subtitle: 'Access exclusive auctions and secure the best deals in real-time',
    image: '/assets/hero-2.png',
  },
  {
    title: 'Nigeria\'s Most Trusted Platform',
    subtitle: 'Join 500+ vendors transforming their salvage business',
    image: '/assets/Hero-3.png',
  },
];

export function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000); // 6 seconds per slide

    return () => clearInterval(interval);
  }, []);

  return (
    <section id="home" className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-burgundy-900 via-burgundy-800 to-burgundy-700 pt-20">
      {/* Background shapes */}
      <motion.div
        className="absolute top-20 right-20 w-96 h-96 bg-gold-500 rounded-full blur-3xl opacity-20"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute bottom-20 left-20 w-80 h-80 bg-burgundy-500 blur-3xl opacity-20"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />

      {/* Content */}
      <div className="container mx-auto px-4 z-10 relative py-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
                className="mb-6"
              >
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-4 bg-gradient-to-r from-white via-gold-200 to-gold-400 bg-clip-text text-transparent">
                  {heroSlides[currentSlide].title}
                </h1>
                <p className="text-lg md:text-xl text-gray-200 max-w-xl">
                  {heroSlides[currentSlide].subtitle}
                </p>
              </motion.div>
            </AnimatePresence>

            <motion.p
              className="text-base md:text-lg text-gray-300 mb-8 max-w-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              Instant payments • Real-time bidding • Mobile-first platform
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-4 mb-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <Link href="/register">
                <motion.button
                  className="w-full sm:w-auto px-8 py-4 bg-gold-500 text-burgundy-900 font-bold rounded-lg shadow-xl text-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  Start Bidding →
                </motion.button>
              </Link>

              {/* Watch Demo button - commented out */}
              {/* <motion.button
                className="w-full sm:w-auto px-8 py-4 border-2 border-white text-white font-bold rounded-lg text-lg backdrop-blur-sm"
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                Watch Demo ▶
              </motion.button> */}
            </motion.div>

            {/* Stats */}
            <motion.div
              className="grid grid-cols-3 gap-4 md:gap-8 max-w-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              <div className="text-center">
                <div className="text-2xl md:text-4xl font-bold text-gold-400 mb-1">₦10M+</div>
                <div className="text-xs md:text-sm text-gray-300">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-4xl font-bold text-gold-400 mb-1">500+</div>
                <div className="text-xs md:text-sm text-gray-300">Active Vendors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-4xl font-bold text-gold-400 mb-1">35-45%</div>
                <div className="text-xs md:text-sm text-gray-300">Recovery Rate</div>
              </div>
            </motion.div>

            {/* Slide Indicators */}
            <div className="flex gap-2 mt-8">
              {heroSlides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    index === currentSlide
                      ? 'w-8 bg-gold-500'
                      : 'w-4 bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </motion.div>

          {/* Right: Hero Images */}
          <motion.div
            className="relative hidden lg:block"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="relative h-[500px] w-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, scale: 0.9, x: 100 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: -100 }}
                  transition={{ duration: 0.8, ease: 'easeInOut' }}
                  className="absolute inset-0"
                >
                  <div className="relative h-full w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-white/10">
                    <Image
                      src={heroSlides[currentSlide].image}
                      alt={heroSlides[currentSlide].title}
                      fill
                      className="object-cover"
                      priority={currentSlide === 0}
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-burgundy-900/20 to-transparent" />
                  </div>

                  {/* Floating badge */}
                  <motion.div
                    className="absolute -bottom-6 -left-6 bg-gold-500 text-burgundy-900 px-6 py-3 rounded-xl shadow-xl font-bold text-lg"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    {currentSlide === 0 && '⚡ AI-Powered'}
                    {currentSlide === 1 && '🎯 Real-Time'}
                    {currentSlide === 2 && '🏆 Trusted'}
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Mobile: Hero Images (Below text) */}
          <motion.div
            className="relative lg:hidden"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div className="relative h-[300px] w-full">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.8, ease: 'easeInOut' }}
                  className="absolute inset-0"
                >
                  <div className="relative h-full w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-white/10">
                    <Image
                      src={heroSlides[currentSlide].image}
                      alt={heroSlides[currentSlide].title}
                      fill
                      className="object-cover"
                      priority={currentSlide === 0}
                      sizes="100vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-burgundy-900/20 to-transparent" />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator - REMOVED */}
    </section>
  );
}
