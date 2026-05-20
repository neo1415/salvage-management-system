'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

const MIN_VISIBLE_MS = 3000;
const MAX_VISIBLE_MS = 5000;

function getSplashDurationMs(): number {
  if (typeof navigator === 'undefined') return MIN_VISIBLE_MS;

  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } })
    .connection;
  const slow =
    connection?.effectiveType === 'slow-2g' ||
    connection?.effectiveType === '2g' ||
    connection?.effectiveType === '3g';

  return slow ? MAX_VISIBLE_MS : MIN_VISIBLE_MS;
}

function shouldShowPwaSplash(): boolean {
  if (typeof window === 'undefined') return false;

  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;

  return sessionStorage.getItem('salvage-show-splash') === '1';
}

export function PwaSplashScreen() {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!shouldShowPwaSplash()) {
      setReady(true);
      return;
    }

    setVisible(true);
    const targetMs = getSplashDurationMs();
    const startedAt = Date.now();

    const finish = () => {
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, targetMs - elapsed);
      window.setTimeout(() => {
        setVisible(false);
        setReady(true);
      }, wait);
    };

    if (document.readyState === 'complete') {
      finish();
    } else {
      window.addEventListener('load', finish, { once: true });
      window.setTimeout(finish, MAX_VISIBLE_MS);
    }

    return () => window.removeEventListener('load', finish);
  }, []);

  if (ready && !visible) {
    return null;
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#800020] via-[#6b001a] to-[#4a0012]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          aria-hidden={!visible}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#FFD700]/10 blur-3xl"
              animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-white/5 blur-2xl"
              animate={{ x: [0, -12, 0], y: [0, 8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <motion.div
            className="relative flex flex-col items-center px-8"
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              className="relative mb-8 rounded-2xl bg-white p-4 shadow-2xl shadow-black/25"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Image
                src="/icons/Nem-insurance-Logo.jpg"
                alt="NEM Insurance"
                width={120}
                height={120}
                priority
                className="h-24 w-24 object-contain"
              />
              <motion.div
                className="absolute -inset-1 rounded-2xl ring-2 ring-[#FFD700]/40"
                animate={{ opacity: [0.3, 0.85, 0.3] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              />
            </motion.div>

            <motion.h1
              className="font-display text-center text-3xl font-semibold tracking-wide text-white sm:text-4xl"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5 }}
            >
              NEM Salvage
            </motion.h1>

            <motion.p
              className="mt-3 text-center text-sm font-medium tracking-[0.2em] text-white/75 uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.5 }}
            >
              Salvage auctions
            </motion.p>

            <motion.div
              className="mt-10 flex gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-2 w-2 rounded-full bg-[#FFD700]"
                  animate={{ opacity: [0.35, 1, 0.35], scale: [0.85, 1.1, 0.85] }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    delay: i * 0.15,
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
