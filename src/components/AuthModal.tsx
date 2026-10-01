import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Mail,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Info,
  Eye,
  EyeOff,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { UserProfile } from '../types';
import { getSupabaseClient, getSupabaseCredentials } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: UserProfile) => void;
}

type ResetFlowStep = 'idle' | 'verify_code' | 'new_password';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSelectUser,
}) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [resetStep, setResetStep] = useState<ResetFlowStep>('idle');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Listen for Supabase password recovery event if opened via link
  useEffect(() => {
    if (!isOpen) return;
    const supabase = getSupabaseClient();
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setResetStep('new_password');
        setStatusMessage({
          type: 'info',
          text: 'Enter your new password below.',
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

    // 1. Authoritative resolution via server endpoint with service_role
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        const resp = await fetch('/api/auth/profile', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (resp.ok) {
          const profile = await resp.json();
          if (profile && profile.role) {
            return {
              id: profile.id || userObj?.id || `user-${Date.now()}`,
              email: profile.email || trimmedEmail,
              full_name:
                profile.full_name ||
                userObj?.user_metadata?.full_name ||
                trimmedEmail.split('@')[0],
              avatar_url:
                profile.avatar_url ||
                userObj?.user_metadata?.avatar_url ||
                `https://picsum.photos/seed/${encodeURIComponent(trimmedEmail)}/100/100`,
              role: profile.role === 'admin' ? 'admin' : 'user',
              created_at: profile.created_at || userObj?.created_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          }
        }
      }
    } catch (apiErr) {
      console.warn('Authoritative profile fetch error in modal, using DB fallback:', apiErr);
    }

    let fetchedRole: 'admin' | 'user' =
      (userObj?.user_metadata?.role as 'admin' | 'user') || 'user';
    let fetchedName = userObj?.user_metadata?.full_name || trimmedEmail.split('@')[0];
    let fetchedAvatar =
      userObj?.user_metadata?.avatar_url ||
      `https://picsum.photos/seed/${encodeURIComponent(trimmedEmail)}/100/100`;

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
    if (!email.trim()) return;
    if (isSignUp && !fullName.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your full name.' });
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
          setStatusMessage({ type: 'error', text: 'Please enter a password.' });
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
              text: 'This email address is already registered. Please sign in instead.',
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
          password,
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
              text: 'This email address is already registered. Please sign in instead.',
            });
            setIsSignUp(false);
          } else {
            setStatusMessage({ type: 'error', text: error.message });
          }
          setLoading(false);
          return;
        }

        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setStatusMessage({
            type: 'info',
            text: 'This email address is already registered. Please sign in instead.',
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
          }, 1000);
        } else {
          setStatusMessage({
            type: 'success',
            text: 'Account created! Please check your email to confirm your address before signing in.',
          });
          setTimeout(() => {
            setIsSignUp(false);
          }, 2000);
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
          password,
        });

        if (error) {
          const errorMsg = error.message.toLowerCase();
          if (errorMsg.includes('email not confirmed')) {
            setStatusMessage({
              type: 'error',
              text: 'Please confirm your email address using the link sent to your inbox.',
            });
          } else if (errorMsg.includes('invalid login credentials') || errorMsg.includes('invalid credentials')) {
            setStatusMessage({
              type: 'error',
              text: 'Incorrect email or password.',
            });
          } else {
            setStatusMessage({
              type: 'error',
              text: error.message,
            });
          }
          setLoading(false);
          return;
        }

        const userProfile = await resolveUserProfile(data.user, email);
        setStatusMessage({
          type: 'success',
          text: 'Signed in successfully!',
        });
        setTimeout(() => {
          onSelectUser(userProfile);
          onClose();
        }, 700);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Authentication failed.' });
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Click "Forgot password?" -> Send 6-digit recovery code and open the 6-digit code input UI
  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setStatusMessage({
        type: 'error',
        text: 'Please enter your email address first.',
      });
      return;
    }

    // Immediately show the 6-digit code verification field in the UI
    setResetStep('verify_code');
    setOtpCode('');
    setLoading(true);
    setStatusMessage(null);

    const supabase = getSupabaseClient();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: window.location.origin,
      });

      if (error) {
        const lower = error.message.toLowerCase();
        // If Supabase rate-limits because a code was already sent within the last 60 seconds,
        // keep the 6-digit input open so the user can enter the code already in their inbox.
        if (lower.includes('security purposes') || lower.includes('after') || error.status === 429) {
          setStatusMessage({
            type: 'info',
            text: `A 6-digit verification code was already sent to ${trimmedEmail}. Please enter it below.`,
          });
        } else {
          setStatusMessage({
            type: 'error',
            text: error.message,
          });
        }
      } else {
        setStatusMessage({
          type: 'success',
          text: `A 6-digit verification code has been sent to ${trimmedEmail}. Enter it below to reset your password.`,
        });
      }
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: e?.message || 'Failed to send verification code.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify the 6-digit code -> Transition to Set New Password screen
  const handleVerifyResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const cleanCode = otpCode.replace(/\s+/g, '');

    if (!trimmedEmail) {
      setStatusMessage({ type: 'error', text: 'Please enter your email address.' });
      return;
    }
    if (cleanCode.length !== 6) {
      setStatusMessage({ type: 'error', text: 'Please enter the 6-digit verification code.' });
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    const supabase = getSupabaseClient();

    try {
      // Verify 6-digit recovery OTP token
      let { data, error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: cleanCode,
        type: 'recovery',
      });

      // Fallback in case the Supabase project template issued a standard email OTP token
      if (error) {
        const fallback = await supabase.auth.verifyOtp({
          email: trimmedEmail,
          token: cleanCode,
          type: 'email',
        });
        if (!fallback.error) {
          data = fallback.data;
          error = null;
        }
      }

      if (error) {
        setStatusMessage({
          type: 'error',
          text: 'Invalid or expired 6-digit code. Please check your email and try again.',
        });
      } else if (data?.session || data?.user) {
        setResetStep('new_password');
        setNewPassword('');
        setConfirmNewPassword('');
        setStatusMessage({
          type: 'success',
          text: 'Code verified! Enter your new password below.',
        });
      }
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: e?.message || 'Failed to verify code.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Submit the new password
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setStatusMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setStatusMessage({ type: 'error', text: 'Passwords do not match.' });
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
        setStatusMessage({ type: 'error', text: error.message });
      } else if (data?.user) {
        const userProfile = await resolveUserProfile(data.user, data.user.email || email);
        setStatusMessage({
          type: 'success',
          text: 'Password reset successfully! Signing you in...',
        });
        setTimeout(() => {
          setResetStep('idle');
          onSelectUser(userProfile);
          onClose();
        }, 900);
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e?.message || 'Failed to update password.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto p-5 sm:p-8 shadow-2xl relative text-slate-800 animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
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
            {resetStep === 'verify_code'
              ? 'Verify Reset Code'
              : resetStep === 'new_password'
              ? 'Reset Password'
              : isSignUp
              ? 'Create Account'
              : 'Sign In'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            {resetStep === 'verify_code'
              ? 'Enter the 6-digit verification code sent to your email address.'
              : resetStep === 'new_password'
              ? 'Create a new password for your account.'
              : isSignUp
              ? 'Register your account to publish articles and join discussions.'
              : 'Welcome back! Sign in to access your dashboard and publications.'}
          </p>
        </div>

        {/* Mode Switch Tabs (Sign Up / Sign In) - Hidden during password reset */}
        {resetStep === 'idle' && (
          <div className="flex bg-slate-100 p-1 rounded-xl mb-5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setStatusMessage(null);
              }}
              className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                isSignUp
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
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
                !isSignUp
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
          </div>
        )}

        {/* Clean Status Alert Banner (No extra button clutter) */}
        {statusMessage && (
          <div
            className={`mb-4 p-3.5 rounded-xl text-xs flex items-start gap-2.5 border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-900 border-rose-200'
                : 'bg-blue-50 text-blue-900 border-blue-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            )}
            <span className="font-medium leading-relaxed">{statusMessage.text}</span>
          </div>
        )}

        {/* VIEW 1: 6-Digit Code Verification (After clicking "Forgot password?") */}
        {resetStep === 'verify_code' ? (
          <form onSubmit={handleVerifyResetCode} className="space-y-4">
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

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-mono text-slate-600 uppercase font-bold">
                  6-Digit Verification Code
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-[11px] text-cyan-600 hover:text-cyan-700 hover:underline font-medium cursor-pointer disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-base font-mono font-bold tracking-[0.35em] text-slate-900 placeholder-slate-300 focus:outline-none focus:bg-white focus:border-cyan-500 transition-colors tabular-nums"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <span>Verify Code & Continue</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setResetStep('idle');
                setOtpCode('');
                setStatusMessage(null);
              }}
              className="w-full pt-1 flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </button>
          </form>
        ) : resetStep === 'new_password' ? (
          /* VIEW 2: Set New Password Form (After 6-digit code is verified) */
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
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-cyan-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-600 uppercase font-bold mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Resetting Password...</span>
                </>
              ) : (
                <span>Reset Password</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setResetStep('idle');
                setStatusMessage(null);
              }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </form>
        ) : (
          /* VIEW 3: Standard Email + Password Form */
          <form onSubmit={handleAuthSubmit} className="space-y-4">
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

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-mono text-slate-600 uppercase font-bold">
                  Password
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={loading}
                    className="text-[11px] text-cyan-600 hover:text-cyan-700 hover:underline font-medium cursor-pointer disabled:opacity-50"
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
        {resetStep === 'idle' && (
          <div className="mt-5 text-center">
            <p className="text-xs text-slate-500">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setStatusMessage(null);
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
