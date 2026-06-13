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
    <div className="min-h-screen bg-[#070707] text-[#e4e4e7] flex flex-col items-center justify-center p-6 font-sans relative">
      <div className="absolute top-0 inset-x-0 h-8 z-[100] [-webkit-app-region:drag]" />
      <div className="w-full max-w-md bg-[#0f0f10] border border-zinc-800/80 rounded-2xl p-8 space-y-6 flex flex-col items-center [-webkit-app-region:no-drag]">
        {/* Logo or Platform Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center p-1.5">
            <img src="/cosmi.png" alt="Cosmi" className="w-full h-full object-contain" />
          </div>
          <div className="h-4 w-[1px] bg-zinc-800" />
          <span className="text-xs font-mono tracking-wider text-zinc-500 uppercase">Authorize Cosmi</span>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2.5xl font-sans font-medium tracking-tight text-white font-jakarta">Authorize Cosmi</h2>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
            Link your Google account to authorize access for the Cosmi Desktop companion application.
          </p>
        </div>

        {/* Dynamic status container */}
        <div className="w-full flex flex-col items-center justify-center min-h-[140px] text-center pt-2">
          {status === 'idle' && !currentUser && (
            <div className="space-y-6 w-full">
              <span className="text-xs text-zinc-500 font-mono tracking-widest block font-medium">READY TO AUTHENTICATE</span>
              <button
                onClick={handleSignIn}
                id="btn-desktop-signin"
                className="w-full px-5 py-3.5 bg-white text-black hover:bg-neutral-100 transition-colors font-semibold rounded-xl text-sm flex items-center justify-center gap-3 cursor-pointer shadow-sm border-0"
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
          )}

          {(status === 'auth_popup' || status === 'exchanging') && (
            <div className="space-y-4 flex flex-col items-center">
              <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
              <p className="text-sm text-zinc-400">
                {status === 'auth_popup' ? 'Waiting for Google authentication...' : 'Registering desktop credentials...'}
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4 flex flex-col items-center w-full">
              <div className="w-10 h-10 rounded-full bg-emerald-950/40 border border-emerald-900/60 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-emerald-400">Successfully Authorized</p>
                <p className="text-xs text-zinc-500">Opening Cosmi Desktop automatically...</p>
              </div>

              <div className="flex flex-col gap-2 w-full pt-4">
                <button
                  onClick={() => triggerDeepLink(customToken)}
                  className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors border border-zinc-800 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Relaunch Desktop client
                </button>

                <button
                  onClick={handleCopyToken}
                  className="w-full py-2 bg-transparent hover:bg-zinc-950 text-zinc-500 hover:text-zinc-400 transition-colors text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 cursor-pointer border-0"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  {copied ? 'Copied Security Token!' : 'Copy Code (Fallback)'}
                </button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4 flex flex-col items-center">
              <p className="text-sm text-red-400 font-medium font-sans">Connection Failure</p>
              <p className="text-xs text-zinc-500 max-w-xs">{errorMessage || 'An error occurred during verification.'}</p>
              <button
                onClick={handleSignIn}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                Retry Authenticating
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
