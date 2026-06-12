import { auth, googleProvider, signInWithPopup } from '../firebase';

export const handleGoogleLogin = async () => {
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
    try {
      // Dynamically import to avoid issues in non-tauri environments
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      
      // Construction of Google OAuth URL for Firebase Auth
      // This is a common way to trigger the flow externally. 
      // The app usually needs a custom protocol or a hosted bridge to handle the return.
      const apiKey = auth.app.options.apiKey;
      const authDomain = auth.app.options.authDomain;
      
      // This URL triggers the Firebase Auth handler for Google
      const authUrl = `https://${authDomain}/__/auth/handler?apiKey=${apiKey}&providerId=google.com&authType=popup`;
      
      await openUrl(authUrl);
      return;
    } catch (err) {
      console.error("Tauri external login failed:", err);
    }
  }

  // Fallback to standard popup for web/other environments
  await signInWithPopup(auth, googleProvider);
};
