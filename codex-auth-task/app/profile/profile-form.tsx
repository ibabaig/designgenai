"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { saveProfile } from "./actions";
import type { Profile } from "@/lib/profiles";

export default function ProfileForm({
  profile,
  currentAvatarUrl,
  userId,
}: {
  profile: Profile;
  currentAvatarUrl: string | null;
  userId: string;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(profile.first_name ?? "");
  const [lastName, setLastName] = useState(profile.last_name ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : currentAvatarUrl);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);

    let avatarPath: string | null = null;

    // Upload straight from the browser to Storage. Going through a Server
    // Action instead would hit Next.js's ~1MB request body limit.
    if (file) {
      if (!file.type.startsWith("image/")) {
        setStatus("Please choose an image file.");
        setBusy(false);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setStatus("Images must be under 5MB.");
        setBusy(false);
        return;
      }

      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";

      // The first folder MUST be the user's id — that's what the storage
      // policy checks. A timestamp in the name dodges CDN caching of the
      // old picture.
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (error) {
        setStatus(`Upload failed: ${error.message}`);
        setBusy(false);
        return;
      }
      avatarPath = path;
    }

    // Only the path string goes into the database.
    const result = await saveProfile(firstName, lastName, avatarPath);
    setStatus(result.message);
    setBusy(false);
    if (result.ok) router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Your profile photo" width={120} height={120} />
      )}

      <label htmlFor="avatar">Profile photo</label>
      <input id="avatar" type="file" accept="image/*" onChange={pickFile} />

      <label htmlFor="first_name">First name</label>
      <input
        id="first_name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        required
      />

      <label htmlFor="last_name">Last name</label>
      <input
        id="last_name"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        required
      />

      <button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </button>

      {status && <p role="status">{status}</p>}
    </form>
  );
}
