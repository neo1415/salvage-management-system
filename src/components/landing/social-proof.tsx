'use client';

import { motion, useInView, useMotionValue, useSpring } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { Star, Shield, Lock, CheckCircle } from 'lucide-react';

const testimonials = [
  {
    name: 'Chukwudi Okafor',
    role: 'Auto Parts Vendor',
    rating: 5,
    text: 'The instant payment feature changed my business. I used to wait weeks for bank transfers, now I get paid in minutes!',
    avatar: '👨🏿‍💼',
  },
  {
    name: 'Amina Bello',
    role: 'Electronics Dealer',
    rating: 5,
    text: 'AI assessment is incredibly accurate. I can bid confidently knowing the damage reports are reliable. Best platform for salvage!',
    avatar: '👩🏿‍💼',
  },
  {
    name: 'Emeka Nwosu',
    role: 'Machinery Trader',
    rating: 5,
    text: 'Mobile app works perfectly even with poor network. I can bid from anywhere. The leaderboard keeps me motivated!',
    avatar: '👨🏿‍🔧',
  },
];

const trustBadges = [
  { icon: Shield, text: 'Powered by NEM Insurance' },
  { icon: Lock, text: 'Secure BVN Verification' },
  { icon: CheckCircle, text: 'SSL Encrypted' },
];

export function SocialProofSection() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 6000); // Slower transition - 6 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-burgundy-500 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-gold-500 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Testimonials Carousel */}
        <motion.div
          className="mb-20 max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h3 className="text-3xl font-bold text-center mb-12 text-burgundy-900">
            What Vendors Say
          </h3>

          <div className="relative">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                className="bg-white p-8 md:p-12 rounded-2xl shadow-xl border border-gray-100"
                initial={false}
                animate={{
                  opacity: index === currentTestimonial ? 1 : 0,
                  scale: index === currentTestimonial ? 1 : 0.95,
                  zIndex: index === currentTestimonial ? 1 : 0,
                }}
                transition={{ 
                  duration: 0.7,
                  ease: 'easeInOut',
                }}
                style={{
                  position: index === currentTestimonial ? 'relative' : 'absolute',
                  top: index === currentTestimonial ? 0 : 0,
                  left: 0,
                  right: 0,
                  pointerEvents: index === currentTestimonial ? 'auto' : 'none',
                }}
              >
                <div className="flex items-start gap-6">
                  <div className="text-6xl flex-shrink-0">{testimonial.avatar}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1 mb-3">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-gold-500 text-gold-500" />
                      ))}
                    </div>
                    <p className="text-lg text-gray-700 mb-4 italic">"{testimonial.text}"</p>
                    <div>
                      <div className="font-bold text-burgundy-900">{testimonial.name}</div>
                      <div className="text-gray-600">{testimonial.role}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Carousel indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index === currentTestimonial
                      ? 'bg-burgundy-600 w-8'
                      : 'bg-gray-300'
                  }`}
                  onClick={() => setCurrentTestimonial(index)}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Trust Badges */}
        <motion.div
          className="flex flex-wrap justify-center gap-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          {trustBadges.map((badge, index) => {
            const Icon = badge.icon;
            return (
              <motion.div
                key={index}
                className="flex items-center gap-3 bg-white px-6 py-4 rounded-full shadow-lg border border-gray-100"
                whileHover={{ scale: 1.05, y: -5 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <Icon className="w-6 h-6 text-burgundy-600" />
                <span className="font-semibold text-gray-700">{badge.text}</span>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
