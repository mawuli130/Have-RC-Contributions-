import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Mail, ShieldAlert, UserPlus } from 'lucide-react';
import { Alert, ScreenHeader } from '../components/ui';
import { ServiceError, requestPasswordReset, signIn, signUp } from '../services/databaseService';
import { DEMO_ACCOUNTS } from '../services/localStore';

export function LoginScreen({
  onBack,
  onSuccess,
  onRegister,
}: {
  onBack: () => void;
  onSuccess: () => void;
  onRegister: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      signIn(email, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Login failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
  };

  return (
    <div className="app-shell min-h-screen">
      <ScreenHeader title="Login" subtitle="Welcome back to the group" onBack={onBack} />
      <div className="px-4 pt-4">
        {error ? (
          <div className="mb-3">
            <Alert tone="error" title="Could not sign in" onClose={() => setError(null)}>
              {error}
            </Alert>
          </div>
        ) : null}
        {info ? (
          <div className="mb-3">
            <Alert tone="success" onClose={() => setInfo(null)}>
              {info}
            </Alert>
          </div>
        ) : null}

        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <label className="label" htmlFor="login-email">
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="login-password">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="input pr-12"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="button" onClick={() => setShowForgot(true)} className="text-[13px] font-semibold text-navy-700 underline">
            Forgot your password?
          </button>

          <button type="submit" className="btn-primary" disabled={busy} data-testid="login-submit">
            {busy ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
            Login
          </button>
        </form>

        <button type="button" onClick={onRegister} className="btn-ghost mt-2.5">
          <UserPlus size={16} />
          I don&apos;t have an account yet
        </button>

        <div className="mt-6 rounded-2xl border border-[#E8EEF7] bg-white p-3.5">
          <p className="text-[12.5px] font-bold uppercase tracking-wide text-navy-700">Demo accounts</p>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
            This build runs on an offline demo database so you can explore every role. Tap an account to
            fill the form.
          </p>
          <div className="mt-2.5 space-y-1.5">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillDemo(acc.email, acc.password)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#E8EEF7] bg-[#F7FAFE] px-3 py-2 text-left"
              >
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold text-navy-950">{acc.label}</span>
                  <span className="block truncate text-[11.5px] text-slate-500">{acc.email}</span>
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-navy-600">{acc.password}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {showForgot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4">
          <div className="w-full max-w-[400px] rounded-2xl bg-white p-4">
            <h2 className="text-[16px] font-bold text-navy-950">Reset your password</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
              Enter your email address. If it is registered, we will send a reset link to it.
            </p>
            <input
              type="email"
              className="input mt-3"
              placeholder="you@example.com"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
            />
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-outline flex-1" onClick={() => setShowForgot(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => {
                  setInfo(requestPasswordReset(forgotEmail));
                  setShowForgot(false);
                }}
              >
                Send link
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RegisterScreen({
  onBack,
  onRegistered,
  onLogin,
}: {
  onBack: () => void;
  onRegistered: (fullName: string) => void;
  onLogin: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const session = signUp({ fullName, email, password, phone, acceptedPrivacy: accepted });
      onRegistered(session.profile.full_name);
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Registration failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell min-h-screen">
      <ScreenHeader title="Join the Group" subtitle="Create your member account" onBack={onBack} />
      <div className="px-4 pt-4">
        {error ? (
          <div className="mb-3">
            <Alert tone="error" title="Please check the form" onClose={() => setError(null)}>
              {error}
            </Alert>
          </div>
        ) : null}

        <form onSubmit={submit} className="space-y-3.5" data-testid="register-form">
          <div>
            <label className="label" htmlFor="reg-name">
              Full name
            </label>
            <input
              id="reg-name"
              className="input"
              placeholder="e.g. Kwame Mensah"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="reg-email">
              Email address
            </label>
            <input
              id="reg-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="reg-phone">
              Phone number <span className="font-normal normal-case text-slate-400">(optional)</span>
            </label>
            <input
              id="reg-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="input"
              placeholder="024 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="reg-password">
              Password
            </label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="input pr-12"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="field-help">Use at least 8 characters. This protects your account.</p>
          </div>

          <div>
            <label className="label" htmlFor="reg-confirm">
              Confirm password
            </label>
            <input
              id="reg-confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="input"
              placeholder="Type it again"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          <div className="rounded-2xl border border-[#E8EEF7] bg-white p-3.5">
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-navy-950">
              <Mail size={15} className="text-navy-600" />
              Privacy notice
            </p>
            <ul className="mt-1.5 space-y-1.5 text-[12.5px] leading-relaxed text-slate-600">
              <li>
                • Your name, verified contribution total, outstanding balance and payment status will be
                visible to other <strong>approved</strong> members of the group.
              </li>
              <li>• Your email, phone number, receipts, transaction references and notes stay private.</li>
              <li>• The treasurer and administrators can see your payment submissions to verify them.</li>
              <li>• You can ask an administrator to correct any record that is wrong.</li>
            </ul>
            <label className="mt-2.5 flex items-start gap-2.5 rounded-xl bg-[#F7FAFE] p-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-[#C7D6EA] accent-navy-900"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                data-testid="register-privacy"
                required
              />
              <span className="text-[12.5px] font-medium leading-snug text-navy-900">
                I understand and accept the privacy notice above.
              </span>
            </label>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-[#FFFBF0] p-3 border border-[#EFE0BC]">
            <ShieldAlert size={15} className="mt-0.5 shrink-0 text-[#8A5A08]" />
            <p className="text-[12px] leading-relaxed text-[#7A5A20]">
              After registering, your account will show <strong>Awaiting Approval</strong>. Group
              financial information becomes visible once an administrator approves you.
            </p>
          </div>

          <button type="submit" className="btn-gold" disabled={busy} data-testid="register-submit">
            {busy ? <Loader2 size={17} className="animate-spin" /> : <UserPlus size={17} />}
            Create my account
          </button>
        </form>

        <button type="button" onClick={onLogin} className="btn-ghost mt-2.5">
          <ArrowLeft size={16} />
          I already have an account
        </button>
      </div>
    </div>
  );
}
