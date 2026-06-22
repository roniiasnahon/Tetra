import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Icon } from './SolarIcon';
import { MaterialIcon } from './MaterialIcon';
import { auth, googleProvider, signInWithPopup } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { Minus, Square, X } from 'lucide-react';

// --- Pupil Sub-component ---
interface PupilProps {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
  forceLookX?: number;
  forceLookY?: number;
}

const Pupil = ({ 
  size = 12, 
  maxDistance = 5,
  pupilColor = "black",
  forceLookX,
  forceLookY
}: PupilProps) => {
  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);
  const pupilRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const calculatePupilPosition = () => {
    if (!pupilRef.current) return { x: 0, y: 0 };

    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }

    const pupil = pupilRef.current.getBoundingClientRect();
    const pupilCenterX = pupil.left + pupil.width / 2;
    const pupilCenterY = pupil.top + pupil.height / 2;

    const deltaX = mouseX - pupilCenterX;
    const deltaY = mouseY - pupilCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);

    const angle = Math.atan2(deltaY, deltaX);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    return { x, y };
  };

  const pupilPosition = calculatePupilPosition();

  return (
    <div
      ref={pupilRef}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
        transition: 'transform 0.1s ease-out',
      }}
    />
  );
};

// --- EyeBall Sub-component ---
interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
}

const EyeBall = ({ 
  size = 48, 
  pupilSize = 16, 
  maxDistance = 10,
  eyeColor = "white",
  pupilColor = "black",
  isBlinking = false,
  forceLookX,
  forceLookY
}: EyeBallProps) => {
  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const calculatePupilPosition = () => {
    if (!eyeRef.current) return { x: 0, y: 0 };

    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }

    const eye = eyeRef.current.getBoundingClientRect();
    const eyeCenterX = eye.left + eye.width / 2;
    const eyeCenterY = eye.top + eye.height / 2;

    const deltaX = mouseX - eyeCenterX;
    const deltaY = mouseY - eyeCenterY;
    const distance = Math.min(Math.sqrt(deltaX ** 2 + deltaY ** 2), maxDistance);

    const angle = Math.atan2(deltaY, deltaX);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    return { x, y };
  };

  const pupilPosition = calculatePupilPosition();

  return (
    <div
      ref={eyeRef}
      className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{
        width: `${size}px`,
        height: isBlinking ? '2px' : `${size}px`,
        backgroundColor: eyeColor,
        overflow: 'hidden',
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${pupilPosition.x}px, ${pupilPosition.y}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        />
      )}
    </div>
  );
};

// --- TypewriterText Component ---
const TypewriterText: React.FC<{ text: string; delay?: number; speed?: number }> = ({ 
  text, 
  delay = 300, 
  speed = 80 
}) => {
  const [displayedText, setDisplayedText] = useState("");

  useEffect(() => {
    let startTimeout = setTimeout(() => {
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(interval);
        }
      }, speed);
      
      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(startTimeout);
  }, [text, delay, speed]);

  return (
    <span className="inline-flex items-center">
      {displayedText}
    </span>
  );
};

// --- Main Authentication Screen Component ---
interface AuthenticationScreenProps {
  onSuccess?: () => void;
  onGoogleSignIn?: () => Promise<void>;
}

