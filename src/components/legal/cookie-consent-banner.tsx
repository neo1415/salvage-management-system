'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Cookie, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
}

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always true, cannot be disabled
    functional: true,
    analytics: true,
  });

  useEffect(() => {
    // Check if user has already consented in this session
    const hasConsented = sessionStorage.getItem('cookie-consent');
    
    if (!hasConsented) {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    const consentData = {
      essential: true,
      functional: true,
      analytics: true,
      timestamp: new Date().toISOString(),
    };

    // Store consent in sessionStorage (only for this session)
    sessionStorage.setItem('cookie-consent', JSON.stringify(consentData));
    
    // Store in localStorage for persistent tracking (optional)
    localStorage.setItem('cookie-preferences', JSON.stringify(consentData));

    setIsVisible(false);
  };

  const handleRejectNonEssential = () => {
    const consentData = {
      essential: true,
      functional: false,
      analytics: false,
      timestamp: new Date().toISOString(),
    };

    sessionStorage.setItem('cookie-consent', JSON.stringify(consentData));
    localStorage.setItem('cookie-preferences', JSON.stringify(consentData));

    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    const consentData = {
      ...preferences,
      essential: true, // Always true
      timestamp: new Date().toISOString(),
    };

    sessionStorage.setItem('cookie-consent', JSON.stringify(consentData));
    localStorage.setItem('cookie-preferences', JSON.stringify(consentData));

    setIsVisible(false);
  };

  const handleClose = () => {
    // Treat close as "Accept All" for better UX
    handleAcceptAll();
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6"
      >
        <div className="container mx-auto max-w-6xl">
          <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
            {/* Main Banner */}
            {!showSettings ? (
              <div className="p-6 md:p-8">
                <div className="flex items-start gap-4">
                  {/* Cookie Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-burgundy-100 rounded-full flex items-center justify-center">
                      <Cookie className="w-6 h-6 text-burgundy-700" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      We Value Your Privacy
                    </h3>
                    <p className="text-gray-600 text-sm md:text-base mb-4">
                      We use cookies to enhance your experience, analyze site usage, and assist in our marketing efforts. 
                      By clicking "Accept All", you consent to our use of cookies. You can manage your preferences or learn 
                      more in our{' '}
                      <Link href="/cookies" className="text-burgundy-700 hover:text-burgundy-900 underline font-medium">
                        Cookie Policy
                      </Link>
                      {' '}and{' '}
                      <Link href="/privacy" className="text-burgundy-700 hover:text-burgundy-900 underline font-medium">
                        Privacy Policy
                      </Link>
                      .
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleAcceptAll}
                        className="px-6 py-2.5 bg-burgundy-700 hover:bg-burgundy-800 text-white font-semibold rounded-lg transition-colors"
                      >
                        Accept All
                      </button>
                      <button
                        onClick={handleRejectNonEssential}
                        className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
                      >
                        Reject Non-Essential
                      </button>
                      <button
                        onClick={() => setShowSettings(true)}
                        className="px-6 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg border border-gray-300 transition-colors flex items-center justify-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Customize
                      </button>
                    </div>
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={handleClose}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
            ) : (
              /* Settings Panel */
              <div className="p-6 md:p-8">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      Cookie Preferences
                    </h3>
                    <p className="text-sm text-gray-600">
                      Manage your cookie settings. Essential cookies cannot be disabled.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Back"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                {/* Cookie Categories */}
                <div className="space-y-4 mb-6">
                  {/* Essential Cookies */}
                  <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">Essential Cookies</h4>
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded">
                          Always Active
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Required for the platform to function. These cookies enable core functionality such as 
                        authentication, security, and session management.
                      </p>
                    </div>
                    <div className="ml-4">
                      <div className="w-12 h-6 bg-green-500 rounded-full flex items-center justify-end px-1">
                        <div className="w-4 h-4 bg-white rounded-full"></div>
                      </div>
                    </div>
                  </div>

                  {/* Functional Cookies */}
                  <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">Functional Cookies</h4>
                      <p className="text-sm text-gray-600">
                        Enable enhanced functionality and personalization, such as remembering your preferences 
                        and settings.
                      </p>
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={() => setPreferences(prev => ({ ...prev, functional: !prev.functional }))}
                        className={`w-12 h-6 rounded-full flex items-center transition-colors ${
                          preferences.functional 
                            ? 'bg-burgundy-600 justify-end' 
                            : 'bg-gray-300 justify-start'
                        } px-1`}
                        aria-label="Toggle functional cookies"
                      >
                        <div className="w-4 h-4 bg-white rounded-full"></div>
                      </button>
                    </div>
                  </div>

                  {/* Analytics Cookies */}
                  <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">Analytics Cookies</h4>
                      <p className="text-sm text-gray-600">
                        Help us understand how visitors interact with our platform by collecting and reporting 
                        information anonymously.
                      </p>
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={() => setPreferences(prev => ({ ...prev, analytics: !prev.analytics }))}
                        className={`w-12 h-6 rounded-full flex items-center transition-colors ${
                          preferences.analytics 
                            ? 'bg-burgundy-600 justify-end' 
                            : 'bg-gray-300 justify-start'
                        } px-1`}
                        aria-label="Toggle analytics cookies"
                      >
                        <div className="w-4 h-4 bg-white rounded-full"></div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleSavePreferences}
                    className="px-6 py-2.5 bg-burgundy-700 hover:bg-burgundy-800 text-white font-semibold rounded-lg transition-colors"
                  >
                    Save Preferences
                  </button>
                  <button
                    onClick={handleAcceptAll}
                    className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
                  >
                    Accept All
                  </button>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="px-6 py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-lg border border-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                {/* Learn More Link */}
                <div className="mt-4 text-center">
                  <Link 
                    href="/cookies" 
                    className="text-sm text-burgundy-700 hover:text-burgundy-900 underline"
                  >
                    Learn more about our cookie usage
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
