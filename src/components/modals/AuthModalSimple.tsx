import type React from 'react';
import { useState } from 'react';
import { Mail, Lock, Navigation, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

function AuthModalSimple({ onClose }: { onClose: () => void }) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setError(null);
    setLoading(true);
    const result =
      mode === 'signin'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
    setLoading(false);
    if (result.success) onClose();
    else setError(result.error || 'Authentication failed.');
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    const result = await signInWithGoogle();
    setLoading(false);
    if (result.success) onClose();
    else setError(result.error || 'Google sign-in failed.');
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !loading) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        <DialogDescription className="sr-only">
          Authentication dialog for signing in or creating an account
        </DialogDescription>
        {/* Top accent bar */}
        <div
          className="h-1 w-full"
          style={{ background: 'linear-gradient(90deg, #0f766e, #14b8a6)' }}
        />

        <div className="px-8 pt-7 pb-6">
          {/* Header */}
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <Navigation className="w-3 h-3 text-primary" />
              </div>
              <span className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-muted-foreground">
                Itinerary
              </span>
            </div>
            <DialogTitle className="text-[22px] font-extrabold text-foreground tracking-tight leading-none">
              {mode === 'signin' ? 'Welcome back' : 'Get started'}
            </DialogTitle>
            <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">
              {mode === 'signin' ? 'Sign in to sync your trips' : 'Create your free account'}
            </p>
          </DialogHeader>

          {/* Mode tabs */}
          <div className="flex gap-4 mb-5 border-b border-border">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`pb-3 text-[11px] font-extrabold tracking-wider uppercase transition-all border-b-2 -mb-px ${
                  mode === m
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                className="pl-10 pr-4 py-2.5 text-sm bg-muted border border-border rounded-xl focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground/50 font-medium text-foreground"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 py-2.5 text-sm bg-muted border border-border rounded-xl focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground/50 font-medium text-foreground"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 rounded"
              >
                {showPassword ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {mode === 'signup' && password.length > 0 && password.length < 6 && (
              <p className="text-[11px] text-warning font-medium">
                Password should be at least 6 characters
              </p>
            )}

            {error && (
              <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-3.5 py-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-600 font-semibold leading-relaxed">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-extrabold text-white rounded-xl transition-all disabled:opacity-50 relative overflow-hidden group mt-1"
              style={{
                background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
                boxShadow: '0 4px 14px -2px rgba(15,118,110,0.4)',
              }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Please wait…
                  </>
                ) : mode === 'signin' ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </span>
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
            </button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest">
              or
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted hover:border-border transition-all disabled:opacity-50 flex items-center justify-center gap-2.5"
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>

          <p className="text-[11px] text-center text-muted-foreground mt-4">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signin' ? 'signup' : 'signin');
                setError(null);
              }}
              className="text-primary font-bold hover:underline"
            >
              {mode === 'signin' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AuthModalSimple;
