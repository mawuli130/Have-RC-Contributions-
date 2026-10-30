import React, { useState } from 'react';
import { Check, KeyRound, Loader2, Save } from 'lucide-react';
import { Alert, Avatar, ScreenHeader, SectionHeader, type PickedFile } from '../components/ui';
import { useApp } from '../context/AppContext';
import { ServiceError, changeMyPassword, getSessionUser, updateMyProfile } from '../services/databaseService';
import { isLiveSupabaseConfigured } from '../services/supabaseClient';
import { liveChangeMyPassword, liveUpdateMyProfile } from '../services/liveAuth';
import { downscaleAvatarImage } from '../utils/image';

export function ProfileEditScreen() {
  const { goBack, session, setSession, toast } = useApp();
  const [fullName, setFullName] = useState(session?.profile.full_name ?? '');
  const [phone, setPhone] = useState(session?.profile.phone ?? '');
  const [avatar, setAvatar] = useState<string | null>(session?.profile.avatar_url ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError('Please choose a photo smaller than 8 MB.');
      return;
    }
    // Shrink before storing: full-size photos overflow browser storage
    // and used to disappear on refresh.
    const dataUrl = await downscaleAvatarImage(file);
    if (dataUrl) setAvatar(dataUrl);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isLiveSupabaseConfigured) {
        // Live mode: the Supabase profile is the source of truth — saving
        // only locally is exactly what made photos vanish on refresh.
        const updated = await liveUpdateMyProfile({
          fullName,
          phone: phone || null,
          avatarDataUrl: avatar,
        });
        setSession(updated);
      } else {
        updateMyProfile({ fullName, phone, avatarDataUrl: avatar });
        const latest = getSessionUser();
        if (latest) setSession(latest);
      }
      toast.success('Profile updated.');
      goBack();
    } catch (err) {
      setError(err instanceof ServiceError ? err.message : 'Your profile could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwBusy(true);
    try {
      if (isLiveSupabaseConfigured) {
        await liveChangeMyPassword(newPassword);
      } else {
        changeMyPassword(currentPassword, newPassword);
      }
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed.');
    } catch (err) {
      setPwError(err instanceof ServiceError ? err.message : 'Your password could not be changed.');
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <ScreenHeader title="My profile" subtitle="Update your details" onBack={goBack} />
      <div className="px-4 pt-4">
        {error ? (
          <div className="mb-3">
            <Alert tone="error" onClose={() => setError(null)}>{error}</Alert>
          </div>
        ) : null}

        <div className="card text-center">
          <div className="flex justify-center">
            <Avatar name={fullName || 'Member'} src={avatar} size={76} ring />
          </div>
          <label className="btn-outline btn-sm mx-auto mt-2 cursor-pointer">
            Change photo
            <input type="file" accept="image/*" className="sr-only" onChange={onPhoto} />
          </label>
          {avatar ? (
            <button type="button" onClick={() => setAvatar(null)} className="mt-1 block w-full text-[11.5px] font-semibold text-[#A82B2B]">
              Remove photo
            </button>
          ) : null}
          <p className="mt-2 text-[11.5px] text-slate-500">
            Your photo is optional and visible to approved members.
          </p>
        </div>

        <form onSubmit={save} className="mt-3 space-y-3.5">
          <div>
            <label className="label" htmlFor="profile-name">Full name</label>
            <input id="profile-name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="profile-email">Email address</label>
            <input id="profile-email" className="input bg-slate-50" value={session?.profile.email ?? ''} readOnly disabled />
            <p className="field-help">Your email identifies your account and cannot be changed here.</p>
          </div>
          <div>
            <label className="label" htmlFor="profile-phone">Phone number</label>
            <input id="profile-phone" type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024 123 4567" />
            <p className="field-help">Used by the treasurer for reminders. Only admins can see it.</p>
          </div>

          <div className="rounded-xl bg-[#F7FAFE] p-3">
            <p className="text-[12px] font-semibold text-navy-900">
              <Check size={13} className="mr-1 inline" />
              You cannot change your contribution records, your role or your approval status from here.
              Contact an administrator if something looks wrong.
            </p>
          </div>

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save changes
          </button>
        </form>

        <div className="mt-5">
          <SectionHeader title="Change password" />
          {pwError ? (
            <div className="mb-2">
              <Alert tone="error" onClose={() => setPwError(null)}>{pwError}</Alert>
            </div>
          ) : null}
          <form onSubmit={savePassword} className="space-y-3">
            <div>
              <label className="label" htmlFor="pw-current">Current password</label>
              <input id="pw-current" type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="pw-new">New password</label>
              <input id="pw-new" type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
            </div>
            <button type="submit" className="btn-outline" disabled={pwBusy}>
              {pwBusy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Update password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
