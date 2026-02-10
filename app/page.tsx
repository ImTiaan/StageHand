"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

const toChannelSlug = (value: string) => value.trim().toLowerCase().replace(/\s+/g, "-");

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [channelId, setChannelId] = useState("");

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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-4">StageHand</h1>
      <p className="text-xl mb-8 text-gray-300">Live broadcast control room</p>

      {!session ? (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 w-full max-w-md text-center space-y-4">
          <p className="text-gray-400 text-sm">Sign in with Twitch to continue</p>
          <button
            onClick={() =>
              supabase.auth.signInWithOAuth({
                provider: "twitch",
                options: {
                  redirectTo: window.location.origin,
                },
              })
            }
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded shadow-lg transition"
          >
            Sign in with Twitch
          </button>
        </div>
      ) : (
        <div className="w-full max-w-4xl space-y-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-400">Channel</label>
              <input
                value={channelId}
                onChange={(event) => setChannelId(event.target.value)}
                placeholder={defaultChannelId || "twitch-channel"}
                className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Use your channel for Producer, or your streamer’s channel for Operator.</span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-gray-400 hover:text-white transition"
              >
                Sign out
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href={linksEnabled ? `/producer/${resolvedChannelId}` : "#"}
              className={`p-6 border border-gray-700 rounded-lg transition ${
                linksEnabled ? "hover:bg-gray-800" : "opacity-50 pointer-events-none"
              }`}
            >
              <h2 className="text-2xl font-bold mb-2">Producer Console</h2>
              <p className="text-gray-400">Manage roles, approvals, and scene controls.</p>
            </a>

            <a
              href={linksEnabled ? `/console/${resolvedChannelId}` : "#"}
              className={`p-6 border border-gray-700 rounded-lg transition ${
                linksEnabled ? "hover:bg-gray-800" : "opacity-50 pointer-events-none"
              }`}
            >
              <h2 className="text-2xl font-bold mb-2">Operator Console</h2>
              <p className="text-gray-400">Spawn and manipulate assets on the stage.</p>
            </a>

            <a
              href={linksEnabled ? `/overlay/${resolvedChannelId}` : "#"}
              className={`p-6 border border-gray-700 rounded-lg transition ${
                linksEnabled ? "hover:bg-gray-800" : "opacity-50 pointer-events-none"
              }`}
            >
              <h2 className="text-2xl font-bold mb-2">Overlay Renderer</h2>
              <p className="text-gray-400">The transparent layer for OBS.</p>
            </a>
          </div>
        </div>
      )}
    </main>
  );
}
