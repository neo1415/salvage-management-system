'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { Check } from 'lucide-react';

const features = [
  'Real-time auction updates',
  'AI-powered damage assessment',
  'Instant payment processing',
  'Mobile-optimized interface',
  'Offline mode support',
  'Push notifications',
];

export function ProductShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [-100, 100]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  return (
    <section ref={containerRef} className="py-20 md:py-32 bg-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-burgundy-50 to-gold-50 opacity-30" />

      <div className="container mx-auto px-4 relative z-10">
        {/* First Row - Text Left, Visual Right */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-32">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-black mb-6 text-burgundy-900">
              Powerful Dashboard
              <span className="block bg-gradient-to-r from-burgundy-700 to-gold-600 bg-clip-text text-transparent">
                At Your Fingertips
              </span>
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Monitor auctions, place bids, and manage payments from a single, intuitive interface designed for speed and efficiency.
            </p>

            <div className="space-y-4">
              {features.slice(0, 3).map((feature, index) => (
                <motion.div
                  key={index}
                  className="flex items-center space-x-3"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-burgundy-600 to-burgundy-800 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-gray-700 font-medium">{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="relative"
            style={{ y: y1, opacity }}
          >
            {/* 3D-like mockup using layered divs */}
            <div className="relative">
              {/* Main screen */}
              <motion.div
                className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl p-6 border-4 border-gray-700"
                whileHover={{ scale: 1.02, rotateY: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                {/* Screen content */}
                <div className="bg-white rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-3 w-24 bg-burgundy-600 rounded" />
                    <div className="h-3 w-16 bg-gold-500 rounded" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-20 bg-gradient-to-r from-burgundy-100 to-gold-100 rounded-lg" />
                    <div className="h-20 bg-gradient-to-r from-burgundy-100 to-gold-100 rounded-lg" />
                    <div className="h-20 bg-gradient-to-r from-burgundy-100 to-gold-100 rounded-lg" />
                  </div>
                </div>
                <div className="flex space-x-2">
                  <div className="h-2 w-2 bg-red-500 rounded-full" />
                  <div className="h-2 w-2 bg-yellow-500 rounded-full" />
                  <div className="h-2 w-2 bg-green-500 rounded-full" />
                </div>
              </motion.div>

              {/* Floating elements */}
              <motion.div
                className="absolute -top-6 -right-6 bg-gold-500 text-burgundy-900 px-4 py-2 rounded-lg shadow-lg font-bold"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Live Auction
              </motion.div>

              <motion.div
                className="absolute -bottom-6 -left-6 bg-burgundy-800 text-white px-4 py-2 rounded-lg shadow-lg font-bold"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                ₦2.5M Bid
              </motion.div>
            </div>
          </motion.div>
        </div>

        {/* Second Row - Visual Left, Text Right (Zigzag) */}
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            className="relative order-2 md:order-1"
            style={{ y: y2, opacity }}
          >
            {/* Mobile mockup */}
            <div className="relative max-w-sm mx-auto">
              <motion.div
                className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-[3rem] shadow-2xl p-4 border-8 border-gray-700"
                whileHover={{ scale: 1.05, rotateY: -5 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                {/* Notch */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-2xl" />

                {/* Screen */}
                <div className="bg-white rounded-[2.5rem] overflow-hidden">
                  <div className="p-4 space-y-3">
                    <div className="h-12 bg-gradient-to-r from-burgundy-600 to-burgundy-800 rounded-lg flex items-center justify-center text-white font-bold">
                      Salvage Auctions
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg" />
                      ))}
                    </div>
                    <div className="h-16 bg-gold-500 rounded-lg flex items-center justify-center text-burgundy-900 font-bold">
                      Place Bid
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Floating notification */}
              <motion.div
                className="absolute -top-4 -right-4 bg-white px-3 py-2 rounded-lg shadow-xl border border-gray-200"
                animate={{ scale: [1, 1.1, 1], rotate: [0, 5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs font-semibold">New Auction</span>
                </div>
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            className="order-1 md:order-2"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-black mb-6 text-burgundy-900">
              Mobile-First
              <span className="block bg-gradient-to-r from-burgundy-700 to-gold-600 bg-clip-text text-transparent">
                PWA Experience
              </span>
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Works seamlessly on any device. Install like a native app, works offline, and optimized for Nigerian mobile networks.
            </p>

            <div className="space-y-4">
              {features.slice(3).map((feature, index) => (
                <motion.div
                  key={index}
                  className="flex items-center space-x-3"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-gold-500 to-gold-600 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-burgundy-900" />
                  </div>
                  <span className="text-gray-700 font-medium">{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
