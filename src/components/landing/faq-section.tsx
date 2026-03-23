'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

const faqs = [
  {
    question: 'How do I get started as a vendor?',
    answer: 'Simply register with your email or phone number, verify your identity with BVN for Tier 1 access (up to ₦500k auctions), or complete business verification for Tier 2 (unlimited access). The entire process takes less than 10 minutes.',
  },
  {
    question: 'What payment methods are accepted?',
    answer: 'We accept card payments via Paystack (Visa, Mastercard, Verve) and bank transfers. Card payments are verified instantly, while bank transfers require manual verification by our finance team within 2-4 hours.',
  },
  {
    question: 'How does the AI damage assessment work?',
    answer: 'Our AI uses Google Vision technology to analyze photos of damaged vehicles or assets. It identifies damage patterns, calculates severity percentages, and estimates salvage values based on market data. The AI assessment is provided as a guide - you should always inspect items before bidding.',
  },
  {
    question: 'What happens if I win an auction?',
    answer: 'You\'ll receive an SMS and email notification with payment instructions. You have 24 hours to pay via Paystack or bank transfer. Once payment is verified, you\'ll receive a pickup authorization code. Collect the salvage within the specified timeframe.',
  },
  {
    question: 'Can I use the platform offline?',
    answer: 'Yes! Our Progressive Web App (PWA) works offline. You can browse previously loaded auctions, save cases as drafts, and the app will sync automatically when you\'re back online. Perfect for areas with poor network coverage.',
  },
  {
    question: 'What is the difference between Tier 1 and Tier 2?',
    answer: 'Tier 1 requires only BVN verification and allows bidding on auctions up to ₦500,000. Tier 2 requires business verification (CAC, bank account, NIN) and allows unlimited bidding, priority support, and leaderboard participation.',
  },
  {
    question: 'How secure is my BVN information?',
    answer: 'Your BVN is encrypted using AES-256 encryption and stored securely. We only use it for identity verification through licensed financial institutions. Only the last 4 digits are ever displayed in the system. We comply with NDPR (Nigeria Data Protection Regulation).',
  },
  {
    question: 'What if I miss the payment deadline?',
    answer: 'If payment isn\'t received within 24 hours, you\'ll receive a reminder. After 48 hours, the auction is forfeited and re-listed. Your account may be suspended for 7 days. We recommend setting up payment immediately after winning.',
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section className="py-20 md:py-32 bg-white relative overflow-hidden">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-burgundy-900 to-gold-600 bg-clip-text text-transparent">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600">
            Everything you need to know about the platform
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-burgundy-600 focus:outline-none transition-colors text-gray-700"
            />
          </div>
        </motion.div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {filteredFaqs.map((faq, index) => (
            <motion.div
              key={index}
              className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-burgundy-300 transition-colors"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <button
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-bold text-lg text-burgundy-900 pr-4">
                  {faq.question}
                </span>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown className="w-6 h-6 text-burgundy-600" />
                </motion.div>
              </button>

              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-5 text-gray-600 leading-relaxed">
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>

        {filteredFaqs.length === 0 && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-gray-500 text-lg">
              No FAQs found matching "{searchQuery}"
            </p>
          </motion.div>
        )}

        {/* Still have questions? */}
        <motion.div
          className="mt-12 text-center bg-gradient-to-r from-burgundy-50 to-gold-50 p-8 rounded-2xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h3 className="text-2xl font-bold text-burgundy-900 mb-3">
            Still have questions?
          </h3>
          <p className="text-gray-600 mb-6">
            Our support team is here to help you get started
          </p>
          <motion.button
            className="px-8 py-3 bg-burgundy-800 text-white font-bold rounded-lg"
            whileHover={{ scale: 1.05, backgroundColor: '#6b0019' }}
            whileTap={{ scale: 0.95 }}
          >
            Contact Support
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
