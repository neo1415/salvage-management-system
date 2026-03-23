'use client';

import { motion } from 'framer-motion';
import { Zap, Smartphone, Brain, Trophy } from 'lucide-react';

const valueProps = [
  {
    icon: Zap,
    title: 'Instant Payments',
    description: 'Get paid in minutes with Paystack. Secure card payments with automatic verification and instant escrow release.',
    color: 'from-yellow-400 to-orange-500',
  },
  {
    icon: Smartphone,
    title: 'Mobile PWA',
    description: 'Works offline, installs like an app. Optimized for Nigerian mobile networks with smart data compression.',
    color: 'from-blue-400 to-purple-500',
  },
  {
    icon: Brain,
    title: 'AI Assessment',
    description: 'Google Vision AI analyzes damage photos instantly. Get accurate salvage valuations in seconds, not days.',
    color: 'from-green-400 to-teal-500',
  },
  {
    icon: Trophy,
    title: 'Gamified Leaderboards',
    description: 'Compete for top vendor status. Earn badges, unlock perks, and build your reputation with every successful bid.',
    color: 'from-pink-400 to-red-500',
  },
];

export function ValuePropsSection() {
  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-96 h-96 bg-burgundy-500 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gold-500 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <motion.h2
            className="text-4xl md:text-6xl font-black mb-4 bg-gradient-to-r from-burgundy-900 via-burgundy-700 to-gold-600 bg-clip-text text-transparent"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Why Vendors Choose Us
          </motion.h2>
          <motion.p
            className="text-xl text-gray-600 max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Built for Nigerian vendors, powered by cutting-edge technology
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {valueProps.map((prop, index) => {
            const Icon = prop.icon;
            return (
              <motion.div
                key={index}
                className="group relative"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
              >
                {/* Glow effect */}
                <motion.div
                  className={`absolute inset-0 bg-gradient-to-r ${prop.color} rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300`}
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />

                {/* Card */}
                <motion.div
                  className="relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all cursor-pointer border border-gray-100"
                  whileHover={{ y: -8, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  {/* Icon */}
                  <motion.div
                    className={`w-16 h-16 mb-6 rounded-xl bg-gradient-to-r ${prop.color} flex items-center justify-center`}
                    whileHover={{ rotate: 5, scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                  >
                    <Icon className="w-8 h-8 text-white" />
                  </motion.div>

                  {/* Content */}
                  <h3 className="text-xl font-bold mb-3 text-burgundy-900 group-hover:text-burgundy-700 transition-colors">
                    {prop.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {prop.description}
                  </p>

                  {/* Hover indicator */}
                  <motion.div
                    className="mt-4 flex items-center text-burgundy-700 font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                    initial={{ x: -10 }}
                    whileHover={{ x: 0 }}
                  >
                    <span className="text-sm">Learn more</span>
                    <motion.span
                      className="ml-2"
                      animate={{ x: [0, 5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      →
                    </motion.span>
                  </motion.div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <motion.div
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <p className="text-gray-600 mb-6">
            Join hundreds of vendors already transforming their salvage business
          </p>
          <motion.button
            className="px-8 py-4 bg-gradient-to-r from-burgundy-800 to-burgundy-600 text-white font-bold rounded-lg shadow-lg"
            whileHover={{ scale: 1.05, boxShadow: '0 20px 40px rgba(128, 0, 32, 0.3)' }}
            whileTap={{ scale: 0.95 }}
          >
            Get Started Free →
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
