import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Icon } from '@iconify/react';
import { Eye, EyeOff, Check, AlertCircle, ArrowLeft, Database, Sparkles } from 'lucide-react';
import { auth, googleProvider, signInWithPopup } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

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

// --- Main Authentication Screen Component ---
interface AuthenticationScreenProps {
  onSuccess?: () => void;
}

export const AuthenticationScreen: React.FC<AuthenticationScreenProps> = ({ onSuccess }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Character States
  const [mouseX, setMouseX] = useState<number>(0);
  const [mouseY, setMouseY] = useState<number>(0);
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);
  const [isBlackBlinking, setIsBlackBlinking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = useState(false);

  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Blinking effects
  useEffect(() => {
    const getRandomInterval = () => Math.random() * 4000 + 3000;
    const scheduleBlink = () => {
      const timeout = setTimeout(() => {
        setIsPurpleBlinking(true);
        setTimeout(() => {
          setIsPurpleBlinking(false);
          scheduleBlink();
        }, 150);
      }, getRandomInterval());
      return timeout;
    };
    const t = scheduleBlink();
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const getRandomInterval = () => Math.random() * 4000 + 3000;
    const scheduleBlink = () => {
      const timeout = setTimeout(() => {
        setIsBlackBlinking(true);
        setTimeout(() => {
          setIsBlackBlinking(false);
          scheduleBlink();
        }, 150);
      }, getRandomInterval());
      return timeout;
    };
    const t = scheduleBlink();
    return () => clearTimeout(t);
  }, []);

  // Look at each other when typing
  useEffect(() => {
    if (isTyping) {
      setIsLookingAtEachOther(true);
      const timer = setTimeout(() => {
        setIsLookingAtEachOther(false);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setIsLookingAtEachOther(false);
    }
  }, [isTyping]);

  // Purple sneaky peek animation when typing password and it's visible
  useEffect(() => {
    if (password.length > 0 && showPassword) {
      const schedulePeek = () => {
        const timer = setTimeout(() => {
          setIsPurplePeeking(true);
          setTimeout(() => {
            setIsPurplePeeking(false);
          }, 800);
        }, Math.random() * 3000 + 2000);
        return timer;
      };
      const t = schedulePeek();
      return () => clearTimeout(t);
    } else {
      setIsPurplePeeking(false);
    }
  }, [password, showPassword]);

  const calculateLeanPosition = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 3;

    const deltaX = mouseX - centerX;
    const deltaY = mouseY - centerY;

    const faceX = Math.max(-15, Math.min(15, deltaX / 20));
    const faceY = Math.max(-10, Math.min(10, deltaY / 30));
    const bodySkew = Math.max(-6, Math.min(6, -deltaX / 120));

    return { faceX, faceY, bodySkew };
  };

  const purplePos = calculateLeanPosition(purpleRef);
  const blackPos = calculateLeanPosition(blackRef);
  const yellowPos = calculateLeanPosition(yellowRef);
  const orangePos = calculateLeanPosition(orangeRef);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await signInWithPopup(auth, googleProvider);
      onSuccess?.();
    } catch (err: any) {
      console.error("Google Sign-In failed:", err);
      if (err.code === 'auth/popup-blocked') {
        setErrorMessage('Pop-up blocked. Please enable pop-ups for this site or click try again.');
      } else {
        setErrorMessage(err.message || 'Failed to sign in with Google');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (authMode === 'login') {
        if (!password) {
          setErrorMessage('Please enter your password.');
          setIsLoading(false);
          return;
        }
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onSuccess?.();
      } else if (authMode === 'register') {
        if (!password) {
          setErrorMessage('Please enter a password.');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setErrorMessage('Password must be at least 6 characters.');
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMessage('Passwords do not match.');
          setIsLoading(false);
          return;
        }
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        setSuccessMessage('Account created successfully! Welcome to Research Workspace.');
        onSuccess?.();
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
        setErrorMessage('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMessage('An account with this email address already exists.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMessage('Please enter a valid email address.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setErrorMessage('Email/password login is not yet enabled in the Firebase Console. Go to Authentication -> Sign-in method to activate it.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMessage('Password is too weak. Please use at least 6 characters.');
      } else {
        setErrorMessage(err.message || 'An error occurred during authentication.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0c0c0f] to-[#040405] text-[#e4e4e7] flex select-none selection:bg-zinc-800 selection:text-white overflow-hidden relative font-jakarta">
      
      {/* LEFT COLUMN: Clean Slate/Zinc background with interactive cartoon characters */}
      <div className="hidden md:flex md:w-[50%] lg:w-[54%] relative flex-col justify-between p-12 overflow-hidden">
        
        {/* Subtle grid backdrop config matching Voyage look and feel but absolutely NO glows */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        
        {/* Branding header in top left */}
        <div className="flex items-center gap-4 z-10">
          <img src="/cosmi.png" alt="cosmi logo" className="w-12 h-12 object-contain" />
          <span className="text-[28px] font-bold tracking-tight text-white mb-1">cosmi</span>
        </div>

        {/* Cartoon character stage containing responsive animated layers exactly as proposed */}
        <div className="relative z-10 flex items-end justify-center h-[520px] mb-8 select-none pointer-events-none">
          <div className="relative" style={{ width: '600px', height: '480px' }}>
            
            {/* Purple taller character (Back side) */}
            <div 
              ref={purpleRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '80px',
                width: '190px',
                height: (isTyping || (password.length > 0 && !showPassword)) ? '480px' : '440px',
                backgroundColor: '#6C3FF5',
                borderRadius: '12px 12px 0 0',
                zIndex: 1,
                transform: (password.length > 0 && showPassword)
                  ? `skewX(0deg)`
                  : (isTyping || (password.length > 0 && !showPassword))
                    ? `skewX(${(purplePos.bodySkew || 0) - 12}deg) translateX(40px)` 
                    : `skewX(${purplePos.bodySkew || 0}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              {/* EyeBall setup */}
              <div 
                className="absolute flex gap-8 transition-all duration-700 ease-in-out"
                style={{
                  left: (password.length > 0 && showPassword) ? '30px' : isLookingAtEachOther ? '60px' : `${50 + purplePos.faceX}px`,
                  top: (password.length > 0 && showPassword) ? '40px' : isLookingAtEachOther ? '70px' : `${45 + purplePos.faceY}px`,
                }}
              >
                <EyeBall 
                  size={20} 
                  pupilSize={8} 
                  maxDistance={6} 
                  eyeColor="white" 
                  pupilColor="#2D2D2D" 
                  isBlinking={isPurpleBlinking}
                  forceLookX={(password.length > 0 && showPassword) ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                  forceLookY={(password.length > 0 && showPassword) ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
                />
                <EyeBall 
                  size={20} 
                  pupilSize={8} 
                  maxDistance={6} 
                  eyeColor="white" 
                  pupilColor="#2D2D2D" 
                  isBlinking={isPurpleBlinking}
                  forceLookX={(password.length > 0 && showPassword) ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                  forceLookY={(password.length > 0 && showPassword) ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
                />
              </div>
            </div>

            {/* Black taller rectangle character (Middle side) */}
            <div 
              ref={blackRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '260px',
                width: '130px',
                height: '340px',
                backgroundColor: '#1E1E22',
                borderRadius: '10px 10px 0 0',
                zIndex: 2,
                transform: (password.length > 0 && showPassword)
                  ? `skewX(0deg)`
                  : isLookingAtEachOther
                    ? `skewX(${(blackPos.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
                    : (isTyping || (password.length > 0 && !showPassword))
                      ? `skewX(${(blackPos.bodySkew || 0) * 1.5}deg)` 
                      : `skewX(${blackPos.bodySkew || 0}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              {/* Black character eyes */}
              <div 
                className="absolute flex gap-6 transition-all duration-700 ease-in-out"
                style={{
                  left: (password.length > 0 && showPassword) ? '15px' : isLookingAtEachOther ? '35px' : `${28 + blackPos.faceX}px`,
                  top: (password.length > 0 && showPassword) ? '35px' : isLookingAtEachOther ? '15px' : `${38 + blackPos.faceY}px`,
                }}
              >
                <EyeBall 
                  size={18} 
                  pupilSize={7} 
                  maxDistance={5} 
                  eyeColor="white" 
                  pupilColor="#2D2D2D" 
                  isBlinking={isBlackBlinking}
                  forceLookX={(password.length > 0 && showPassword) ? -4 : isLookingAtEachOther ? 0 : undefined}
                  forceLookY={(password.length > 0 && showPassword) ? -4 : isLookingAtEachOther ? -4 : undefined}
                />
                <EyeBall 
                  size={18} 
                  pupilSize={7} 
                  maxDistance={5} 
                  eyeColor="white" 
                  pupilColor="#2D2D2D" 
                  isBlinking={isBlackBlinking}
                  forceLookX={(password.length > 0 && showPassword) ? -4 : isLookingAtEachOther ? 0 : undefined}
                  forceLookY={(password.length > 0 && showPassword) ? -4 : isLookingAtEachOther ? -4 : undefined}
                />
              </div>
            </div>

            {/* Orange character (Front left side) */}
            <div 
              ref={orangeRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '0px',
                width: '240px',
                height: '220px',
                zIndex: 3,
                backgroundColor: '#FF9B6B',
                borderRadius: '130px 130px 0 0',
                transform: (password.length > 0 && showPassword) ? `skewX(0deg)` : `skewX(${orangePos.bodySkew || 0}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              {/* Orange eyes */}
              <div 
                className="absolute flex gap-8 transition-all duration-200 ease-out"
                style={{
                  left: (password.length > 0 && showPassword) ? '55px' : `${85 + (orangePos.faceX || 0)}px`,
                  top: (password.length > 0 && showPassword) ? '90px' : `${95 + (orangePos.faceY || 0)}px`,
                }}
              >
                <Pupil size={14} maxDistance={6} pupilColor="#2D2D2D" forceLookX={(password.length > 0 && showPassword) ? -5 : undefined} forceLookY={(password.length > 0 && showPassword) ? -4 : undefined} />
                <Pupil size={14} maxDistance={6} pupilColor="#2D2D2D" forceLookX={(password.length > 0 && showPassword) ? -5 : undefined} forceLookY={(password.length > 0 && showPassword) ? -4 : undefined} />
              </div>
            </div>

            {/* Yellow character (Front right side) */}
            <div 
              ref={yellowRef}
              className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: '340px',
                width: '160px',
                height: '250px',
                backgroundColor: '#E8D754',
                borderRadius: '80px 80px 0 0',
                zIndex: 4,
                transform: (password.length > 0 && showPassword) ? `skewX(0deg)` : `skewX(${yellowPos.bodySkew || 0}deg)`,
                transformOrigin: 'bottom center',
              }}
            >
              {/* Yellow eyes */}
              <div 
                className="absolute flex gap-7 transition-all duration-200 ease-out"
                style={{
                  left: (password.length > 0 && showPassword) ? '25px' : `${55 + (yellowPos.faceX || 0)}px`,
                  top: (password.length > 0 && showPassword) ? '40px' : `${45 + (yellowPos.faceY || 0)}px`,
                }}
              >
                <Pupil size={14} maxDistance={6} pupilColor="#2D2D2D" forceLookX={(password.length > 0 && showPassword) ? -5 : undefined} forceLookY={(password.length > 0 && showPassword) ? -4 : undefined} />
                <Pupil size={14} maxDistance={6} pupilColor="#2D2D2D" forceLookX={(password.length > 0 && showPassword) ? -5 : undefined} forceLookY={(password.length > 0 && showPassword) ? -4 : undefined} />
              </div>
              {/* Yellow mouth line */}
              <div 
                className="absolute w-20 h-[4px] bg-[#2D2D2D] rounded-full transition-all duration-200 ease-out"
                style={{
                  left: (password.length > 0 && showPassword) ? '15px' : `${42 + (yellowPos.faceX || 0)}px`,
                  top: (password.length > 0 && showPassword) ? '98px' : `${98 + (yellowPos.faceY || 0)}px`,
                }}
              />
            </div>

          </div>
        </div>

        {/* Space below character stage */}
        <div className="z-10 h-20" />

        {/* Footer text is removed as requested by user */}
        <div className="z-10 h-8" />

      </div>

      {/* RIGHT COLUMN: The Auth form cards */}
      <div className="flex-1 flex flex-col items-center justify-start pt-[8vh] p-6 md:p-12 relative">
        
        {/* Simple back navigation if in forgot password mode */}
        {authMode === 'forgot_password' && (
          <button 
            onClick={() => {
              setAuthMode('login');
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className="absolute top-8 left-8 flex items-center gap-2 text-zinc-400 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Login</span>
          </button>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px] p-8 md:p-10 flex flex-col relative"
          style={{ boxShadow: 'none' }} /* Strictly NO dynamic glowing shadows on the card */
        >
          {/* Header element */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="md:hidden flex items-center gap-4 mb-6 justify-center">
              <img src="/cosmi.png" alt="cosmi logo" className="w-12 h-12 object-contain" />
              <span className="text-[28px] font-bold tracking-tight text-white mb-1">cosmi</span>
            </div>
            
            <h1 className="text-2xl font-bold text-white tracking-tight leading-tight mt-1">
              {authMode === 'login' && 'Welcome Back'}
              {authMode === 'register' && 'Create Account'}
              {authMode === 'forgot_password' && 'Restore Access'}
            </h1>
            
            <p className="text-zinc-400 text-[13px] mt-1.5 font-medium">
              {authMode === 'login' && ''}
              {authMode === 'register' && 'Establish credentials to sign up'}
              {authMode === 'forgot_password' && 'Verify your details to trigger recovery'}
            </p>
          </div>

          {/* Error messages banner with zero glow borders */}
          {errorMessage && (
            <div className="mb-6 p-3 rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 text-[12px] flex items-start gap-2.5 text-left leading-relaxed">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success messages banner */}
          {successMessage && (
            <div className="mb-6 p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 text-[12px] flex items-start gap-2.5 text-left leading-relaxed">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Core Submit Auth Form with floating variables */}
          <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
            
            {/* Email Address */}
            <div className="relative group">
              <input
                id="auth-email"
                type="email"
                required
                disabled={isLoading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                placeholder=" "
                className="peer w-full bg-[#0c0c0f] border border-[#27272a] hover:border-[#4b5563] focus:border-zinc-400 rounded-xl px-4 py-3.5 text-[14px] text-white outline-none transition-all duration-150 disabled:opacity-50"
                style={{ boxShadow: 'none' }} /* Prevent glow rings */
              />
              <label 
                htmlFor="auth-email"
                className="absolute left-3.5 top-3.5 origin-[0] -translate-y-6 scale-90 bg-[#0c0c0f] px-1.5 text-xs text-zinc-500 tracking-wide font-medium transition-all pointer-events-none
                peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-zinc-500
                peer-focus:-translate-y-6 peer-focus:scale-90 peer-focus:text-zinc-200
                group-hover:text-zinc-400 peer-focus:group-hover:text-zinc-200"
              >
                Email address*
              </label>
            </div>

            {/* Password input block */}
            {authMode !== 'forgot_password' && (
              <div className="relative group">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  placeholder=" "
                  className="peer w-full bg-[#0c0c0f] border border-[#27272a] hover:border-[#4b5563] focus:border-zinc-400 rounded-xl px-4 py-3.5 pr-11 text-[14px] text-white outline-none transition-all duration-150 disabled:opacity-50"
                  style={{ boxShadow: 'none' }}
                />
                <label 
                  htmlFor="auth-password"
                  className="absolute left-3.5 top-3.5 origin-[0] -translate-y-6 scale-90 bg-[#0c0c0f] px-1.5 text-xs text-zinc-500 tracking-wide font-medium transition-all pointer-events-none
                  peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-zinc-500
                  peer-focus:-translate-y-6 peer-focus:scale-90 peer-focus:text-zinc-200
                  group-hover:text-zinc-400 peer-focus:group-hover:text-zinc-200"
                >
                  Password*
                </label>
                
                {/* Visibility toggler button - NO GLOW */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-zinc-550 hover:text-zinc-200 transition-colors cursor-pointer select-none"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Confirm password block (Register mode only) */}
            {authMode === 'register' && (
              <div className="relative group">
                <input
                  id="auth-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  disabled={isLoading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setIsTyping(true)}
                  onBlur={() => setIsTyping(false)}
                  placeholder=" "
                  className="peer w-full bg-[#0c0c0f] border border-[#27272a] hover:border-[#4b5563] focus:border-zinc-400 rounded-xl px-4 py-3.5 pr-11 text-[14px] text-white outline-none transition-all duration-150 disabled:opacity-50"
                  style={{ boxShadow: 'none' }}
                />
                <label 
                  htmlFor="auth-confirm-password"
                  className="absolute left-3.5 top-3.5 origin-[0] -translate-y-6 scale-90 bg-[#0c0c0f] px-1.5 text-xs text-zinc-500 tracking-wide font-medium transition-all pointer-events-none
                  peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-placeholder-shown:text-zinc-500
                  peer-focus:-translate-y-6 peer-focus:scale-90 peer-focus:text-zinc-200
                  group-hover:text-zinc-400 peer-focus:group-hover:text-zinc-200"
                >
                  Confirm password*
                </label>
                
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-3.5 text-zinc-550 hover:text-zinc-200 transition-colors cursor-pointer select-none"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {/* Toggle Forgot Password / Reset view anchor link */}
            {authMode === 'login' && (
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('forgot_password');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="text-zinc-450 hover:text-zinc-250 transition-colors text-[12px] font-semibold tracking-wide cursor-pointer text-left select-none"
                >
                  Forgot your password?
                </button>
              </div>
            )}

            {/* Submit button structure - STRICTLY NO GLOW EFFECTS OR BULGING SHADOW FILTERS */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#f4f4f5] hover:bg-[#e4e4e7] active:bg-[#d4d4d8] text-[#09090b] font-semibold py-3.5 px-4 rounded-xl text-[14px] cursor-pointer transition-colors flex items-center justify-center gap-2 select-none h-12 disabled:opacity-50"
              style={{ boxShadow: 'none' }}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-zinc-400/60 border-t-zinc-900 rounded-full animate-spin" />
              ) : (
                <span>
                  {authMode === 'login' && 'Log In'}
                  {authMode === 'register' && 'Create Account'}
                  {authMode === 'forgot_password' && 'Trigger Reset Link'}
                </span>
              )}
            </button>
          </form>

          {/* Toggle login vs registration views footnotes */}
          <div className="mt-6 text-center text-xs">
            {authMode === 'login' ? (
              <span className="text-zinc-400">
                Don't have an account?{' '}
                <button
                  onClick={() => {
                    setAuthMode('register');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="text-white hover:text-zinc-300 font-bold ml-1 transition-colors cursor-pointer select-none"
                >
                  Sign up
                </button>
              </span>
            ) : (
              <span className="text-zinc-400">
                Already have an account?{' '}
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  className="text-white hover:text-zinc-300 font-bold ml-1 transition-colors cursor-pointer select-none"
                >
                  Log in
                </button>
              </span>
            )}
          </div>

          {/* Division Line separator with absolute flat styles */}
          <div className="relative flex py-5 items-center">
            <div className="flex-grow border-t border-zinc-805/80"></div>
            <span className="flex-shrink mx-4 text-[10px] font-mono text-zinc-650 font-bold uppercase tracking-wider">OR</span>
            <div className="flex-grow border-t border-zinc-805/80"></div>
          </div>

          {/* Google Single Sign On button - absolutely flat with zero glows */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-zinc-900/20 hover:bg-zinc-800/30 text-white rounded-xl text-[13px] font-semibold transition-colors duration-150 border border-zinc-800/50 disabled:opacity-50 cursor-pointer"
            style={{ boxShadow: 'none' }}
          >
            <Icon icon="logos:google-icon" className="w-3.5 h-3.5 shrink-0" />
            <span>Continue with Google</span>
          </button>

        </motion.div>

        {/* --- PROFESSIONAL FOOTER --- */}
        <div className="mt-auto w-full max-w-[420px] pb-8 pt-12 flex flex-col items-center">
          <div className="flex items-center gap-6 mb-4">
            <button className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold">Privacy</button>
            <button className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold">Terms</button>
            <button className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold">Support</button>
            <button className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest font-bold">Status</button>
          </div>
          <div className="text-[10px] text-zinc-600 font-medium tracking-wide flex items-center gap-1.5 uppercase">
            <span>© 2026 Cosmi</span>
            <span className="w-1 h-1 rounded-full bg-zinc-800"></span>
            <span>All rights reserved</span>
          </div>
        </div>
      </div>

    </div>
  );
};
