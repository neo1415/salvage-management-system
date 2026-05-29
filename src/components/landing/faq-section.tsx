'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { usePublicBranding } from '@/hooks/use-public-branding';
import { usePublicBusinessPolicy } from '@/hooks/use-public-business-policy';

const faqs = [
  {
    question: 'How do I get started as a vendor?',
    answer:
      'Register with your email or phone number, then complete the configured verification steps for auction access. The required checks and bid limits depend on the active business rules.',
  },
  {
    question: 'What payment methods are accepted?',
    answer:
      'Accepted payment methods depend on the active business rules. Online checkout, wallet, bank transfer, or manual review flows may be enabled by the operations team.',
  },
  {
    question: 'What happens if I win an auction?',
    answer:
      'You will receive payment instructions after winning. Complete the required documents, then pay within the configured deadline. Once payment is verified, you will receive a pickup authorization code.',
  },
  {
    question: 'Can I use the platform offline?',
    answer:
      'Yes. The mobile app experience can keep key pages available after they load, and queued actions sync when connectivity returns.',
  },
  {
    question: 'What is the difference between verification levels?',
    answer:
      'Each verification level controls the checks required, bid limits, and access rules. Complete full verification when you need higher bidding access or business-level approval.',
  },
  {
    question: 'How secure is my identity information?',
    answer:
      'Sensitive identity values are encrypted and used only for verification. Full BVN, NIN, and document numbers are not shown in normal screens.',
  },
  {
    question: 'What if I miss the payment deadline?',
    answer:
      'If payment is not received within the configured deadline, the platform can move the auction into the configured reminder, fallback, forfeiture, or review process.',
  },
];

export function FAQSection() {
  const { branding } = usePublicBranding();
  const { policy } = usePublicBusinessPolicy();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const paymentDeadlineHours = policy?.payments.paymentDeadlineAfterSigningHours ?? 72;
  const tier1BidLimit = policy?.onboarding.tier1BidLimit ?? 500000;
  const tier1LimitText = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(tier1BidLimit);

  const policyAwareFaqs = faqs.map((faq) => {
    if (faq.question === 'How do I get started as a vendor?') {
      return {
        ...faq,
        answer: policy?.onboarding.requireTier2ForUnlimitedBidding
          ? `Register with your email or phone number, complete the configured identity checks for initial access up to ${tier1LimitText}, then complete business verification for higher bidding access.`
          : 'Register with your email or phone number and complete the configured verification steps for auction access.',
      };
    }

    if (faq.question === 'What happens if I win an auction?') {
      return {
        ...faq,
        answer: `You will receive payment instructions after winning. Complete the required documents, then pay within ${paymentDeadlineHours} hours. Once payment is verified, you will receive a pickup authorization code.`,
      };
    }

    if (faq.question === 'What if I miss the payment deadline?') {
      return {
        ...faq,
        answer: `If payment is not received within the configured ${paymentDeadlineHours}-hour window, the platform can move the auction into the configured reminder, fallback, forfeiture, or review process.`,
      };
    }

    return faq;
  });

  const filteredFaqs = policyAwareFaqs.filter(
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
          <h2 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-accent)] bg-clip-text text-transparent">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600">
            Everything you need to know about the platform
          </p>
        </motion.div>

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
              className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-[var(--brand-primary)] focus:outline-none transition-colors text-gray-700"
            />
          </div>
        </motion.div>

        <div className="space-y-4">
          {filteredFaqs.map((faq, index) => (
            <motion.div
              key={index}
              className="border-2 border-gray-200 rounded-xl overflow-hidden hover:border-[color-mix(in_srgb,var(--brand-primary)_35%,white)] transition-colors"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <button
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-bold text-lg text-[var(--brand-primary)] pr-4">
                  {faq.question}
                </span>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown className="w-6 h-6 text-[var(--brand-primary)]" />
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
              No FAQs found matching &quot;{searchQuery}&quot;
            </p>
          </motion.div>
        )}

        <motion.div
          className="mt-12 text-center bg-gradient-to-r from-[color-mix(in_srgb,var(--brand-primary)_8%,white)] to-[color-mix(in_srgb,var(--brand-accent)_10%,white)] p-8 rounded-2xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h3 className="text-2xl font-bold text-[var(--brand-primary)] mb-3">
            Still have questions?
          </h3>
          <p className="text-gray-600 mb-6">
            Our support team is here to help you get started
          </p>
          <motion.a
            href={`mailto:${branding.supportEmail}`}
            className="inline-block px-8 py-3 bg-[var(--brand-primary)] text-white font-bold rounded-lg"
            style={{ backgroundColor: branding.primaryColor }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Contact Support
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
