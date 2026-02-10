"use client";

import { useEffect, useState, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { StageState } from "@/types";
import { Stage } from "@/components/Stage";

export default function ProducerPage({ params }: { params: { channelId: string } }) {
  const [session, setSession] = useState<Session | null>(null);
  const socket = useSocket(session?.access_token ?? null);
  const [stageState, setStageState] = useState<StageState | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

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

  if (!session) {
    return (
      <div className="flex h-screen bg-gray-900 text-white items-center justify-center">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">StageHand Producer</h1>
          <p className="text-gray-400 text-sm">Sign in with Twitch to continue</p>
          <button
            onClick={() =>
              supabase.auth.signInWithOAuth({
                provider: "twitch",
                options: {
                  redirectTo: `${window.location.origin}/producer/${params.channelId}`,
                },
              })
            }
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded shadow-lg transition"
          >
            Sign in with Twitch
          </button>
        </div>
      </div>
    );
  }

  if (!stageState) {
    return <div className="p-8">Connecting to Producer Console...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar Controls */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 p-6 flex flex-col gap-8">
        <div>
            <h1 className="text-2xl font-bold mb-2">Producer Console</h1>
            <p className="text-gray-400 text-sm">Channel: {params.channelId}</p>
        </div>

        <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-red-400">Panic Controls</h2>
            <button 
                onClick={clearStage}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded shadow-lg transition"
            >
                CLEAR STAGE
            </button>
            <button 
                onClick={undo}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-2 px-4 rounded border border-gray-600"
            >
                Undo Last Action
            </button>
            <button 
                onClick={toggleLock}
                className={`font-bold py-2 px-4 rounded border border-gray-600 transition ${
                    stageState.config.locked 
                    ? "bg-red-900 text-red-100 border-red-500 animate-pulse" 
                    : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
            >
                {stageState.config.locked ? "UNLOCK STAGE" : "LOCK STAGE (KILL SWITCH)"}
            </button>
        </div>

        <div className="flex-1 overflow-auto">
            <h2 className="text-lg font-semibold mb-2">Audit Log</h2>
            <div className="text-xs text-gray-400 font-mono bg-black/30 p-2 rounded h-40 overflow-y-auto">
                {logs.length === 0 ? (
                    <div className="text-gray-600 italic">No activity yet</div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="mb-1">{log}</div>
                    ))
                )}
            </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-950">
        <h2 className="text-gray-500 mb-4 font-mono uppercase tracking-widest">Live Output Preview</h2>
        <div 
            ref={containerRef}
            className="w-full h-full max-w-[1000px] max-h-[600px] flex items-center justify-center relative overflow-hidden"
        >
            <div
            className="relative bg-black shadow-2xl border border-gray-700 overflow-hidden pointer-events-none"
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
