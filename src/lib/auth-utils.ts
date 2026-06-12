import { auth, googleProvider } from '../firebase';
import { signInWithPopup } from 'firebase/auth';

export const handleGoogleLogin = async () => {
    // This function can now be a wrapper or removed if unused. Authentication is now handled in AuthenticationScreen.tsx directly.
    await signInWithPopup(auth, googleProvider);
};