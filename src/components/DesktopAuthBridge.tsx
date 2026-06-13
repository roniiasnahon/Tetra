import React, { useState, useEffect } from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, User } from 'firebase/auth';
import { CheckCircle2, Clipboard, ExternalLink } from 'lucide-react';

interface DesktopAuthBridgeProps {
  onSuccess?: () => void;
}

// Generate organic colored particle lines similar to the Google Antigravity style
const BACKGROUND_PARTICLES = Array.from({ length: 280 }).map((_, i) => {
  // Distribute particles in a spiral centered around (x: 75%, y: 45%)
  const angle = i * 0.11; 
  const distance = Math.pow(i / 280, 0.7) * 440 + 30; 
  const x = 72 + (Math.cos(angle) * distance) / 12;
  const y = 48 + (Math.sin(angle) * distance) / 12;
  const colors = ['#EA4335', '#4285F4', '#FBBC05', '#34A853', '#a855f7', '#ec4899'];
  const color = colors[i % colors.length];
  // Slanted angle for each particle
  const rotation = angle * (180 / Math.PI) + (i % 20) * 3;
  const length = 4 + (i % 5) * 2.5;
  const opacity = 0.2 + (i % 4) * 0.15;
  return { x, y, color, rotation, length, opacity };
});

export const DesktopAuthBridge: React.FC<DesktopAuthBridgeProps> = () => {
  const [status, setStatus] = useState<'idle' | 'auth_popup' | 'exchanging' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [customToken, setCustomToken] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Force sign out on mount so we can get the raw Google credential
  useEffect(() => {
    auth.signOut();
    document.title = "Authorize Cosmi";
  }, []);

  const handleSignIn = async () => {
    setStatus('auth_popup');
    try {
      const { GoogleAuthProvider } = await import('firebase/auth');
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      if (credential && credential.idToken) {
        setCustomToken(credential.idToken);
        setStatus('success');
        triggerDeepLink(credential.idToken);
      } else {
        throw new Error('Could not retrieve Google ID token from sign in result.');
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Verification failed.');
    }
  };

  const triggerDeepLink = (token: string) => {
    const deepLinkUrl = `cosmiwise://auth?googleIdToken=${encodeURIComponent(token)}`;
    window.location.href = deepLinkUrl;
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(customToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-white text-neutral-800 flex flex-col items-center justify-center p-8 font-sans relative selection:bg-neutral-100 overflow-hidden">
      
      {/* Decorative Starburst Confetti Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0 hidden md:block">
        {BACKGROUND_PARTICLES.map((p, idx) => (
          <div
            key={idx}
            className="absolute rounded"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: '2px',
              height: `${p.length}px`,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: `translate(-50%, -50%) rotate(${p.rotation}deg)`,
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-3xl flex flex-col items-center text-center space-y-10 z-10">
        
        {/* Actual Google Logo & Minimal Brand Lockup */}
        <div className="flex items-center gap-3 select-none">
          {/* Actual Google Logo svg */}
          <svg viewBox="0 0 24 24" className="w-[32px] h-[32px] shrink-0" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
          </svg>
          <span className="text-[28px] md:text-[32px] tracking-tight text-neutral-900 font-sans font-normal leading-none flex items-center">
            <span className="font-semibold text-neutral-900">Google</span>
            <span className="text-neutral-500 font-light ml-1.5">Cosmi</span>
          </span>
        </div>

        {/* Dynamic State Views */}
        {status === 'idle' && !currentUser && (
          <div className="flex flex-col items-center w-full space-y-8 animate-fade-in">
            <div className="space-y-4 max-w-xl">
              <h1 className="text-3xl md:text-[52px] font-sans font-medium tracking-tight text-neutral-900 leading-tight">
                Authorize Cosmi
              </h1>
              <p className="text-sm md:text-base text-neutral-500 max-w-md mx-auto leading-relaxed">
                Link your Google account to authorize access for the Cosmi Desktop companion application.
              </p>
            </div>

            <button
              onClick={handleSignIn}
              id="btn-desktop-signin"
              className="px-6 py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white transition-all font-semibold rounded-full text-sm flex items-center justify-center gap-3 cursor-pointer shadow-sm active:scale-[0.98] select-none"
            >
              <div className="w-[18px] h-[18px] bg-white rounded-full flex items-center justify-center p-[2px] shrink-0">
                <svg viewBox="0 0 24 24" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
              </div>
              <span>Sign in with Google</span>
            </button>
          </div>
        )}

        {(status === 'auth_popup' || status === 'exchanging') && (
          <div className="flex flex-col items-center space-y-4 py-12 animate-fade-in">
            <div className="w-8 h-8 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
            <p className="text-sm text-neutral-500 font-medium">
              {status === 'auth_popup' ? 'Waiting for Google authentication...' : 'Registering desktop credentials...'}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center w-full space-y-8 animate-fade-in">
            <div className="space-y-4">
              <h1 className="text-3xl md:text-[52px] font-sans font-medium tracking-tight text-neutral-900 leading-tight">
                You have successfully authenticated.
              </h1>
              <p className="text-sm md:text-base text-neutral-500 max-w-md mx-auto leading-relaxed">
                You should be redirected back to the product.{' '}
                <button 
                  onClick={() => triggerDeepLink(customToken)} 
                  className="text-[#4285F4] hover:text-blue-500 underline cursor-pointer bg-transparent border-0 p-0 font-medium ml-0.5"
                >
                  Click here
                </button>{' '}
                if not working.
              </p>
            </div>

            {/* Subtle Controls Below */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 justify-center w-full max-w-md">
              <button
                onClick={() => triggerDeepLink(customToken)}
                className="px-5 py-3 bg-neutral-900 hover:bg-neutral-800 text-white transition-all text-xs font-semibold rounded-full flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Relaunch Desktop client
              </button>

              <button
                onClick={handleCopyToken}
                className="px-5 py-3 bg-transparent text-neutral-400 hover:text-neutral-600 transition-colors text-xs font-semibold rounded-full flex items-center justify-center gap-2 cursor-pointer border-0 active:scale-[0.98]"
              >
                <Clipboard className="w-4 h-4" />
                {copied ? 'Copied Security Token!' : 'Copy Code (Fallback)'}
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center w-full space-y-8 animate-fade-in">
            <div className="space-y-3">
              <h1 className="text-3xl font-sans font-medium tracking-tight text-red-500">
                Connection Failure
              </h1>
              <p className="text-sm text-neutral-500 max-w-sm mx-auto">
                {errorMessage || 'An error occurred during verification.'}
              </p>
            </div>
            
            <button
              onClick={handleSignIn}
              className="px-6 py-3 bg-neutral-950 hover:bg-neutral-800 text-white rounded-full text-xs font-semibold transition-all cursor-pointer active:scale-[0.98]"
            >
              Retry Authenticating
            </button>
          </div>
        )}
      </div>

      {/* Docs | Twitter Footer */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 text-xs font-normal text-neutral-400 z-10 select-none">
        <a href="#docs" className="hover:text-neutral-600 transition-colors">Docs</a>
        <span className="text-neutral-200">|</span>
        <a href="#twitter" className="hover:text-neutral-600 transition-colors">Twitter</a>
      </div>
    </div>
  );
};
