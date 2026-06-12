import { openUrl } from '@tauri-apps/plugin-opener';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signInWithCustomToken } from 'firebase/auth';

export const handleGoogleLogin = async () => {
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  if (isTauri) {
    // 1. Listen for the deep link callback FIRST
    await onOpenUrl(async (urls) => {
      const url = urls[0];
      const params = new URL(url).searchParams;
      const token = params.get('token'); // grab token from redirect

      if (token) {
        await signInWithCustomToken(auth, token); // log in with firebase
      }
    });

    // 2. Then open browser to your OAuth page
    await openUrl('https://cosmiwise.vercel.app/login-redirect');

  } else {
    await signInWithPopup(auth, googleProvider);
  }
};