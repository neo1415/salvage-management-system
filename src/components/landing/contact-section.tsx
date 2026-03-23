'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Phone, Mail, MapPin, Send } from 'lucide-react';

const contactInfo = [
  {
    icon: Phone,
    label: 'Phone',
    value: '234-02-014489560',
    href: 'tel:+23402014489560',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'nemsupport@nem-insurance.com',
    href: 'mailto:nemsupport@nem-insurance.com',
  },
  {
    icon: MapPin,
    label: 'Address',
    value: 'NEM Insurance Plc, 199 Ikorodu Road, Obanikoro, Lagos',
    href: 'https://maps.google.com/?q=NEM+Insurance+Plc+199+Ikorodu+Road+Obanikoro+Lagos',
  },
];

export function ContactSection() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    // Simulate form submission
    setTimeout(() => {
      setStatus('success');
      setFormData({ name: '', email: '', phone: '', message: '' });
      setTimeout(() => setStatus('idle'), 3000);
    }, 1500);
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
          <h2 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-burgundy-900 to-gold-600 bg-clip-text text-transparent">
            Get In Touch
          </h2>
          <p className="text-xl text-gray-600">
            Have questions? We'd love to hear from you
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
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-burgundy-600 to-burgundy-800 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">{info.label}</div>
                      <div className="font-semibold text-burgundy-900 group-hover:text-burgundy-700 transition-colors">
                        {info.value}
                      </div>
                    </div>
                  </motion.a>
                );
              })}
            </div>

            {/* Embedded Map */}
            <motion.div
              className="rounded-xl overflow-hidden shadow-xl border-4 border-white"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3963.952912260219!2d3.3792!3d6.5244!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNsKwMzEnMjcuOCJOIDPCsDIyJzQ1LjEiRQ!5e0!3m2!1sen!2sng!4v1234567890"
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="NEM Insurance Location"
              />
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
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-burgundy-600 focus:outline-none transition-colors"
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
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-burgundy-600 focus:outline-none transition-colors"
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
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-burgundy-600 focus:outline-none transition-colors"
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
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-burgundy-600 focus:outline-none transition-colors resize-none"
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
                      : 'bg-gradient-to-r from-burgundy-800 to-burgundy-600'
                  }`}
                  whileHover={status === 'idle' ? { scale: 1.02 } : {}}
                  whileTap={status === 'idle' ? { scale: 0.98 } : {}}
                >
                  {status === 'loading' && 'Sending...'}
                  {status === 'success' && '✓ Message Sent!'}
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
