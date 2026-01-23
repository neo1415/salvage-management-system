'use client';

import { motion, useScroll, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import Link from 'next/link';

const messages = [
  'Start Free',
  'Join 500+ Vendors',
  'Get Started Now',
];

export function FloatingCTA() {
  const [isVisible, setIsVisible] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const { scrollYProgress } = useScroll();

  useEffect(() => {
    const handleScroll = () => {
      const scrollPercentage = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      setIsVisible(scrollPercentage > 30);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const pulseInterval = setInterval(() => {
      // Trigger pulse animation every 5 seconds
    }, 5000);

    return () => clearInterval(pulseInterval);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed bottom-8 right-8 z-40"
          initial={{ opacity: 0, y: 100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <Link href="/register">
            <motion.div
              className="relative"
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 3,
              }}
            >
              {/* Glow effect */}
              <motion.div
                className="absolute inset-0 bg-gold-500 rounded-full blur-xl opacity-50"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.7, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                }}
              />

              {/* Button */}
              <motion.button
                className="relative px-8 py-4 bg-gradient-to-r from-gold-500 to-gold-600 text-burgundy-900 font-bold rounded-full shadow-2xl flex items-center gap-3 group overflow-hidden"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
                  animate={{
                    x: ['-100%', '200%'],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 3,
                  }}
                />

                {/* Text with morphing animation */}
                <span className="relative z-10 text-lg min-w-[180px] text-center">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={messageIndex}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                      className="inline-block"
                    >
                      {messages[messageIndex]}
                    </motion.span>
                  </AnimatePresence>
                </span>

                {/* Arrow */}
                <motion.span
                  className="relative z-10 text-xl"
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  →
                </motion.span>
              </motion.button>

              {/* Progress bar */}
              <motion.div
                className="absolute -bottom-2 left-0 right-0 h-1 bg-white/30 rounded-full overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <motion.div
                  className="h-full bg-gradient-to-r from-burgundy-600 to-burgundy-800 rounded-full"
                  style={{ scaleX: scrollYProgress, transformOrigin: 'left' }}
                />
              </motion.div>
            </motion.div>
          </Link>

          {/* Tooltip */}
          <motion.div
            className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-burgundy-900 text-white px-4 py-2 rounded-lg text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            initial={{ opacity: 0, y: 10 }}
            whileHover={{ opacity: 1, y: 0 }}
          >
            Click to register
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-burgundy-900" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
