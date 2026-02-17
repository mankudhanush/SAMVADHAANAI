import React, { useEffect, useRef, useCallback, useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scale, Shield, AlertCircle } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import axios from 'axios';

const GOOGLE_CLIENT_ID = '131659209326-53p3k0qn5p89q7bkvhe70om2uvf3nqd7.apps.googleusercontent.com';

/* ═══════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ═══════════════════════════════════════════════════════════ */
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
};

/* ═══════════════════════════════════════════════════════════
   ORNAMENTAL COMPONENTS
   ═══════════════════════════════════════════════════════════ */
const CornerOrnament = memo(({ position }) => {
  const positionClasses = {
    'top-left': 'top-0 left-0 border-t-2 border-l-2',
    'top-right': 'top-0 right-0 border-t-2 border-r-2',
    'bottom-left': 'bottom-0 left-0 border-b-2 border-l-2',
    'bottom-right': 'bottom-0 right-0 border-b-2 border-r-2',
  };
  return (
    <div
      className={`absolute w-12 h-12 sm:w-20 sm:h-20 ${positionClasses[position]} border-gold-400/30 pointer-events-none`}
    >
      <div className={`absolute w-6 h-6 sm:w-10 sm:h-10 ${positionClasses[position]} border-gold-500/20 m-2`} />
    </div>
  );
});
CornerOrnament.displayName = 'CornerOrnament';

/* ═══════════════════════════════════════════════════════════
   LOGIN PAGE
   ═══════════════════════════════════════════════════════════ */
function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();
  const googleBtnRef = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const initializedRef = useRef(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleCredentialResponse = useCallback(
    async (response) => {
      setError('');
      setLoading(true);
      try {
        const res = await axios.post('/api/auth/google', {
          credential: response.credential,
        });
        login(res.data);
        navigate('/', { replace: true });
      } catch (err) {
        const msg =
          err.response?.data?.detail || 'Authentication failed. Please try again.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [login, navigate]
  );

  useEffect(() => {
    if (initializedRef.current) return;

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return;
      initializedRef.current = true;

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        });
      }
    };

    // If GSI script already loaded
    if (window.google?.accounts?.id) {
      initGoogle();
      return;
    }

    // Load GSI script dynamically
    const existingScript = document.querySelector(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.head.appendChild(script);
    } else {
      existingScript.addEventListener('load', initGoogle);
      // In case it's already loaded
      if (window.google?.accounts?.id) initGoogle();
    }
  }, [handleCredentialResponse]);

  return (
    <div className="min-h-screen bg-parchment-200 text-ink-500 font-body selection:bg-gold-400/20 relative overflow-hidden flex flex-col items-center justify-center px-6">
      {/* Corner Ornaments */}
      <CornerOrnament position="top-left" />
      <CornerOrnament position="top-right" />
      <CornerOrnament position="bottom-left" />
      <CornerOrnament position="bottom-right" />

      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23B8960B' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Top decorative line */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        className="absolute top-8 left-1/2 -translate-x-1/2 w-32 sm:w-48 h-px bg-gradient-to-r from-transparent via-gold-500 to-transparent"
      />

      {/* Login Card */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={scaleIn}
        className="relative w-full max-w-md"
      >
        {/* Card frame */}
        <div className="manuscript-frame rounded-sm p-8 sm:p-12">
          {/* Emblem */}
          <motion.div variants={fadeIn} className="flex justify-center mb-8">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-sm border-2 border-gold-400/60 bg-gradient-to-br from-maroon-500 to-maroon-600 flex items-center justify-center shadow-lg">
              <Scale className="w-10 h-10 sm:w-12 sm:h-12 text-gold-100" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.div variants={fadeIn} className="text-center mb-2">
            <h1 className="font-display text-[2rem] sm:text-[2.5rem] font-bold text-ink-500 tracking-tight leading-none">
              SAMVIDHAAN
            </h1>
            <span className="block text-gold-600 font-display text-[1.5rem] sm:text-[2rem] font-bold tracking-tight">
              AI
            </span>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            variants={fadeIn}
            className="font-accent text-[0.875rem] sm:text-[1rem] text-ink-300 tracking-[0.15em] uppercase text-center mb-8"
          >
            Constitutional Document Intelligence
          </motion.p>

          {/* Decorative divider */}
          <div className="relative my-6">
            <div className="h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-parchment-50 px-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 rotate-45 bg-gold-500/60" />
                <Shield className="w-4 h-4 text-gold-500/60" />
                <div className="w-1 h-1 rotate-45 bg-gold-500/60" />
              </div>
            </div>
          </div>

          {/* Sign in prompt */}
          <motion.p
            variants={fadeIn}
            className="font-body text-[1rem] text-ink-300 text-center mb-8 leading-relaxed"
          >
            Sign in with your Google account to access the legal intelligence chamber
          </motion.p>

          {/* Google Sign-In Button */}
          <motion.div variants={fadeIn} className="flex justify-center mb-6">
            <div ref={googleBtnRef} className="min-h-[44px]" />
          </motion.div>

          {/* Loading state */}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-3 mb-4"
            >
              <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
              <span className="font-accent text-[0.875rem] tracking-wider text-ink-300">
                Verifying credentials…
              </span>
            </motion.div>
          )}

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-3 text-[0.9rem] text-maroon-500 bg-maroon-50/60 border border-maroon-200/50 rounded-sm px-4 py-3 mb-4"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-body">{error}</span>
            </motion.div>
          )}

          {/* Footer divider */}
          <div className="relative mt-8">
            <div className="h-px bg-gradient-to-r from-transparent via-gold-400/40 to-transparent" />
          </div>

          {/* Footer text */}
          <p className="font-accent text-[0.75rem] tracking-[0.15em] uppercase text-ink-200 text-center mt-6">
            Secure authentication powered by Google
          </p>
        </div>
      </motion.div>

      {/* Bottom decorative line */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.2, delay: 0.3, ease: 'easeOut' }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-32 sm:w-48 h-px bg-gradient-to-r from-transparent via-gold-500 to-transparent"
      />
    </div>
  );
}

export default LoginPage;
