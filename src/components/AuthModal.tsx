import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Lock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Info,
  Eye,
  EyeOff,
  KeyRound,
  Send,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { UserProfile } from '../types';
import { getSupabaseClient, getSupabaseCredentials } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [signInMethod, setSignInMethod] = useState<'password' | 'otp'>('password');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isSettingNewPassword, setIsSettingNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Listen for Supabase password recovery event from email links
  useEffect(() => {
    if (!isOpen) return;
    const supabase = getSupabaseClient();
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsSettingNewPassword(true);
        setStatusMessage({
          type: 'info',
          text: 'You have followed a password recovery link. Please enter your new password below.',
        });
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const resolveUserProfile = async (userObj: any, userEmail: string): Promise<UserProfile> => {
    const supabase = getSupabaseClient();
    const trimmedEmail = userEmail.trim();
    let fetchedRole: 'admin' | 'user' = (userObj?.user_metadata?.role as 'admin' | 'user') || 'user';
    let fetchedName = userObj?.user_metadata?.full_name || trimmedEmail.split('@')[0];
    let fetchedAvatar = userObj?.user_metadata?.avatar_url || `https://picsum.photos/seed/${encodeURIComponent(trimmedEmail)}/100/100`;

    try {
      let scUser: any = null;
      if (userObj?.id) {
        const { data: scUserById } = await supabase
          .schema('startupcreme')
          .from('users')
          .select('id, role, full_name, avatar_url')
          .eq('id', userObj.id)
          .maybeSingle();
        if (scUserById) scUser = scUserById;
      }

      if (!scUser && trimmedEmail) {
        const { data: scUserByEmail } = await supabase
          .schema('startupcreme')
          .from('users')
          .select('id, role, full_name, avatar_url')
          .ilike('email', trimmedEmail)
          .maybeSingle();
        if (scUserByEmail) scUser = scUserByEmail;
      }

      if (scUser) {
        if (scUser.role) {
          fetchedRole = scUser.role.trim().toLowerCase() === 'admin' ? 'admin' : 'user';
        }
        if (scUser.full_name) fetchedName = scUser.full_name;
        if (scUser.avatar_url) fetchedAvatar = scUser.avatar_url;
      } else if (userObj?.id) {
        await supabase
          .schema('startupcreme')
          .from('users')
          .insert({
            id: userObj.id,
            email: trimmedEmail,
            full_name: fetchedName,
            avatar_url: fetchedAvatar,
            role: fetchedRole,
          });
      }
    } catch (e) {
      console.warn('DB profile fetch error:', e);
    }

    return {
      id: userObj?.id || `user-${Date.now()}`,
      email: trimmedEmail,
      full_name: fetchedName,
      avatar_url: fetchedAvatar,
      role: fetchedRole,
      created_at: userObj?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (isSignUp && !fullName.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your Full Name for Sign Up.' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    const supabase = getSupabaseClient();
    const currentCreds = getSupabaseCredentials();

    if (!currentCreds.isConfigured) {
      setStatusMessage({
        type: 'info',
        text: 'Supabase is not configured yet with live project credentials.',
      });
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        if (!password) {
          setStatusMessage({ type: 'error', text: 'Please enter a password for your account.' });
          setLoading(false);
          return;
        }

        // 1. Check if email exists in database
        try {
          const { data: existingDbUser } = await supabase
            .schema('startupcreme')
            .from('users')
            .select('id, email')
            .ilike('email', email.trim())
            .maybeSingle();

          if (existingDbUser) {
            setStatusMessage({
              type: 'info',
              text: 'This email address is already registered. Please sign in with your password instead.',
            });
            setIsSignUp(false);
            setLoading(false);
            return;
          }
        } catch (checkErr) {
          console.warn('Pre-signup email check error:', checkErr);
        }

        // 2. Register in Supabase Auth
        const computedName = fullName.trim() || email.split('@')[0];
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              full_name: computedName,
              role: 'user',
              avatar_url: `https://picsum.photos/seed/${encodeURIComponent(email.trim())}/100/100`,
            },
          },
        });

        if (error) {
          const isAlreadyRegistered = 
            error.message.toLowerCase().includes('already registered') ||
            error.message.toLowerCase().includes('already in use') ||
            error.message.toLowerCase().includes('already exists') ||
            error.status === 422;

          if (isAlreadyRegistered) {
            setStatusMessage({
              type: 'info',
              text: 'This email address is already registered. Please sign in with your password instead.',
            });
            setIsSignUp(false);
          } else {
            setStatusMessage({ type: 'error', text: `Registration Error: ${error.message}` });
          }
          setLoading(false);
          return;
        }

        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setStatusMessage({
            type: 'info',
            text: 'This email address is already registered. Please sign in with your password instead.',
          });
          setIsSignUp(false);
          setLoading(false);
          return;
        }

        const userProfile = await resolveUserProfile(data.user, email);

        if (data.session) {
          setStatusMessage({
            type: 'success',
            text: 'Account created successfully! Signing you in...',
          });
          setTimeout(() => {
            onSelectUser(userProfile);
            onClose();
          }, 1200);
        } else {
          setStatusMessage({
            type: 'success',
            text: 'Account created! Please check your email inbox to confirm your address before signing in.',
          });
          setTimeout(() => {
            setIsSignUp(false);
          }, 2500);
        }

      } else {
        // Sign In with Password Mode
        if (!password) {
          setStatusMessage({ type: 'error', text: 'Please enter your password.' });
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (error) {
          const errorMsg = error.message.toLowerCase();
          const isInvalidCreds = errorMsg.includes('invalid login credentials') || errorMsg.includes('invalid credentials');
          const isEmailNotConfirmed = errorMsg.includes('email not confirmed');
          const isRateLimited = errorMsg.includes('too many') || (error as any).status === 429;

          if (isEmailNotConfirmed) {
            setStatusMessage({ 
              type: 'error', 
              text: 'Email address has not been confirmed yet. Please check your inbox for the confirmation link sent by Supabase.' 
            });
          } else if (isRateLimited) {
            setStatusMessage({
              type: 'error',
              text: 'Too many login attempts. Please wait 60 seconds before trying again.'
            });
          } else if (isInvalidCreds) {
            setStatusMessage({
              type: 'error',
              text: `Invalid login credentials for "${email.trim()}". The password entered does not match what is stored in Supabase. You can verify what was typed, sign in with an Email Code, or reset your password.`
            });
          } else {
            setStatusMessage({ 
              type: 'error', 
              text: `Sign In Error: ${error.message}` 
            });
          }

          setLoading(false);
          return;
        }

        const userProfile = await resolveUserProfile(data.user, email);
        setStatusMessage({ type: 'success', text: `Signed in successfully as ${userProfile.role.toUpperCase()}!` });
        setTimeout(() => {
          onSelectUser(userProfile);
          onClose();
        }, 800);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Authentication request failed' });
    } finally {
      setLoading(false);
    }
  };

  // Passwordless Email OTP Flow
  const handleSendOtp = async () => {
    if (!email.trim()) {
      setStatusMessage({ type: 'info', text: 'Please enter your email address first.' });
      return;
    }
    setLoading(true);
    setStatusMessage(null);
    const supabase = getSupabaseClient();

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        setStatusMessage({ type: 'error', text: `Failed to send code: ${error.message}` });
      } else {
        setOtpSent(true);
        setStatusMessage({ 
          type: 'success', 
          text: `One-Time Login Code & Magic Link sent to ${email.trim()}! Check your inbox or spam folder.` 
        });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e?.message || 'Failed to send login code' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !otpCode.trim()) return;

    setLoading(true);
    setStatusMessage(null);
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode.trim(),
        type: 'email',
      });

      if (error) {
        setStatusMessage({ type: 'error', text: `Code Verification Error: ${error.message}` });
      } else if (data?.user) {
        const userProfile = await resolveUserProfile(data.user, email);
        setStatusMessage({ type: 'success', text: `Verified! Signed in as ${userProfile.role.toUpperCase()}.` });
        setTimeout(() => {
          onSelectUser(userProfile);
          onClose();
        }, 800);
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e?.message || 'Verification failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setStatusMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    setLoading(true);
    setStatusMessage(null);
    const supabase = getSupabaseClient();

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setStatusMessage({ type: 'error', text: `Failed to update password: ${error.message}` });
      } else if (data?.user) {
        const userProfile = await resolveUserProfile(data.user, data.user.email || email);
        setStatusMessage({ type: 'success', text: 'Password updated successfully! Signing you in...' });
        setIsSettingNewPassword(false);
        setTimeout(() => {
          onSelectUser(userProfile);
          onClose();
        }, 1000);
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e?.message || 'Failed to update password' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setStatusMessage({ type: 'info', text: 'Please enter your email address in the field above first.' });
      return;
    }
    setLoading(true);
    const supabase = getSupabaseClient();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) {
        setStatusMessage({ type: 'error', text: `Password Reset Error: ${error.message}` });
      } else {
        setStatusMessage({ type: 'success', text: `Password reset link sent to ${email.trim()}! Please check your inbox and click the link to set a new password.` });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e?.message || 'Failed to send reset email' });
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      setStatusMessage({ type: 'info', text: 'Please enter your email address in the field above first.' });
      return;
    }
    setLoading(true);
    const supabase = getSupabaseClient();
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (error) {
        setStatusMessage({ type: 'error', text: `Resend Error: ${error.message}` });
      } else {
        setStatusMessage({ type: 'success', text: `Confirmation email resent to ${email.trim()}! Please check your inbox and spam folder.` });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e?.message || 'Failed to resend confirmation email' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto p-5 sm:p-8 shadow-2xl relative text-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Branding */}
        <div className="text-center mb-5">
          <img 
            src="/logo.jpg" 
            alt="StartupCrème Logo" 
            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm mx-auto mb-3"
          />
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {isSettingNewPassword 
              ? 'Set New Password' 
              : isSignUp 
              ? 'Create Account' 
              : 'Sign In'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            {isSettingNewPassword
              ? 'Enter your new password to complete account recovery.'
              : isSignUp 
              ? 'Register your account with Supabase to publish articles and manage topics.' 
              : 'Welcome back! Sign in to access your dashboard and publications.'
            }
          </p>
        </div>

        {/* Mode Switch Tabs (Sign Up / Sign In) */}
        {!isSettingNewPassword && (
          <div className="flex bg-slate-100 p-1 rounded-xl mb-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setStatusMessage(null);
                setOtpSent(false);
              }}
              className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                isSignUp ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setStatusMessage(null);
              }}
              className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                !isSignUp ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
          </div>
        )}

        {/* Sign In Method Toggle: Password vs Email Code/OTP */}
        {!isSignUp && !isSettingNewPassword && (
          <div className="flex items-center justify-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => {
                setSignInMethod('password');
                setStatusMessage(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                signInMethod === 'password'
                  ? 'bg-cyan-50 text-cyan-800 border border-cyan-300 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              <KeyRound className="w-3 h-3 inline-block mr-1.5 text-cyan-600" />
              Password
            </button>
            <button
              type="button"
              onClick={() => {
                setSignInMethod('otp');
                setStatusMessage(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                signInMethod === 'otp'
                  ? 'bg-cyan-50 text-cyan-800 border border-cyan-300 font-semibold'
                  : 'text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              <Sparkles className="w-3 h-3 inline-block mr-1.5 text-amber-500" />
              Email Code / Magic Link
            </button>
          </div>
        )}

        {/* Status Alert Banner */}
        {statusMessage && (
          <div className={`mb-4 p-3.5 rounded-xl text-xs flex flex-col gap-2.5 border ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
              : statusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}>
            <div className="flex items-start gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : statusMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              )}
              <span className="font-medium leading-relaxed">{statusMessage.text}</span>
            </div>

            {/* Quick Action Recovery Suggestions */}
            {(statusMessage.type === 'error' || statusMessage.type === 'info') && (
              <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-2 mt-1">
                {!isSignUp && !isSettingNewPassword && (
                  <>
                    {signInMethod === 'password' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setShowPassword(true)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md font-medium text-[11px] transition-colors cursor-pointer"
                        >
                          Show Password
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSignInMethod('otp');
                            setStatusMessage(null);
                            handleSendOtp();
                          }}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md font-semibold text-[11px] transition-colors cursor-pointer"
                        >
                          Sign in with Email Code
                        </button>
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 rounded-md font-semibold text-[11px] transition-colors cursor-pointer"
                        >
                          Reset Password
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md font-medium text-[11px] transition-colors cursor-pointer"
                    >
                      Resend Confirmation
                    </button>
                  </>
                )}
                {isSignUp && statusMessage.text.toLowerCase().includes('already') && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(false);
                      setStatusMessage(null);
                    }}
                    className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md font-semibold text-[11px] transition-colors cursor-pointer"
                  >
                    Proceed to Sign In
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 1. Setting New Password Form (Recovery) */}
        {isSettingNewPassword ? (
          <form onSubmit={handleSetNewPassword} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-600 uppercase font-bold mb-1">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-cyan-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 min-h-[44px]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Update Password & Sign In</span>}
            </button>
            <button
              type="button"
              onClick={() => setIsSettingNewPassword(false)}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
          </form>
        ) : !isSignUp && signInMethod === 'otp' ? (
          /* 2. Email Code / OTP Form */
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono text-slate-600 uppercase font-bold mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            {!otpSent ? (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading || !email.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 min-h-[44px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Login Code to Email</span>
                  </>
                )}
              </button>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4 pt-2">
                <div>
                  <label className="block text-[11px] font-mono text-slate-600 uppercase font-bold mb-1">
                    6-8 Digit Code from Email
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.trim())}
                      placeholder="123456"
                      autoFocus
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 tracking-widest font-mono text-base focus:outline-none focus:bg-white focus:border-cyan-500 transition-colors"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Check your email inbox or spam folder for the code. You can also click the link directly in the email.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !otpCode.trim()}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 min-h-[44px]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Verify Code & Sign In</span>
                  )}
                </button>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="text-[11px] text-cyan-600 hover:underline font-medium cursor-pointer"
                  >
                    Resend Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignInMethod('password')}
                    className="text-[11px] text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    Switch to Password Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* 3. Standard Email + Password Form */
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {/* Full Name field (Sign Up Only) */}
            {isSignUp && (
              <div>
                <label className="block text-[11px] font-mono text-slate-600 uppercase font-bold mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    required={isSignUp}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-[11px] font-mono text-slate-600 uppercase font-bold mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-mono text-slate-600 uppercase font-bold">
                  Password
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[11px] text-cyan-600 hover:text-cyan-700 hover:underline font-medium cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-cyan-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isSignUp ? 'Creating Account...' : 'Signing In...'}</span>
                </>
              ) : (
                <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
              )}
            </button>
          </form>
        )}

        {/* Toggle Mode Footer */}
        {!isSettingNewPassword && (
          <div className="mt-5 text-center">
            <p className="text-xs text-slate-500">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setStatusMessage(null);
                  setOtpSent(false);
                }}
                className="text-cyan-600 font-bold hover:underline cursor-pointer"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
