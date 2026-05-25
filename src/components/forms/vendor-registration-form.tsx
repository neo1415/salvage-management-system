'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { registrationSchema, type RegistrationInput } from '@/lib/utils/validation';
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface VendorRegistrationFormProps {
  onSubmit: (data: RegistrationInput) => Promise<void>;
}

/**
 * Password strength indicator component
 */
function PasswordStrengthIndicator({ password }: { password: string }) {
  const getStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: '', color: '' };
    
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    
    if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
    if (score <= 3) return { score, label: 'Fair', color: 'bg-yellow-500' };
    if (score <= 4) return { score, label: 'Good', color: 'bg-blue-500' };
    return { score, label: 'Strong', color: 'bg-green-500' };
  };

  const strength = getStrength(password);
  
  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors ${
              level <= strength.score ? strength.color : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${
        strength.score <= 2 ? 'text-red-600' : 
        strength.score <= 3 ? 'text-yellow-600' : 
        strength.score <= 4 ? 'text-blue-600' : 'text-green-600'
      }`}>
        Password strength: {strength.label}
      </p>
    </div>
  );
}

/**
 * Vendor Registration Form Component
 * Mobile-responsive registration form with React Hook Form + Zod validation
 */
export function VendorRegistrationForm({ onSubmit }: VendorRegistrationFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, touchedFields },
  } = useForm<z.input<typeof registrationSchema>>({
    resolver: zodResolver(registrationSchema),
    mode: 'onChange',
  });

  const password = watch('password', '');

  const handleFormSubmit = async (data: z.input<typeof registrationSchema>) => {
    setIsSubmitting(true);
    try {
      // The zodResolver will transform the data to output type
      await onSubmit(data as RegistrationInput);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldStatus = (fieldName: keyof z.input<typeof registrationSchema>) => {
    if (!touchedFields[fieldName]) return null;
    return errors[fieldName] ? 'error' : 'success';
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Registration Form */}
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              {...register('fullName')}
              type="text"
              id="fullName"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                errors.fullName
                  ? 'border-red-500 focus:ring-red-500'
                  : touchedFields.fullName
                  ? 'border-green-500 focus:ring-green-500'
                  : 'border-gray-300 focus:ring-[#800020]'
              }`}
              placeholder="Enter your full name"
            />
            {getFieldStatus('fullName') === 'success' && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
            )}
            {getFieldStatus('fullName') === 'error' && (
              <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
            )}
          </div>
          {errors.fullName && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.fullName.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email Address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              {...register('email')}
              type="email"
              id="email"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                errors.email
                  ? 'border-red-500 focus:ring-red-500'
                  : touchedFields.email
                  ? 'border-green-500 focus:ring-green-500'
                  : 'border-gray-300 focus:ring-[#800020]'
              }`}
              placeholder="your.email@example.com"
            />
            {getFieldStatus('email') === 'success' && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
            )}
            {getFieldStatus('email') === 'error' && (
              <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
            )}
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              {...register('phone')}
              type="tel"
              id="phone"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                errors.phone
                  ? 'border-red-500 focus:ring-red-500'
                  : touchedFields.phone
                  ? 'border-green-500 focus:ring-green-500'
                  : 'border-gray-300 focus:ring-[#800020]'
              }`}
              placeholder="+234 XXX XXX XXXX"
            />
            {getFieldStatus('phone') === 'success' && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
            )}
            {getFieldStatus('phone') === 'error' && (
              <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
            )}
          </div>
          {errors.phone && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.phone.message}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Format: +234XXXXXXXXXX or 0XXXXXXXXXX
          </p>
        </div>

        {/* Date of Birth */}
        <div>
          <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
            Date of Birth <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              {...register('dateOfBirth')}
              type="date"
              id="dateOfBirth"
              max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                errors.dateOfBirth
                  ? 'border-red-500 focus:ring-red-500'
                  : touchedFields.dateOfBirth
                  ? 'border-green-500 focus:ring-green-500'
                  : 'border-gray-300 focus:ring-[#800020]'
              }`}
            />
            {getFieldStatus('dateOfBirth') === 'success' && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
            )}
            {getFieldStatus('dateOfBirth') === 'error' && (
              <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
            )}
          </div>
          {errors.dateOfBirth && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.dateOfBirth.message}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            You must be at least 18 years old
          </p>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              id="password"
              className={`w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                errors.password
                  ? 'border-red-500 focus:ring-red-500'
                  : touchedFields.password
                  ? 'border-green-500 focus:ring-green-500'
                  : 'border-gray-300 focus:ring-[#800020]'
              }`}
              placeholder="Create a strong password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.password.message}
            </p>
          )}
          <PasswordStrengthIndicator password={password} />
          <ul className="mt-2 text-xs text-gray-600 space-y-1">
            <li className={password.length >= 8 ? 'text-green-600' : ''}>
              • At least 8 characters
            </li>
            <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
              • At least 1 uppercase letter
            </li>
            <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>
              • At least 1 number
            </li>
            <li className={/[^A-Za-z0-9]/.test(password) ? 'text-green-600' : ''}>
              • At least 1 special character
            </li>
          </ul>
        </div>

        {/* Terms and Conditions */}
        <div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              {...register('termsAccepted')}
              type="checkbox"
              className="mt-1 w-4 h-4 text-[#800020] border-gray-300 rounded focus:ring-[#800020]"
            />
            <span className="text-sm text-gray-700">
              I accept the{' '}
              <a href="/terms" className="text-[#800020] hover:underline">
                Terms and Conditions
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-[#800020] hover:underline">
                Privacy Policy
              </a>
              <span className="text-red-500"> *</span>
            </span>
          </label>
          {errors.termsAccepted && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.termsAccepted.message}
            </p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#FFD700] text-[#800020] font-bold py-3 px-4 rounded-lg hover:bg-[#FFC700] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Account...
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      {/* Login Link */}
      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <a href="/login" className="text-[#800020] font-medium hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
