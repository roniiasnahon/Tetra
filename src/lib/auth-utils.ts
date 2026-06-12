import { auth, googleProvider, signInWithPopup } from '../firebase';

export const handleGoogleLogin = async () => {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      // Dynamically import to avoid issues in non-tauri environments
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      
      // Use the requested specific login-redirect URL for the desktop wrapper
      await openUrl('https://cosmiwise.vercel.app/login-redirect');
      return;
    } catch (err) {
      console.error("Tauri external login failed:", err);
    }
  }

  // Fallback to standard popup for web/other environments
  await signInWithPopup(auth, googleProvider);
};
