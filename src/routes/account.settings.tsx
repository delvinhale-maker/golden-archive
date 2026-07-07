import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, KeyRound, Loader2, LogOut, Save, Upload, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { MarketShell } from "@/components/marketplace/MarketShell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export const Route = createFileRoute("/account/settings")({
  head: () => ({
    meta: [
      { title: "Account Settings — AurumVault" },
      { name: "description", content: "Manage your AurumVault profile, email, and password." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountSettingsPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback error={error} reset={reset} title="Account settings didn't load" />
  ),
});

function AccountSettingsPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      const meta = user.user_metadata as { full_name?: string; avatar_url?: string } | undefined;
      setFullName(meta?.full_name ?? "");
      setAvatarUrl(meta?.avatar_url ?? "");
    }
  }, [user]);

  if (loading) {
    return (
      <MarketShell>
        <div className="py-24 text-center">
          <Loader2 className="mx-auto animate-spin text-gold-ink" />
        </div>
      </MarketShell>
    );
  }

  if (!user) {
    return (
      <MarketShell>
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <UserIcon size={36} className="mx-auto text-gold-ink" />
          <h1 className="mt-4 font-display text-3xl font-bold text-ink">Account Settings</h1>
          <p className="mt-2 text-sm text-mute">Sign in to manage your account.</p>
          <Link
            to="/auth"
            className="mt-6 inline-block rounded-full bg-gold px-6 py-3 text-sm font-bold text-navy"
          >
            Sign In
          </Link>
        </div>
      </MarketShell>
    );
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim(), avatar_url: avatarUrl.trim() },
    });
    setSavingProfile(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile updated");
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  return (
    <MarketShell>
      <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
        <Link
          to="/account"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-mute hover:text-ink"
        >
          <ArrowLeft size={14} /> Back to account
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold text-ink">Account Settings</h1>
        <p className="mt-1 text-sm text-mute">Update your profile, email, and password.</p>

        {/* Profile */}
        <form
          onSubmit={handleSaveProfile}
          className="mt-6 rounded-2xl border border-line bg-white p-5"
        >
          <h2 className="font-display text-lg font-bold text-ink">Profile</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-xs font-semibold text-ink">
                Display name
              </label>
              <input
                id="full_name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold-ink"
                placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor="avatar_url" className="block text-xs font-semibold text-ink">
                Avatar URL
              </label>
              <input
                id="avatar_url"
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold-ink"
                placeholder="https://…"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy disabled:opacity-60"
            >
              {savingProfile ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save profile
            </button>
          </div>
        </form>

        {/* Email (read-only) */}
        <section className="mt-6 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-display text-lg font-bold text-ink">Email</h2>
          <p className="mt-2 text-sm text-ink">{user.email}</p>
          <p className="mt-1 text-xs text-mute">
            To change your email, contact support.
          </p>
        </section>

        {/* Password */}
        <form
          onSubmit={handleChangePassword}
          className="mt-6 rounded-2xl border border-line bg-white p-5"
        >
          <h2 className="font-display text-lg font-bold text-ink">Change password</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="new_password" className="block text-xs font-semibold text-ink">
                New password
              </label>
              <input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold-ink"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label htmlFor="confirm_password" className="block text-xs font-semibold text-ink">
                Confirm new password
              </label>
              <input
                id="confirm_password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold-ink"
                placeholder="Re-enter password"
              />
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              className="inline-flex items-center gap-1.5 rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {savingPassword ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <KeyRound size={14} />
              )}
              Update password
            </button>
          </div>
        </form>

        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-full border border-line bg-white py-3 text-sm font-semibold text-ink hover:bg-muted"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </MarketShell>
  );
}
