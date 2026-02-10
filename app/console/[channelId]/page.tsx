"use client";

import { useEffect, useState, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { StageState, StageElement, Asset } from "@/types";
import { TransformGizmo } from "@/components/TransformGizmo";

// Mock assets for the sidebar (should fetch from API)
const MOCK_ASSETS: Asset[] = [
  {
    id: "asset-1",
    type: "IMAGE",
    url: "https://placehold.co/400x400/png",
    filename: "Square Placeholder",
    metadata: { width: 400, height: 400 },
    uploaderId: "user-1",
    approved: true,
    createdAt: Date.now(),
  },
  {
    id: "asset-2",
    type: "TEXT",
    url: "",
    filename: "Hello World",
    metadata: {},
    uploaderId: "user-1",
    approved: true,
    createdAt: Date.now(),
  },
  {
    id: "asset-3",
    type: "VIDEO",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    filename: "flower.mp4",
    metadata: { width: 400, height: 400 },
    uploaderId: "user-1",
    approved: true,
    createdAt: Date.now(),
  },
];

export default function ConsolePage({ params }: { params: { channelId: string } }) {
  const [session, setSession] = useState<Session | null>(null);
  const socket = useSocket(session?.access_token ?? null);
  const [stageState, setStageState] = useState<StageState | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    socket.on("stage:update", (state) => setStageState(state));
    return () => {
        socket.off("stage:update");
    };
  }, [socket, params.channelId]);

  // Handle auto-scaling of the stage to fit container
  useEffect(() => {
    if (!stageState || !containerRef.current) return;

    const handleResize = () => {
        if (!containerRef.current) return;
        const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect();
        const { width: stageWidth, height: stageHeight } = stageState.config;
        
        // Add some padding
        const padding = 64; // 32px each side
        const availableWidth = containerWidth - padding;
        const availableHeight = containerHeight - padding;

        const scaleX = availableWidth / stageWidth;
        const scaleY = availableHeight / stageHeight;
        
        // Fit contain
        setScale(Math.min(scaleX, scaleY));
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [stageState]);

  const spawnAsset = (assetId: string) => {
    if (!socket) return;
    socket.emit("stage:add-element", assetId);
  };

  const handleStageClick = (e: React.MouseEvent) => {
     // Deselect if clicking on empty stage
     if (e.target === stageRef.current) {
         setSelectedId(null);
     }
  };

  const removeElement = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    if(!socket) return;
    socket.emit("stage:remove-element", elementId);
  }

  const handleUpdate = (elementId: string, newTransform: any) => {
      if(!socket) return;
      socket.emit("stage:update-element", elementId, newTransform);
  };

  const handleDragStart = (elementId: string) => {
      setSelectedId(elementId);
      if(socket) {
          socket.emit("stage:drag-start", elementId);
          socket.emit("stage:lock-element", elementId);
      }
  };

  const handleDragEnd = (elementId: string) => {
      if(socket) {
          socket.emit("stage:unlock-element", elementId);
      }
  };

  if (!session) {
    return (
      <div className="flex h-screen bg-gray-900 text-white items-center justify-center">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">StageHand Console</h1>
          <p className="text-gray-400 text-sm">Sign in with Twitch to continue</p>
          <button
            onClick={() =>
              supabase.auth.signInWithOAuth({
                provider: "twitch",
                options: {
                  redirectTo: `${window.location.origin}/console/${params.channelId}`,
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
    return <div className="p-8">Connecting to StageHand Console...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Locked Overlay */}
      {stageState.config.locked && (
        <div className="absolute inset-0 z-50 bg-red-900/20 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-red-600 text-white px-8 py-4 rounded-lg font-bold text-2xl shadow-2xl animate-pulse">
            STAGE LOCKED BY PRODUCER
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`w-64 bg-gray-800 border-r border-gray-700 p-4 flex flex-col gap-4 ${stageState.config.locked ? "opacity-50 pointer-events-none" : ""}`}>
        <h2 className="text-xl font-bold">Assets</h2>
        <div className="grid grid-cols-2 gap-2">
          {MOCK_ASSETS.map((asset) => (
            <button
              key={asset.id}
              onClick={() => spawnAsset(asset.id)}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded flex flex-col items-center gap-2 text-xs"
            >
              {asset.type === "IMAGE" ? (
                <div className="w-full aspect-square bg-black/50 flex items-center justify-center">
                    <img src={asset.url} className="max-w-full max-h-full" />
                </div>
              ) : asset.type === "VIDEO" ? (
                <div className="w-full aspect-square bg-black/50 flex items-center justify-center font-bold">VID</div>
              ) : (
                <div className="w-full aspect-square bg-black/50 flex items-center justify-center">T</div>
              )}
              <span className="truncate w-full text-center">{asset.filename}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Stage Area */}
      <div 
        ref={containerRef}
        className="flex-1 flex items-center justify-center bg-gray-950 relative overflow-hidden"
      >
        <div
          ref={stageRef}
          className="relative bg-black shadow-2xl border border-gray-700 overflow-hidden"
          style={{
            width: stageState.config.width,
            height: stageState.config.height,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
          onMouseDown={handleStageClick}
        >
          {/* Render Elements with Controls */}
          {Object.values(stageState.elements)
            .sort((a, b) => a.layer - b.layer)
            .map((element) => (
            <TransformGizmo
                key={element.id}
                transform={element.transform}
                isSelected={selectedId === element.id}
                layer={element.layer}
                isLocked={!!element.lockedBy && element.lockedBy !== socket?.id}
                lockedBy={element.lockedBy}
                containerRef={stageRef}
                onUpdate={(newTransform) => handleUpdate(element.id, newTransform)}
                onDragStart={() => handleDragStart(element.id)}
                onDragEnd={() => handleDragEnd(element.id)}
                stageConfig={stageState.config}
            >
                <div className="relative group">
                    {/* Visual Representation */}
                    {element.asset.type === "IMAGE" && (
                        <img src={element.asset.url} className="pointer-events-none max-w-none" />
                    )}
                    {element.asset.type === "VIDEO" && (
                        <video src={element.asset.url} className="pointer-events-none max-w-none" autoPlay loop muted playsInline />
                    )}
                    {element.asset.type === "TEXT" && (
                        <div className="pointer-events-none text-white text-4xl font-bold whitespace-nowrap drop-shadow-md">
                            {element.asset.filename}
                        </div>
                    )}
                    
                    {/* Quick Actions (Always visible if selected, or on hover) */}
                    {(selectedId === element.id) && (
                        <button 
                            className="absolute -top-6 right-0 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs z-50 hover:bg-red-600"
                            onMouseDown={(e) => removeElement(e, element.id)}
                        >
                            ×
                        </button>
                    )}
                </div>
            </TransformGizmo>
          ))}
        </div>
        
        {/* Helper UI */}
        <div className="absolute bottom-4 right-4 text-gray-500 text-sm">
            Click to select. Drag to move. Use handles to resize/rotate.
        </div>
      </div>
    </div>
  );
}
