import React, { useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { apiClient, ApiError, type CustomerUser } from '@/src/lib/api-client';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';

interface AuthPagesProps {
  mode: 'login' | 'register' | 'forgot';
  onNavigate: (route: string) => void;
  onAuthenticated: (user: CustomerUser) => void;
  onToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
  onOfflineDetected: (offline: boolean) => void;
}

export function AuthPages({
  mode,
  onNavigate,
  onAuthenticated,
  onToast,
  onOfflineDetected,
}: AuthPagesProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.includes('@') || !password) {
      setError('Please enter both your email address and password.');
      return;
    }
    setLoading(true);
    try {
      const { user } = await apiClient.login({ email, password });
      onOfflineDetected(false);
      onToast(user.voiceVerificationRequired ? 'Password accepted. Verify your voice to finish signing in.' : `Welcome back, ${user.fullName.split(' ')[0]}`, user.voiceVerificationRequired ? 'info' : 'success');
      onAuthenticated(user);
    } catch (err) {
      if (err instanceof ApiError && err.isOffline) onOfflineDetected(true);
      setError(err instanceof Error ? err.message : 'Unable to sign in right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { user } = await apiClient.login({
        email: 'alex.mercer@sentinelbank.example',
        password: 'SentinelDemo2026!',
      });
      onOfflineDetected(false);
      onToast('Signed in to demo customer account', 'success');
      onAuthenticated(user);
    } catch (err) {
      if (err instanceof ApiError && err.isOffline) onOfflineDetected(true);
      setError(err instanceof Error ? err.message : 'Unable to reach demo account.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setLoading(true);
    try {
      const { user } = await apiClient.register({ fullName, email, password, phone });
      onOfflineDetected(false);
      onToast('Account created. Let us set up your voice protection.', 'success');
      onAuthenticated(user);
    } catch (err) {
      if (err instanceof ApiError && err.isOffline) onOfflineDetected(true);
      setError(err instanceof Error ? err.message : 'Unable to create your account.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setForgotSuccess(null);
    if (!email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.forgotPassword(email);
      onOfflineDetected(false);
      setForgotSuccess(res.message);
    } catch (err) {
      if (err instanceof ApiError && err.isOffline) onOfflineDetected(true);
      setError(err instanceof Error ? err.message : 'Unable to send reset email right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-80px)] max-w-lg flex-col justify-center px-4 py-12">
      <button
        type="button"
        onClick={() => onNavigate('/')}
        className="mb-6 inline-flex w-fit items-center gap-2 font-mono text-base font-medium text-[var(--ink-muted)] hover:text-[var(--ink)] hover:underline underline-offset-4 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Sentinel overview
      </button>

      <Card>
        <CardHeader className="border-b border-[var(--ink)]">
          <div className="mb-2 flex h-10 w-10 items-center justify-center border border-[var(--ink)] text-[var(--ink)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle className="text-4xl font-black">
            {mode === 'login' && 'Sign in'}
            {mode === 'register' && 'Create account'}
            {mode === 'forgot' && 'Reset password'}
          </CardTitle>
          <CardDescription className="font-serif-italic text-lg">
            {mode === 'login' && 'Access your protected banking assistant and security settings.'}
            {mode === 'register' && 'Create an account, then enroll your vocal signature in two minutes.'}
            {mode === 'forgot' && 'Enter your account email to request a recovery link.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          {error && (
            <div
              role="alert"
              className="mb-4 border border-[var(--accent-red)] bg-[var(--accent-red)] px-4 py-3 font-mono text-base font-medium text-[var(--bg-paper)]"
            >
              {error}
            </div>
          )}

          {forgotSuccess && (
            <div
              role="status"
              className="mb-4 border border-[var(--ink)] bg-[var(--bg-paper)] px-4 py-3 font-mono text-base text-[var(--ink)]"
            >
              {forgotSuccess}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block font-mono text-base font-medium text-[var(--ink)]">
                  Email address
                </label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="login-password" className="block font-mono text-base font-medium text-[var(--ink)]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => onNavigate('/forgot-password')}
                    className="font-mono text-base text-[var(--ink-muted)] hover:text-[var(--ink)] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>

              <div className="border-t border-[var(--ink)] pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleDemoLogin}
                  disabled={loading}
                >
                  Use demo customer account
                </Button>
                <p className="mt-2 text-center font-mono text-base text-[var(--ink-muted)]">
                  Demo passphrase: cedar river horizon
                </p>
              </div>

              <p className="text-center text-base text-[var(--ink-muted)]">
                New to Sentinel?{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('/register')}
                  className="font-medium text-[var(--ink)] underline underline-offset-4 cursor-pointer"
                >
                  Create an account
                </button>
              </p>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="reg-name" className="block font-mono text-base font-medium text-[var(--ink)]">
                  Full name
                </label>
                <Input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Alex Mercer"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <label htmlFor="reg-email" className="block font-mono text-base font-medium text-[var(--ink)]">
                  Email address
                </label>
                <Input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <label htmlFor="reg-phone" className="block font-mono text-base font-medium text-[var(--ink)]">
                  Mobile number
                </label>
                <Input
                  id="reg-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+1 (555) 014-8820"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <label htmlFor="reg-password" className="block font-mono text-base font-medium text-[var(--ink)]">
                  Password (8+ characters)
                </label>
                <Input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Continue to voice setup'}
              </Button>

              <p className="text-center text-base text-[var(--ink-muted)]">
                Already enrolled?{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="font-medium text-[var(--ink)] underline underline-offset-4 cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block font-mono text-base font-medium text-[var(--ink)]">
                  Account email address
                </label>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending...' : 'Send recovery link'}
              </Button>

              <p className="text-center text-base text-[var(--ink-muted)]">
                Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('/login')}
                  className="font-medium text-[var(--ink)] underline underline-offset-4 cursor-pointer"
                >
                  Back to sign in
                </button>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
