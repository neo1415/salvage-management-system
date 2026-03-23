'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { UserPlus, Search, Gavel, CreditCard, Package } from 'lucide-react';

const steps = [
  {
    number: 1,
    icon: UserPlus,
    title: 'Register & Verify',
    description: 'Sign up in minutes. Verify your BVN for Tier 1 access (up to ₦500k) or complete business verification for unlimited bidding.',
    image: '📝',
  },
  {
    number: 2,
    icon: Search,
    title: 'Browse Auctions',
    description: 'Explore live salvage auctions with AI-assessed damage reports, photos, and real-time bidding activity.',
    image: '🔍',
  },
  {
    number: 3,
    icon: Gavel,
    title: 'Place Bids',
    description: 'Bid with confidence using OTP verification. Watch real-time updates and auto-extensions when auctions heat up.',
    image: '⚡',
  },
  {
    number: 4,
    icon: CreditCard,
    title: 'Pay Instantly',
    description: 'Win an auction? Pay securely via Paystack within 24 hours. Funds held in escrow until pickup confirmation.',
    image: '💳',
  },
  {
    number: 5,
    icon: Package,
    title: 'Collect Salvage',
    description: 'Receive pickup authorization via SMS. Collect your salvage and build your vendor reputation with ratings.',
    image: '📦',
  },
];

export function HowItWorksSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const progressHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <section
      id="how-it-works"
      ref={containerRef}
      className="py-20 md:py-32 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden"
    >
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-burgundy-900 via-burgundy-700 to-gold-600 bg-clip-text text-transparent">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            From registration to salvage collection in 5 simple steps
          </p>
        </motion.div>

        <div className="relative max-w-5xl mx-auto">
          {/* Progress line */}
          <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-1 bg-gray-200 hidden md:block">
            <motion.div
              className="w-full bg-gradient-to-b from-burgundy-600 to-gold-500"
              style={{ height: progressHeight }}
            />
          </div>

          {/* Steps */}
          <div className="space-y-16">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isEven = index % 2 === 0;

              return (
                <motion.div
                  key={index}
                  className={`relative flex flex-col md:flex-row items-center gap-8 ${
                    isEven ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                  initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-100px' }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  {/* Content */}
                  <div className={`flex-1 ${isEven ? 'md:text-right' : 'md:text-left'}`}>
                    <motion.div
                      className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-shadow border border-gray-100"
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      <div className={`flex items-center gap-4 mb-4 ${isEven ? 'md:justify-end' : 'md:justify-start'}`}>
                        <motion.div
                          className="w-12 h-12 rounded-xl bg-gradient-to-r from-burgundy-600 to-burgundy-800 flex items-center justify-center"
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.6 }}
                        >
                          <Icon className="w-6 h-6 text-white" />
                        </motion.div>
                        <h3 className="text-2xl font-bold text-burgundy-900">{step.title}</h3>
                      </div>
                      <p className="text-gray-600 leading-relaxed">{step.description}</p>
                    </motion.div>
                  </div>

                  {/* Step number circle */}
                  <motion.div
                    className="relative z-10 flex-shrink-0"
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 + 0.3, type: 'spring', stiffness: 200 }}
                  >
                    <motion.div
                      className="w-20 h-20 rounded-full bg-gradient-to-br from-burgundy-600 to-burgundy-800 flex items-center justify-center shadow-xl border-4 border-white"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: 'spring', stiffness: 400 }}
                    >
                      <span className="text-3xl font-black text-white">{step.number}</span>
                    </motion.div>

                    {/* Pulse effect */}
                    <motion.div
                      className="absolute inset-0 rounded-full bg-burgundy-600"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.5, 0, 0.5],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: index * 0.2,
                      }}
                    />
                  </motion.div>

                  {/* Image/Icon */}
                  <div className={`flex-1 ${isEven ? 'md:text-left' : 'md:text-right'}`}>
                    <motion.div
                      className="text-8xl md:text-9xl"
                      initial={{ opacity: 0, scale: 0.5 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 + 0.2, type: 'spring' }}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                    >
                      {step.image}
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          className="text-center mt-20"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <p className="text-xl text-gray-600 mb-6">
            Ready to start your salvage journey?
          </p>
          <motion.button
            className="px-10 py-4 bg-gradient-to-r from-gold-500 to-gold-600 text-burgundy-900 font-bold rounded-lg shadow-xl text-lg"
            whileHover={{ scale: 1.05, boxShadow: '0 20px 40px rgba(255, 215, 0, 0.4)' }}
            whileTap={{ scale: 0.95 }}
          >
            Get Started Now →
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
