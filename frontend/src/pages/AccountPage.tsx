import React, { useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { apiClient, type CustomerUser } from '@/src/lib/api-client';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { StatusBadge } from '@/src/components/ui/StatusBadge';

interface AccountPageProps {
  user: CustomerUser;
  onUserUpdated: (user: CustomerUser) => void;
  onReEnroll: () => void;
  onLogout: () => void;
  onToast: (message: string, tone?: 'info' | 'success' | 'error') => void;
}

export function AccountPage({
  user,
  onUserUpdated,
  onReEnroll,
  onLogout,
  onToast,
}: AccountPageProps) {
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiClient.updateAccountProfile({ fullName, phone });
      onUserUpdated(res.user);
      onToast('Account profile updated', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Unable to save profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div className="border-b border-[var(--ink)] pb-4">
        <p className="font-mono text-base font-medium uppercase text-[var(--ink-muted)]">
          Member Profile
        </p>
        <h1 className="mt-1 font-display text-4xl font-black uppercase text-[var(--ink)] sm:text-5xl">
          Account
        </h1>
        <p className="mt-1 font-serif-italic text-xl text-[var(--ink-muted)]">
          Manage your contact information, voice enrollment status, and active session.
        </p>
      </div>

      <Card>
        <CardHeader className="border-b border-[var(--ink)]">
          <CardTitle className="text-3xl font-black">Profile details</CardTitle>
          <CardDescription className="font-mono text-base">Signed in as {user.email}</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="acc-name" className="block font-mono text-base font-medium text-[var(--ink)]">
                Full name
              </label>
              <Input
                id="acc-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <label htmlFor="acc-phone" className="block font-mono text-base font-medium text-[var(--ink)]">
                Mobile phone
              </label>
              <Input
                id="acc-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-[var(--ink)]">
          <CardTitle className="text-3xl font-black">Voice enrollment</CardTitle>
          <CardDescription className="font-mono text-base">
            {user.voiceEnrolledCount} of 3 phrases enrolled ·{' '}
            {user.phoneVerified ? 'Phone verified' : 'Phone pending'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-[var(--ink)]" />
            <StatusBadge
              kind={user.onboardingComplete ? 'allow' : 'step_up'}
              label={user.onboardingComplete ? 'Allow · Active' : 'Step up · Incomplete'}
            />
          </div>
          <Button variant="outline" onClick={onReEnroll}>
            Update voice setup
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="danger" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
