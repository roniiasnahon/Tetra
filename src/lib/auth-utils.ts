import { openUrl } from '@tauri-apps/plugin-opener';
import { auth, googleProvider, signInWithPopup } from '../firebase';

export const handleGoogleLogin = async () => {
  // Detect if we are inside Tauri
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  if (isTauri) {
    try {
      // Breakout to system browser to handle authentication
      await openUrl('https://cosmiwise.vercel.app/login-redirect');
    } catch (err) {
      console.error("Tauri breakout failed:", err);
    }
  } else {
    // Normal web behavior: use the popup
    await signInWithPopup(auth, googleProvider);
  }
};
