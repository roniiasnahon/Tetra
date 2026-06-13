import React, { useState, useEffect } from 'react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, User } from 'firebase/auth';
import { Chrome, Laptop, ArrowRight, CheckCircle2, Clipboard, ExternalLink } from 'lucide-react';

interface DesktopAuthBridgeProps {
  onSuccess?: () => void;
}

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
    <div className="min-h-screen bg-[#070707] text-[#e4e4e7] flex flex-col items-center justify-center p-8 font-sans relative selection:bg-[#262626]">
      <div className="absolute top-0 inset-x-0 h-8 z-[100] [-webkit-app-region:drag]" />
      
      <div className="w-full max-w-2xl flex flex-col items-center text-center space-y-8 [-webkit-app-region:no-drag]">
        {/* Brand Lockup */}
        <div className="flex items-center gap-3">
          <img src="/cosmi.png" alt="Cosmi" className="w-[30px] h-[30px] object-contain select-none" />
          <div className="h-4 w-[1px] bg-zinc-800" />
          <span className="text-[13px] font-medium tracking-wider text-zinc-500 uppercase font-mono">Authorize Cosmi</span>
        </div>

        {/* Dynamic States directly on pure black space */}
        {status === 'idle' && !currentUser && (
          <div className="flex flex-col items-center w-full space-y-6">
            <div className="space-y-3">
              <h1 className="text-3xl md:text-[42px] font-sans font-medium tracking-tight text-white font-jakarta">
                Authorize Cosmi
              </h1>
              <p className="text-sm text-zinc-400 max-w-sm mx-auto leading-relaxed">
                Link your Google account to authorize access for the Cosmi Desktop companion application.
              </p>
            </div>

            <div className="w-full max-w-xs pt-4">
              <button
                onClick={handleSignIn}
                id="btn-desktop-signin"
                className="w-full px-5 py-4 bg-white text-black hover:bg-neutral-100 transition-colors font-semibold rounded-xl text-sm flex items-center justify-center gap-3 cursor-pointer shadow-sm border-0 active:scale-[0.98]"
              >
                <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                  </svg>
                </div>
                <span>Sign in with Google</span>
              </button>
            </div>
          </div>
        )}

        {(status === 'auth_popup' || status === 'exchanging') && (
          <div className="flex flex-col items-center space-y-4 py-8">
            <div className="w-8 h-8 border-2 border-zinc-755 border-t-white rounded-full animate-spin" />
            <p className="text-sm text-zinc-400 font-medium">
              {status === 'auth_popup' ? 'Waiting for Google authentication...' : 'Registering desktop credentials...'}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center w-full space-y-6">
            <div className="space-y-3">
              <h1 className="text-3.5xl md:text-[44px] font-sans font-medium tracking-tight text-white leading-tight font-jakarta max-w-xl mx-auto">
                You have successfully authenticated.
              </h1>
              <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
                You should be redirected back to the product.{' '}
                <button 
                  onClick={() => triggerDeepLink(customToken)} 
                  className="text-[#4285F4] hover:text-blue-400 underline cursor-pointer bg-transparent border-0 p-0 font-medium ml-0.5"
                >
                  Click here
                </button>{' '}
                if not working.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6 justify-center w-full max-w-md">
              <button
                onClick={() => triggerDeepLink(customToken)}
                className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white transition-colors border border-zinc-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <ExternalLink className="w-4 h-4" />
                Relaunch Desktop client
              </button>

              <button
                onClick={handleCopyToken}
                className="px-5 py-3 bg-transparent text-zinc-500 hover:text-zinc-400 transition-colors text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer border-0 active:scale-[0.98]"
              >
                <Clipboard className="w-4 h-4" />
                {copied ? 'Copied Security Token!' : 'Copy Code (Fallback)'}
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center w-full space-y-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-sans font-medium tracking-tight text-red-500 font-jakarta">
                Connection Failure
              </h1>
              <p className="text-sm text-zinc-400 max-w-sm mx-auto">
                {errorMessage || 'An error occurred during verification.'}
              </p>
            </div>
            
            <button
              onClick={handleSignIn}
              className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-250 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer active:scale-[0.98]"
            >
              Retry Authenticating
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
