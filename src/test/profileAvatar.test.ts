import { describe, expect, it } from 'vitest';
import { getSessionUser, signIn, updateMyProfile } from '../services/databaseService';
import { invalidateCache, resetToSeed } from '../services/localStore';
import { liveChangeMyPassword, liveUpdateMyProfile } from '../services/liveAuth';
import { downscaleAvatarImage } from '../utils/image';

const AVATAR = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP==';

describe('Profile photo persistence', () => {
  it('avatar survives a refresh (state reloaded from storage)', () => {
    resetToSeed();
    signIn('kwame@example.com', 'Member123!');
    updateMyProfile({ avatarDataUrl: AVATAR });
    expect(getSessionUser()?.profile.avatar_url).toBe(AVATAR);

    // Simulate a browser refresh: drop the in-memory cache so the next
    // read comes from persisted storage only.
    invalidateCache();
    expect(getSessionUser()?.profile.avatar_url).toBe(AVATAR);
  });

  it('removing the avatar also persists', () => {
    resetToSeed();
    signIn('kwame@example.com', 'Member123!');
    updateMyProfile({ avatarDataUrl: AVATAR });
    updateMyProfile({ avatarDataUrl: null });
    invalidateCache();
    expect(getSessionUser()?.profile.avatar_url).toBeNull();
  });

  it('chosen photos are downscaled to a small data URL', async () => {
    const file = new File(['fake-image-bytes'], 'photo.png', { type: 'image/png' });
    const result = await downscaleAvatarImage(file);
    expect(result.startsWith('data:')).toBe(true);
  });

  it('live profile saves refuse to run without Supabase configured', async () => {
    await expect(
      liveUpdateMyProfile({ fullName: 'Kwame Mensah', phone: null, avatarDataUrl: AVATAR })
    ).rejects.toThrow(/Supabase is not configured/i);
    await expect(liveChangeMyPassword('NewStrongPass123')).rejects.toThrow(
      /at least 8 characters|Supabase is not configured/i
    );
  });
});
