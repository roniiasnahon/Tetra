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
          <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Laptop className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="h-4 w-[1px] bg-zinc-800" />
          <span className="text-sm font-mono tracking-wider text-zinc-500 uppercase">Cosmi Connection</span>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-sans font-medium tracking-tight text-white">Desk Authorization</h2>
          <p className="text-sm text-zinc-400 max-w-xs mx-auto">
            Authorize your secure workspace instance using Google credentials.
          </p>
        </div>

        {/* Dynamic status card */}
        <div className="w-full bg-[#09090a] border border-zinc-900 rounded-xl p-6 flex flex-col items-center justify-center min-h-[140px] text-center">
          {status === 'idle' && !currentUser && (
            <div className="space-y-4">
              <span className="text-sm text-zinc-400">Ready to authenticate</span>
              <button
                onClick={handleSignIn}
                id="btn-desktop-signin"
                className="w-full px-5 py-2.5 bg-white text-black hover:bg-neutral-100 transition-colors font-medium rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm border-0"
              >
                Sign In with Google
                <ArrowRight className="w-4 h-4" />
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

              <div className="flex flex-col gap-2 w-full pt-2">
                <button
                  onClick={() => triggerDeepLink(customToken)}
                  className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors border border-zinc-800 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
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

        {/* Visual prompt/info footer */}
        <div className="flex items-center gap-2 text-xs text-zinc-600 font-mono">
          <Chrome className="w-3.5 h-3.5 text-zinc-700" />
          <span>secure chrome system agent dispatch</span>
        </div>
      </div>
    </div>
  );
};
