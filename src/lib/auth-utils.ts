import { openUrl } from '@tauri-apps/plugin-opener';
import { auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from '../firebase';

export const handleGoogleLogin = async () => {
  // Detect if we are inside Tauri
  const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

  if (isTauri) {
    try {
      // Use internal redirect to maintain the session inside the Tauri webview
      await signInWithRedirect(auth, googleProvider);
    } catch (err) {
      console.error("Tauri redirect failed, falling back to breakout:", err);
      try {
        await openUrl('https://cosmiwise.vercel.app/login-redirect');
      } catch (breakoutErr) {
        console.error("Breakout also failed:", breakoutErr);
      }
    }
  } else {
    // Normal web behavior: use the popup
    await signInWithPopup(auth, googleProvider);
  }
};

export const handleRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error) {
    console.error("Error getting redirect result:", error);
    return null;
  }
};
