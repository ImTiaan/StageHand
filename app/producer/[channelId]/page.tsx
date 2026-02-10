"use client";

import { useEffect, useState, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { StageState, Asset } from "@/types";
import { Stage } from "@/components/Stage";

type AssetRow = {
  id: string;
  type: Asset["type"];
  url: string;
  filename: string;
  metadata: Asset["metadata"] | null;
  uploader_id: string;
  approved: boolean;
  created_at: string;
};

const mapAssetRow = (row: AssetRow): Asset => ({
  id: row.id,
  type: row.type,
  url: row.url,
  filename: row.filename,
  metadata: row.metadata ?? {},
  uploaderId: row.uploader_id,
  approved: row.approved,
  createdAt: new Date(row.created_at).getTime(),
});

export default function ProducerPage({ params }: { params: { channelId: string } }) {
  const [session, setSession] = useState<Session | null>(null);
  const socket = useSocket(session?.access_token ?? null);
  const [stageState, setStageState] = useState<StageState | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pendingAssets, setPendingAssets] = useState<Asset[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (!socket) return;

    socket.emit("stage:join", params.channelId);

    socket.on("stage:update", (state) => {
      setStageState(state);
    });

    socket.on("stage:log", (message) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [`[${time}] ${message}`, ...prev]);
    });

    return () => {
      socket.off("stage:update");
      socket.off("stage:log");
    };
  }, [socket, params.channelId]);

  useEffect(() => {
    if (!session) return;
    const loadPendingAssets = async () => {
      setPendingLoading(true);
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("approved", false)
        .order("created_at", { ascending: true });

      if (error) {
        setPendingMessage(error.message);
        setPendingAssets([]);
      } else {
        setPendingMessage(null);
        setPendingAssets((data ?? []).map(mapAssetRow));
      }
      setPendingLoading(false);
    };

    loadPendingAssets();
  }, [session]);

  // Handle auto-scaling for preview
  useEffect(() => {
    if (!stageState || !containerRef.current) return;

    const handleResize = () => {
        if (!containerRef.current) return;
        const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect();
        const { width: stageWidth, height: stageHeight } = stageState.config;
        
        const scaleX = containerWidth / stageWidth;
        const scaleY = containerHeight / stageHeight;
        
        setScale(Math.min(scaleX, scaleY));
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [stageState]);

  const clearStage = () => {
    if (confirm("Are you sure you want to clear the stage?")) {
      socket?.emit("stage:clear");
    }
  };

  const undo = () => {
    socket?.emit("stage:undo");
  };

  const toggleLock = () => {
    socket?.emit("stage:toggle-lock");
  };

  const approveAsset = async (assetId: string) => {
    setPendingMessage(null);
    const { error } = await supabase
      .from("assets")
      .update({ approved: true })
      .eq("id", assetId);

    if (error) {
      setPendingMessage(error.message);
      return;
    }

    setPendingAssets((prev) => prev.filter((asset) => asset.id !== assetId));
  };

  const rejectAsset = async (assetId: string) => {
    setPendingMessage(null);
    const { error } = await supabase
      .from("assets")
      .delete()
      .eq("id", assetId);

    if (error) {
      setPendingMessage(error.message);
      return;
    }

    setPendingAssets((prev) => prev.filter((asset) => asset.id !== assetId));
  };

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="glass-panel rounded-lg p-8 w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">StageHand Producer</h1>
          <p className="text-emerald-100/70 text-sm">Sign in with Twitch to continue</p>
          <button
            onClick={() =>
              supabase.auth.signInWithOAuth({
                provider: "twitch",
                options: {
                  redirectTo: `${window.location.origin}/producer/${params.channelId}`,
                },
              })
            }
            className="w-full glass-button font-bold py-3 px-4 rounded-lg transition"
          >
            Sign in with Twitch
          </button>
        </div>
      </div>
    );
  }

  if (!stageState) {
    return <div className="p-8 text-emerald-100/70">Connecting to Producer Console...</div>;
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar Controls */}
      <div className="w-80 glass-panel p-6 flex flex-col gap-8">
        <div>
            <h1 className="text-2xl font-bold mb-2">Producer Console</h1>
            <p className="text-emerald-100/70 text-sm">Channel: {params.channelId}</p>
        </div>

        <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-emerald-100">Panic Controls</h2>
            <button 
                onClick={clearStage}
                className="glass-button font-bold py-3 px-4 rounded-lg transition"
            >
                CLEAR STAGE
            </button>
            <button 
                onClick={undo}
                className="glass-button font-bold py-2 px-4 rounded-lg transition"
            >
                Undo Last Action
            </button>
            <button 
                onClick={toggleLock}
                className={`font-bold py-2 px-4 rounded-lg transition ${
                    stageState.config.locked 
                    ? "glass-panel text-emerald-50 border-emerald-200/50 animate-pulse" 
                    : "glass-button"
                }`}
            >
                {stageState.config.locked ? "UNLOCK STAGE" : "LOCK STAGE (KILL SWITCH)"}
            </button>
        </div>

        <div className="flex-1 overflow-auto">
            <h2 className="text-lg font-semibold mb-2">Audit Log</h2>
            <div className="text-xs text-emerald-100/70 font-mono bg-black/30 p-2 rounded h-40 overflow-y-auto">
                {logs.length === 0 ? (
                    <div className="text-emerald-100/50 italic">No activity yet</div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="mb-1">{log}</div>
                    ))
                )}
            </div>
        </div>

        <div className="flex-1 overflow-auto">
          <h2 className="text-lg font-semibold mb-2">Pending Uploads</h2>
          {pendingMessage && <div className="text-xs text-emerald-100/70 mb-2">{pendingMessage}</div>}
          <div className="text-xs text-emerald-100/80 bg-black/30 p-2 rounded h-40 overflow-y-auto">
            {pendingLoading && <div className="text-emerald-100/50 italic">Loading uploads...</div>}
            {!pendingLoading && pendingAssets.length === 0 && (
              <div className="text-emerald-100/50 italic">Nothing waiting for approval</div>
            )}
            {pendingAssets.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between gap-2 mb-2">
                <div className="flex flex-col">
                  <span className="font-semibold">{asset.filename}</span>
                  <span className="text-emerald-100/60">{asset.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approveAsset(asset.id)}
                    className="glass-button text-xs font-semibold px-2 py-1 rounded"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => rejectAsset(asset.id)}
                    className="glass-button text-xs font-semibold px-2 py-1 rounded"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <h2 className="text-emerald-100/60 mb-4 font-mono uppercase tracking-widest">Live Output Preview</h2>
        <div 
            ref={containerRef}
            className="w-full h-full max-w-[1000px] max-h-[600px] flex items-center justify-center relative overflow-hidden"
        >
            <div
            className="relative bg-black/70 shadow-2xl border border-emerald-200/10 overflow-hidden pointer-events-none"
            style={{
                width: stageState.config.width,
                height: stageState.config.height,
                transform: `scale(${scale})`,
                transformOrigin: "center center",
            }}
            >
            <Stage state={stageState} />
            </div>
        </div>
      </div>
    </div>
  );
}
