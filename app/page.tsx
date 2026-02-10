"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import type { UserRole } from "@/types";

const toChannelSlug = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "-");

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [channelId, setChannelId] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setSession(data.session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setSession(session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const defaultChannelId = useMemo(() => {
    if (!session?.user) return "";
    const metadata = session.user.user_metadata ?? {};
    const preferred =
      metadata.preferred_username ??
      metadata.user_name ??
      metadata.name ??
      session.user.email?.split("@")[0] ??
      session.user.id;
    return toChannelSlug(String(preferred));
  }, [session]);

  useEffect(() => {
    if (!session) {
      setChannelId("");
      return;
    }
    if (!channelId) {
      setChannelId(defaultChannelId);
    }
  }, [session, channelId, defaultChannelId]);

  const resolvedChannelId = toChannelSlug(channelId);
  const linksEnabled = resolvedChannelId.length > 0;
  const canProducer = role === "PRODUCER";
  const canOperator = role === "PRODUCER" || role === "OPERATOR" || role === "LOADER";

  useEffect(() => {
    if (!session || !resolvedChannelId) {
      setRole(null);
      return;
    }

    const ownerSlug = toChannelSlug(defaultChannelId);
    if (ownerSlug && ownerSlug === resolvedChannelId) {
      setRole("PRODUCER");
      return;
    }

    const loadRole = async () => {
      setRoleLoading(true);
      const { data, error } = await supabase
        .from("channel_members")
        .select("role")
        .eq("channel_id", resolvedChannelId)
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error || !data?.role) {
        setRole("GUEST");
      } else {
        setRole(data.role as UserRole);
      }
      setRoleLoading(false);
    };

    loadRole();
  }, [session, resolvedChannelId, defaultChannelId]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4 text-glow">StageHand</h1>
      <p className="text-xl mb-8 text-emerald-100/80">Live broadcast control room</p>

      {!session ? (
        <div className="glass-panel rounded-lg p-8 w-full max-w-md text-center space-y-4">
          <p className="text-emerald-100/70 text-sm">Sign in with Twitch to continue</p>
          <button
            onClick={() =>
              supabase.auth.signInWithOAuth({
                provider: "twitch",
                options: {
                  redirectTo: window.location.origin,
                },
              })
            }
            className="w-full glass-button font-bold py-3 px-4 rounded-lg transition"
          >
            Sign in with Twitch
          </button>
        </div>
      ) : (
        <div className="w-full max-w-4xl space-y-6">
          <div className="glass-panel rounded-lg p-6 space-y-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-emerald-100/70">Channel</label>
              <input
                value={channelId}
                onChange={(event) => setChannelId(event.target.value)}
                placeholder={defaultChannelId || "twitch-channel"}
                className="glass-input rounded px-3 py-2"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-emerald-100/60">
              <span>
                {roleLoading
                  ? "Checking access..."
                  : role
                    ? `Role: ${role}`
                    : "Use your channel for Producer, or your streamer’s channel for Operator."}
              </span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-emerald-100/70 hover:text-emerald-50 transition"
              >
                Sign out
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href={linksEnabled && canProducer ? `/producer/${resolvedChannelId}` : "#"}
              className={`p-6 rounded-lg transition glass-panel ${
                linksEnabled && canProducer ? "hover:border-emerald-200/50" : "opacity-50 pointer-events-none"
              }`}
            >
              <h2 className="text-2xl font-bold mb-2">Producer Console</h2>
              <p className="text-emerald-100/70">Manage roles, approvals, and scene controls.</p>
            </a>

            <a
              href={linksEnabled && canOperator ? `/console/${resolvedChannelId}` : "#"}
              className={`p-6 rounded-lg transition glass-panel ${
                linksEnabled && canOperator ? "hover:border-emerald-200/50" : "opacity-50 pointer-events-none"
              }`}
            >
              <h2 className="text-2xl font-bold mb-2">Operator Console</h2>
              <p className="text-emerald-100/70">Spawn and manipulate assets on the stage.</p>
            </a>

            <a
              href={linksEnabled ? `/overlay/${resolvedChannelId}` : "#"}
              className={`p-6 rounded-lg transition glass-panel ${
                linksEnabled ? "hover:border-emerald-200/50" : "opacity-50 pointer-events-none"
              }`}
            >
              <h2 className="text-2xl font-bold mb-2">Overlay Renderer</h2>
              <p className="text-emerald-100/70">The transparent layer for OBS.</p>
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