export const AuthenticationScreen: React.FC<AuthenticationScreenProps> = ({ onSuccess, onGoogleSignIn }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleVerificationCodeChange = (index: number, value: string) => {
    const newCode = verificationCode.padEnd(6, ' ').split('');
    
    // Ignore non-digits (unless they are clearing the box)
    if (value && !/^[0-9]+$/.test(value)) return;

    // Handle paste
    if (value.length > 1) {
       const digits = value.slice(0, 6).split('');
       for (let i = 0; i < digits.length; i++) {
         if (index + i < 6) newCode[index + i] = digits[i];
       }
       setVerificationCode(newCode.join(''));
       const nextIndex = Math.min(index + digits.length, 5);
       inputRefs.current[nextIndex]?.focus();
       return;
    }

    newCode[index] = value || ' ';
    setVerificationCode(newCode.join(''));
    
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerificationKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const currentCode = verificationCode.padEnd(6, ' ').split('');
      
      // If current box is already empty, focus the previous one and clear it
      if (currentCode[index] === ' ' && index > 0) {
        inputRefs.current[index - 1]?.focus();
        currentCode[index - 1] = ' ';
        setVerificationCode(currentCode.join(''));
      }
    }
  };

  const resendVerificationCode = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const response = await fetch('/api/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send confirmation code.');
      }
      setSuccessMessage(data.mocked ? `${data.message}` : 'A new verification code has been dispatched to your email.');
    } catch (err: any) {
      console.error('Failed to resend code:', err);
      setErrorMessage(err.message || 'Failed to resend verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');
    
    const isElectron = () => typeof window !== 'undefined' && (
      (window as any).electron !== undefined || 
      navigator.userAgent.toLowerCase().includes('electron') ||
      (window as any).ipcRenderer !== undefined ||
      (window as any).process?.versions?.electron !== undefined
    );

    const isTauri = () => typeof window !== 'undefined' && ('___TAURI___' in window || (window as any).__TAURI__ !== undefined);
    
    // Use system browser breakout for Tauri and Electron environments
    // because Firebase Auth popup/redirect doesn't support custom desktop protocols or wrappers securely.
    const needsSystemBrowserBreakout = isTauri() || isElectron();

    if (needsSystemBrowserBreakout) {
      if (isElectron()) {
        if ((window as any).electron?.openUrl) {
          (window as any).electron.openUrl('https://cosmiwise.vercel.app/?google_callback=1');
        } else {
          window.open('https://cosmiwise.vercel.app/?google_callback=1', '_blank');
        }
      } else if (isTauri()) {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl('https://cosmiwise.vercel.app/?google_callback=1');
      }
      setTimeout(() => setIsLoading(false), 15000);
    } else {
      try {
        const { signInWithPopup } = await import('firebase/auth');
        await signInWithPopup(auth, googleProvider);
      } catch (err: any) {
        console.error('Google Sign-In failed:', err);
        setErrorMessage('We couldn\'t connect your Google account. Please check your internet connection or try again.');
        setIsLoading(false);
      }
    }
  };

  const handleYahooSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const { OAuthProvider, signInWithPopup } = await import('firebase/auth');
      const yahooProvider = new OAuthProvider('yahoo.com');
      await signInWithPopup(auth, yahooProvider);
    } catch (err: any) {
      console.error('Yahoo Sign-In failed:', err);
      setErrorMessage('We couldn\'t connect your Yahoo account. Please check your internet connection or try again.');
      setIsLoading(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your email address so we can get you started.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    if (isVerifyingEmail) {
      const cleanCode = verificationCode.replace(/\s/g, '');
      if (cleanCode.length !== 6) {
        setErrorMessage('Please input the complete 6-digit confirmation code.');
        setIsLoading(false);
        return;
      }

      try {
        const verifyResp = await fetch('/api/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), code: cleanCode }),
        });
        const verifyData = await verifyResp.json();
        
        if (!verifyResp.ok) {
          setErrorMessage(verifyData.error || 'Incorrect code. Please double check and try again.');
          setIsLoading(false);
          return;
        }

        // Code verification matches! Proceed block with Firebase registration
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        setSuccessMessage('Account created successfully! Welcome to cosmi.');
        setIsVerifyingEmail(false);
        onSuccess?.();
      } catch (err: any) {
        console.error("Verification confirmation or registration failed:", err);
        if (err.code === 'auth/email-already-in-use') {
          setErrorMessage('An account with this email address already exists. Try signing in helper instead.');
        } else {
          setErrorMessage(err.message || 'We encountered an error verifying or registering you. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      if (authMode === 'login') {
        if (!password) {
          setErrorMessage('Please enter your password to continue.');
          setIsLoading(false);
          return;
        }
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onSuccess?.();
      } else if (authMode === 'register') {
        if (!password) {
          setErrorMessage('Please type in a secure password.');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setErrorMessage('Please choose a password that is at least 6 characters long.');
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMessage("The passwords you entered don't match. Please try typing them again.");
          setIsLoading(false);
          return;
        }

        // Dispatch Resend email verification code
        const response = await fetch('/api/send-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        const resData = await response.json();
        
        if (!response.ok) {
          throw new Error(resData.error || 'Failed to dispatch verification code.');
        }

        setIsVerifyingEmail(true);
        setSuccessMessage(resData.mocked ? `${resData.message}` : 'A 6-digit verification code has been dispatched to your email.');
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        setSuccessMessage('Password reset link sent! Check your email inbox.');
        setTimeout(() => {
          setAuthMode('login');
          setSuccessMessage('');
        }, 5000);
      }
    } catch (err: any) {
      console.error("Email auth operation failed:", err);
      
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setErrorMessage('We couldn\'t find an account matching that email and password. Please check your details and try again.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMessage('An account with this email address already exists. Try signing in helper instead.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMessage('That email address doesn\'t look quite right. Please check for any typos.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMessage('Email and password sign-in is currently undergoing updates. Please use a different sign-in partner or contact support.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMessage('For your security, please choose a stronger password with at least 6 characters.');
      } else {
        setErrorMessage(err.message || 'We ran into an unexpected issue while signing you in. Please verify your details or try again in a moment.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isElectronApp = typeof window !== 'undefined' && (
      (window as any).electron !== undefined || 
      navigator.userAgent.toLowerCase().includes('electron') ||
      (window as any).ipcRenderer !== undefined ||
      (window as any).process?.versions?.electron !== undefined
  );

  const isTauri = typeof window !== 'undefined' && (
    (window as any).___TAURI___ !== undefined ||
    (window as any).__TAURI__ !== undefined
  );

  const isDesktopApp = isElectronApp || isTauri;

  const handleMinimize = () => {
    if (isTauri) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().minimize();
      }).catch(console.error);
    } else {
      (window as any).electron?.minimize?.();
    }
  };

  const handleMaximize = () => {
    if (isTauri) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().toggleMaximize();
      }).catch(console.error);
    } else {
      (window as any).electron?.maximize?.();
    }
  };

  const handleClose = () => {
    if (isTauri) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        getCurrentWindow().close();
      }).catch(console.error);
    } else {
      (window as any).electron?.close?.();
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-[#0c0c0f] to-[#040405] text-[#e4e4e7] flex flex-col select-none selection:bg-zinc-800 selection:text-white overflow-hidden relative font-jakarta">
      {/* Background Image Layer */}
      <img 
        src="/authbg.jpg"
        alt="Background" 
        className="absolute inset-0 w-full h-full object-cover opacity-35 pointer-events-none z-0" 
        referrerPolicy="no-referrer"
      />

      {/* Desktop Drag Area */}
      <div className="absolute top-0 inset-x-0 h-8 z-[100] [-webkit-app-region:drag]" />
      {isDesktopApp && (
        <div className="absolute top-0 right-0 h-8 flex items-center z-[101] [-webkit-app-region:no-drag]">
          <button onClick={handleMinimize} className="h-full px-4 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center border-0 bg-transparent">
            <Minus className="w-[14px] h-[14px]" />
          </button>
          <button onClick={handleMaximize} className="h-full px-4 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center border-0 bg-transparent">
            <Square className="w-[12px] h-[12px]" />
          </button>
          <button onClick={handleClose} className="h-full px-4 text-zinc-400 hover:text-white hover:bg-red-500 hover:text-white transition-colors cursor-pointer flex items-center justify-center border-0 bg-transparent">
            <X className="w-[14px] h-[14px]" />
          </button>
        </div>
      )}
      
      <div className="flex-1 flex flex-col md:flex-row relative z-10 w-full">
        {/* LEFT COLUMN: Logo and title */}
        <div className="flex-1 flex flex-col justify-center p-12 md:pl-28 relative">
          <div className="flex flex-col relative z-10 leading-none">
            <div className="flex items-center gap-5 -mb-2.5">
              <img src="/cosmi.png" alt="cosmi logo" className="w-[72px] h-[72px] object-contain drop-shadow-md" />
              <span className="text-[52px] font-bold text-white tracking-tight drop-shadow-md">cosmi</span>
            </div>
            <h1 className="text-[24px] text-white font-medium drop-shadow-sm ml-[92px] mt-2">
              <TypewriterText text="Expand your horizon." />
            </h1>
          </div>
        </div>

        {/* RIGHT COLUMN: The Auth form card */}
        <div className="w-full md:w-[500px] lg:w-[540px] flex items-center justify-center p-8 md:p-12 md:pr-24 relative z-10 font-sans">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full bg-[#0c0c0f]/85 border border-zinc-800/80 p-10 flex flex-col rounded-3xl backdrop-blur-xl"
            style={{ boxShadow: 'none' }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isVerifyingEmail ? (
                <motion.div
                  key="verify-email"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="flex flex-col"
                >
                  <h2 id="auth-title" className="text-3xl font-bold text-white tracking-tight font-sans">
                    Verify your email
                  </h2>
                  <p className="text-[14px] text-zinc-400 mt-2.5 mb-8 leading-relaxed font-sans">
                    We sent a 6-digit confirmation code to{' '}
                    <span className="text-zinc-200 font-semibold">{email}</span>. Please enter it below to complete your registration.
                  </p>
                  
                  {errorMessage && (
                    <div className="mb-6 p-3.5 rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 text-[13px] flex items-start gap-2.5 leading-relaxed font-sans">
                      <MaterialIcon name="error" fill={true} className="text-[16px] text-red-500 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                  {successMessage && (
                    <div className="mb-6 p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-[13px] flex items-start gap-2.5 leading-relaxed font-sans">
                      <MaterialIcon name="check" className="text-[16px] text-emerald-500 shrink-0 mt-0.5" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleEmailAuthSubmit} className="space-y-6">
                    <div className="flex gap-2 justify-between">
                      {[0, 1, 2, 3, 4, 5].map((index) => {
                        const digits = verificationCode.padEnd(6, ' ').split('');
                        return (
                          <input
                            key={index}
                            ref={(el) => { inputRefs.current[index] = el; }}
                            type="text"
                            maxLength={6}
                            required
                            disabled={isLoading}
                            value={digits[index] === ' ' ? '' : digits[index]}
                            onChange={(e) => handleVerificationCodeChange(index, e.target.value)}
                            onKeyDown={(e) => handleVerificationKeyDown(index, e)}
                            className="w-12 h-14 text-center font-sans font-bold text-2xl bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 focus:border-zinc-500 text-white outline-none transition-all duration-150 disabled:opacity-50 rounded-xl"
                          />
                        );
                      })}
                    </div>
                    
                    <p className="text-xs text-zinc-500 leading-relaxed text-center font-sans">
                      If you don't see the email in your inbox, please check your spam or junk folder.
                    </p>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        id="switch-back-to-register"
                        type="button"
                        disabled={isLoading}
                        onClick={() => {
                          setIsVerifyingEmail(false);
                          setErrorMessage('');
                          setSuccessMessage('');
                          setVerificationCode('');
                        }}
                        className="text-xs text-zinc-400 hover:text-white transition-colors font-medium bg-transparent border-0 p-0 cursor-pointer outline-none disabled:opacity-50"
                      >
                        Change credentials
                      </button>
                      <button
                        id="resend-code-btn"
                        type="button"
                        disabled={isLoading}
                        onClick={resendVerificationCode}
                        className="text-xs text-[#3b82f6] hover:text-[#60a5fa] transition-colors font-medium bg-transparent border-0 p-0 cursor-pointer outline-none disabled:opacity-50"
                      >
                        Resend code
                      </button>
                    </div>

                    <div className="flex flex-row items-center justify-end pt-2">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-950 font-semibold py-2.5 px-6 rounded-full text-[14px] cursor-pointer transition-colors flex items-center justify-center gap-2 select-none disabled:opacity-50 font-sans"
                        style={{ boxShadow: 'none' }}
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                        ) : (
                          <span>Verify & Register</span>
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
              ) : authMode === 'login' ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="flex flex-col"
                >
                  <h2 id="auth-title" className="text-3xl font-bold text-white tracking-tight font-sans">
                    Sign in
                  </h2>
                  <p className="text-[14px] text-zinc-400 mt-2 mb-8 font-sans">
                    New here?{' '}
                    <button
                      id="switch-to-register"
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className="text-[#3b82f6] hover:text-[#60a5fa] transition-colors font-medium bg-transparent border-0 p-0 cursor-pointer outline-none"
                    >
                      Create an account
                    </button>
                  </p>

                  {errorMessage && (
                    <div className="mb-6 p-3.5 rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 text-[13px] flex items-start gap-2.5 leading-relaxed font-sans">
                      <MaterialIcon name="error" fill={true} className="text-[16px] text-red-500 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                  {successMessage && (
                    <div className="mb-6 p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-[13px] flex items-start gap-2.5 leading-relaxed font-sans">
                      <MaterialIcon name="check" className="text-[16px] text-emerald-500 shrink-0 mt-0.5" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
                    <div className="flex flex-col gap-1.5 focus-within:text-[#3b82f6]">
                      <input
                        id="auth-email"
                        type="email"
                        required
                        disabled={isLoading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        className="w-full bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 focus:border-zinc-500 text-[14px] text-white placeholder-zinc-500 outline-none transition-all duration-150 disabled:opacity-50 px-4 py-3 rounded-xl font-sans"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 ">
                      <div className="relative focus-within:text-[#3b82f6]">
                        <input
                          id="auth-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          disabled={isLoading}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password"
                          className="w-full bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 focus:border-zinc-500 text-[14px] text-white placeholder-zinc-500 outline-none transition-all duration-150 disabled:opacity-50 px-4 py-3 pr-11 rounded-xl font-sans"
                        />
                        <button
                          id="toggle-password"
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-[13px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer select-none"
                        >
                          {showPassword ? <MaterialIcon name="visibility_off" className="text-[18px]" /> : <MaterialIcon name="visibility" className="text-[18px]" />}
                        </button>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          id="switch-to-forgot-pw"
                          type="button"
                          onClick={() => {
                            setAuthMode('forgot_password');
                            setErrorMessage('');
                            setSuccessMessage('');
                          }}
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium bg-transparent border-0 p-0 cursor-pointer outline-none"
                        >
                          Forgot password?
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-row items-center justify-end pt-4">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-950 font-semibold py-2.5 px-6 rounded-full text-[14px] cursor-pointer transition-colors flex items-center justify-center gap-2 select-none disabled:opacity-50 font-sans"
                        style={{ boxShadow: 'none' }}
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                        ) : (
                          <span>Continue</span>
                        )}
                      </button>
                    </div>
                  </form>

                  <div className="relative flex py-6 items-center">
                    <div className="flex-grow border-t border-zinc-800/80"></div>
                    <span className="flex-shrink mx-4 text-xs text-zinc-500 font-medium font-sans uppercase tracking-wider">Or</span>
                    <div className="flex-grow border-t border-zinc-800/80"></div>
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-zinc-900/40 hover:bg-zinc-800/50 text-white rounded-full text-[14px] font-semibold transition-colors duration-150 border border-zinc-800 disabled:opacity-50 cursor-pointer font-sans"
                    >
                      <Icon icon="logos:google-icon" className="w-[20px] h-[20px] shrink-0" />
                      <span>Continue with Google</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleYahooSignIn}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-zinc-900/40 hover:bg-zinc-800/50 text-white rounded-full text-[14px] font-semibold transition-colors duration-150 border border-zinc-800 disabled:opacity-50 cursor-pointer font-sans"
                    >
                      <img src="/Logo-v3.svg?v=fixed" alt="Yahoo" className="w-[20px] h-[20px] object-contain shrink-0" referrerPolicy="no-referrer" />
                      <span>Continue with Yahoo</span>
                    </button>
                  </div>
                </motion.div>
              ) : authMode === 'register' ? (
                <motion.div
                  key="register"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="flex flex-col"
                >
                  <h2 id="auth-title" className="text-3xl font-bold text-white tracking-tight font-sans">
                    Create an account
                  </h2>
                  <p className="text-[14px] text-zinc-400 mt-2 mb-8 font-sans">
                    Already have an account?{' '}
                    <button
                      id="switch-to-login"
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className="text-[#3b82f6] hover:text-[#60a5fa] transition-colors font-medium bg-transparent border-0 p-0 cursor-pointer outline-none"
                    >
                      Sign in
                    </button>
                  </p>

                  {errorMessage && (
                    <div className="mb-6 p-3.5 rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 text-[13px] flex items-start gap-2.5 leading-relaxed font-sans">
                      <MaterialIcon name="error" fill={true} className="text-[16px] text-red-500 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                  {successMessage && (
                    <div className="mb-6 p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-[13px] flex items-start gap-2.5 leading-relaxed font-sans">
                      <MaterialIcon name="check" className="text-[16px] text-emerald-500 shrink-0 mt-0.5" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
                    <div className="flex flex-col gap-1.5 focus-within:text-[#3b82f6]">
                      <input
                        id="auth-email"
                        type="email"
                        required
                        disabled={isLoading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        className="w-full bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 focus:border-zinc-500 text-[14px] text-white placeholder-zinc-500 outline-none transition-all duration-150 disabled:opacity-50 px-4 py-3 rounded-xl font-sans"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 focus-within:text-[#3b82f6]">
                      <div className="relative">
                        <input
                          id="auth-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          disabled={isLoading}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password"
                          className="w-full bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 focus:border-zinc-500 text-[14px] text-white placeholder-zinc-500 outline-none transition-all duration-150 disabled:opacity-50 px-4 py-3 pr-11 rounded-xl font-sans"
                        />
                        <button
                          id="toggle-password"
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-[13px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer select-none"
                        >
                          {showPassword ? <MaterialIcon name="visibility_off" className="text-[18px]" /> : <MaterialIcon name="visibility" className="text-[18px]" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 focus-within:text-[#3b82f6]">
                      <div className="relative">
                        <input
                          id="auth-confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          disabled={isLoading}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm password"
                          className="w-full bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 focus:border-zinc-500 text-[14px] text-white placeholder-zinc-500 outline-none transition-all duration-150 disabled:opacity-50 px-4 py-3 pr-11 rounded-xl font-sans"
                        />
                        <button
                          id="toggle-confirm-password"
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3.5 top-[13px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer select-none"
                        >
                          {showConfirmPassword ? <MaterialIcon name="visibility_off" className="text-[18px]" /> : <MaterialIcon name="visibility" className="text-[18px]" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-row items-center justify-end pt-4">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-950 font-semibold py-2.5 px-6 rounded-full text-[14px] cursor-pointer transition-colors flex items-center justify-center gap-2 select-none disabled:opacity-50 font-sans"
                        style={{ boxShadow: 'none' }}
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                        ) : (
                          <span>Continue</span>
                        )}
                      </button>
                    </div>
                  </form>

                  <div className="relative flex py-6 items-center">
                    <div className="flex-grow border-t border-zinc-800/80"></div>
                    <span className="flex-shrink mx-4 text-xs text-zinc-500 font-medium font-sans uppercase tracking-wider">Or</span>
                    <div className="flex-grow border-t border-zinc-800/80"></div>
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-zinc-900/40 hover:bg-zinc-800/50 text-white rounded-full text-[14px] font-semibold transition-colors duration-150 border border-zinc-800 disabled:opacity-50 cursor-pointer font-sans"
                    >
                      <Icon icon="logos:google-icon" className="w-[20px] h-[20px] shrink-0" />
                      <span>Continue with Google</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={handleYahooSignIn}
                      disabled={isLoading}
                      className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-zinc-900/40 hover:bg-zinc-800/50 text-white rounded-full text-[14px] font-semibold transition-colors duration-150 border border-zinc-800 disabled:opacity-50 cursor-pointer font-sans"
                    >
                      <img src="/Logo-v3.svg?v=fixed" alt="Yahoo" className="w-[20px] h-[20px] object-contain shrink-0" referrerPolicy="no-referrer" />
                      <span>Continue with Yahoo</span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="forgot_password"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="flex flex-col"
                >
                  <h2 id="auth-title" className="text-3xl font-bold text-white tracking-tight font-sans">
                    Reset password
                  </h2>
                  <p className="text-[14px] text-zinc-400 mt-2 mb-8 font-sans">
                    <button
                      id="switch-to-login-forgot"
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className="text-[#3b82f6] hover:text-[#60a5fa] transition-colors font-medium bg-transparent border-0 p-0 cursor-pointer outline-none"
                    >
                      Back to Sign in
                    </button>
                  </p>

                  {errorMessage && (
                    <div className="mb-6 p-3.5 rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 text-[13px] flex items-start gap-2.5 leading-relaxed font-sans">
                      <MaterialIcon name="error" fill={true} className="text-[16px] text-red-500 shrink-0 mt-0.5" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                  {successMessage && (
                    <div className="mb-6 p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-[13px] flex items-start gap-2.5 leading-relaxed font-sans">
                      <MaterialIcon name="check" className="text-[16px] text-emerald-500 shrink-0 mt-0.5" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
                    <div className="flex flex-col gap-1.5 focus-within:text-[#3b82f6]">
                      <input
                        id="auth-email"
                        type="email"
                        required
                        disabled={isLoading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        className="w-full bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 focus:border-zinc-500 text-[14px] text-white placeholder-zinc-500 outline-none transition-all duration-150 disabled:opacity-50 px-4 py-3 rounded-xl font-sans"
                      />
                    </div>

                    <div className="flex flex-row items-center justify-end pt-4">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-zinc-100 hover:bg-zinc-200 active:bg-zinc-300 text-zinc-950 font-semibold py-2.5 px-6 rounded-full text-[14px] cursor-pointer transition-colors flex items-center justify-center gap-2 select-none disabled:opacity-50 font-sans"
                        style={{ boxShadow: 'none' }}
                      >
                        {isLoading ? (
                          <div className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                        ) : (
                          <span>Continue</span>
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* --- PROFESSIONAL FOOTER --- */}
      <div className="relative z-20 w-full h-14 border-t border-zinc-800/60 bg-[#0c0c0f] flex items-center justify-between px-8 text-[12px] text-zinc-400 font-medium shrink-0">
        <div>
          <span>Copyright © 2026 General Language. All rights reserved.</span>
        </div>
        
        <div className="flex items-center gap-4">
          <a href="https://genlang.vercel.app/#terms" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Terms of Use</a>
          <div className="w-[1px] h-3.5 bg-zinc-700"></div>
          <a href="https://genlang.vercel.app/#cookie-preferences" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Cookie preferences</a>
          <div className="w-[1px] h-3.5 bg-zinc-700"></div>
          <a href="https://genlang.vercel.app/#privacy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Privacy</a>
          <div className="w-[1px] h-3.5 bg-zinc-700"></div>
          <a href="https://genlang.vercel.app/#do-not-sell" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Do not sell or share my personal information</a>
        </div>
      </div>
    </div>
  );
};
