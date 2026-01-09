import React, { useRef, useState } from 'react';
import { Calendar, Star, TrendingUp, Target, GoalIcon } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useToast } from '../context/ToastContext';

const API_BASE = import.meta.env.VITE_API_BASE || (process.env.NODE_ENV);

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '768350337530-s519n4f75a1hisp0hqsmibfbibkj56pi.apps.googleusercontent.com';

// Inner component that uses the hook - must be inside GoogleOAuthProvider
const AuthContent = ({ isLoading, onLoginSuccess }) => {
  const { showToast, updateToast } = useToast();
  const toastIdRef = useRef(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const googleButtonRef = useRef(null);

  // Handle successful authentication with the backend
  const handleGoogleSuccess = async (credentialResponse) => {
    setIsAuthLoading(true);
    toastIdRef.current = showToast('Signing in with Google...', { type: 'loading' }).id;

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const response = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: credentialResponse.credential,
          timezone: timezone
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        updateToast(toastIdRef.current, {
          type: 'success',
          message: 'Signed in successfully!',
          duration: 2000
        });
        onLoginSuccess(data.user);
      } else {
        updateToast(toastIdRef.current, {
          type: 'error',
          message: data.message || 'Sign in failed',
          duration: 3000
        });
      }
    } catch (error) {
      console.error('Google login error:', error);
      updateToast(toastIdRef.current, {
        type: 'error',
        message: 'Sign in error: ' + error.message,
        duration: 4000
      });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleError = () => {
    showToast('Google sign-in failed', { type: 'error', duration: 3000 });
  };

  const triggerGoogleLogin = () => {
    if (googleButtonRef.current) {
      const button = googleButtonRef.current.querySelector('[role="button"]');
      if (button) {
        button.click();
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/4 w-72 h-72 bg-purple-500/5 rounded-full blur-3xl"></div>
      
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 w-full max-w-5xl flex justify-center">
        {/* Right side - Login card */}
        <div className="flex items-center justify-center">
          <div className="relative w-full max-w-sm group">
            {/* Glowing border effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-0 group-hover:opacity-20 transition-all duration-500"></div>
            
            {/* Main card */}
            <div className="relative bg-gradient-to-br from-gray-900/95 to-slate-900/95 backdrop-blur-2xl rounded-2xl p-8 border border-blue-500/20 shadow-2xl">


              {/* Header */}
              <div className="mb-10 text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-gradient-to-br from-blue-600/40 to-blue-700/30 rounded-xl ring-1 ring-blue-500/30">
                    <GoalIcon className="w-9 h-9 text-blue-400" />
                  </div>
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 bg-clip-text text-transparent mb-2">
                  Goal Tracker
                </h1>
                <p className="text-sm text-gray-400">Achieve your goals with confidence</p>
              </div>

              {/* Divider */}
              <div className="mb-8 flex items-center gap-3">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gray-700"></div>
                <span className="text-xs text-gray-500 tracking-widest">SIGN IN & LOG IN</span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gray-700"></div>
              </div>

              {/* Google Login Button */}
              <div className="mb-6">
                {/* Hidden Google Login component - used to get the credential */}
                <div ref={googleButtonRef} className="hidden">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    text="signin"
                    size="large"
                  />
                </div>
                
                {/* Custom styled button overlay */}
                <button
                  onClick={triggerGoogleLogin}
                  disabled={isLoading || isAuthLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg transition-all duration-300 flex items-center justify-center gap-3 group shadow-lg hover:shadow-xl hover:shadow-blue-500/20 relative z-10"
                >
                  {/* Google Icon SVG */}
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
                  </svg>
                  <span>{isLoading || isAuthLoading ? 'Signing in...' : 'Continue with Google'}</span>
                </button>
              </div>

              {/* Bottom text */}
              <div className="text-center text-[11px] text-gray-500 pt-4 border-t border-gray-800/50">
                <p>On Continuing You will accept our privacy policy and terms of service</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Outer component that provides the context
const Auth = ({ isLoading, onLoginSuccess }) => {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthContent isLoading={isLoading} onLoginSuccess={onLoginSuccess} />
    </GoogleOAuthProvider>
  );
};

export default Auth;
