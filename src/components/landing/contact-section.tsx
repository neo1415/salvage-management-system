'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Phone, Mail, MapPin, Send } from 'lucide-react';
import { getBrandGradient, usePublicBranding } from '@/hooks/use-public-branding';

export function ContactSection() {
  const { branding } = usePublicBranding();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const contactInfo = [
    {
      icon: Phone,
      label: 'Phone',
      value: branding.supportPhone || 'Configured after enterprise setup',
      href: branding.supportPhone ? `tel:${branding.supportPhone}` : `mailto:${branding.supportEmail}`,
    },
    {
      icon: Mail,
      label: 'Email',
      value: branding.supportEmail,
      href: `mailto:${branding.supportEmail}`,
    },
    {
      icon: MapPin,
      label: 'Address',
      value: `${branding.legalName} service operations`,
      href: '#contact',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setStatus('success');
        setFormData({ name: '', email: '', phone: '', message: '' });
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Contact form error:', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <section id="contact" className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2
            className="mb-4 bg-clip-text text-4xl font-black text-transparent md:text-5xl"
            style={{ backgroundImage: getBrandGradient(branding) }}
          >
            {branding.homepageCopy.contactHeadline || 'Get in touch'}
          </h2>
          <p className="text-xl text-gray-600">
            {branding.homepageCopy.contactSubtitle || "Have questions? We'd love to hear from you."}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Contact Info & Map */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Contact Info Cards */}
            <div className="space-y-6 mb-8">
              {contactInfo.map((info, index) => {
                const Icon = info.icon;
                return (
                  <motion.a
                    key={index}
                    href={info.href}
                    target={info.icon === MapPin ? '_blank' : undefined}
                    rel={info.icon === MapPin ? 'noopener noreferrer' : undefined}
                    className="flex items-start gap-4 p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border border-gray-100 group"
                    whileHover={{ scale: 1.02, x: 5 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform" style={{ background: getBrandGradient(branding) }}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">{info.label}</div>
                      <div className="font-semibold transition-colors" style={{ color: branding.primaryColor }}>
                        {info.value}
                      </div>
                    </div>
                  </motion.a>
                );
              })}
            </div>

            {/* Brand-safe operations summary */}
            <motion.div
              className="rounded-xl overflow-hidden shadow-xl border border-gray-100 bg-white p-6"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Service operations</p>
              <h3 className="mt-3 text-2xl font-bold text-gray-900">{branding.legalName}</h3>
              <p className="mt-3 text-sm leading-7 text-gray-600">
                Reach our team for help with registration, auctions, payments, documents, or account access.
              </p>
              <div className="mt-5 rounded-lg p-4 text-sm text-white" style={{ background: getBrandGradient(branding) }}>
                <p className="font-semibold">{branding.supportEmail}</p>
                <p className="mt-1 opacity-85">{branding.supportPhone || 'Support phone not added yet'}</p>
              </div>
            </motion.div>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
              <div className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-3 transition-colors focus:border-[var(--brand-primary)] focus:outline-none"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-3 transition-colors focus:border-[var(--brand-primary)] focus:outline-none"
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-3 transition-colors focus:border-[var(--brand-primary)] focus:outline-none"
                    placeholder="+234 800 000 0000"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    className="w-full resize-none rounded-lg border-2 border-gray-200 px-4 py-3 transition-colors focus:border-[var(--brand-primary)] focus:outline-none"
                    placeholder="Tell us how we can help..."
                  />
                </div>

                <motion.button
                  type="submit"
                  disabled={status === 'loading'}
                  className={`w-full py-4 rounded-lg font-bold text-white flex items-center justify-center gap-2 ${
                    status === 'loading'
                      ? 'bg-gray-400 cursor-not-allowed'
                      : status === 'success'
                      ? 'bg-green-600'
                      : ''
                  }`}
                  style={status === 'idle' || status === 'error' ? { background: getBrandGradient(branding) } : undefined}
                  whileHover={status === 'idle' ? { scale: 1.02 } : {}}
                  whileTap={status === 'idle' ? { scale: 0.98 } : {}}
                >
                  {status === 'loading' && 'Sending...'}
                  {status === 'success' && 'Message sent'}
                  {status === 'idle' && (
                    <>
                      Send Message
                      <Send className="w-5 h-5" />
                    </>
                  )}
                  {status === 'error' && 'Try Again'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
