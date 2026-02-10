"use client";

import { useEffect, useState, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";
import { supabase } from "@/lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";
import { StageState, Asset } from "@/types";
import { TransformGizmo } from "@/components/TransformGizmo";

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

export default function ConsolePage({ params }: { params: { channelId: string } }) {
  const [session, setSession] = useState<Session | null>(null);
  const socket = useSocket(session?.access_token ?? null);
  const [stageState, setStageState] = useState<StageState | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (!session) return;
    const loadAssets = async () => {
      setAssetsLoading(true);
      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("approved", true)
        .order("created_at", { ascending: false });

      if (error) {
        setUploadMessage(error.message);
        setAssets([]);
      } else {
        setAssets((data ?? []).map(mapAssetRow));
      }
      setAssetsLoading(false);
    };

    loadAssets();
  }, [session]);

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

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !session) return;
    setUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/uploads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setUploadMessage(payload?.error ?? "Upload failed");
    } else {
      setUploadMessage("Uploaded for approval");
    }

    setUploading(false);
    event.target.value = "";
  };

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="glass-panel rounded-lg p-8 w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">StageHand Console</h1>
          <p className="text-emerald-100/70 text-sm">Sign in with Twitch to continue</p>
          <button
            onClick={() =>
              supabase.auth.signInWithOAuth({
                provider: "twitch",
                options: {
                  redirectTo: `${window.location.origin}/console/${params.channelId}`,
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
    return <div className="p-8 text-emerald-100/70">Connecting to StageHand Console...</div>;
  }

  return (
    <div className="flex h-screen">
      {/* Locked Overlay */}
      {stageState.config.locked && (
        <div className="absolute inset-0 z-50 bg-emerald-950/30 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="glass-panel px-8 py-4 rounded-lg font-bold text-2xl shadow-2xl animate-pulse text-emerald-50">
            STAGE LOCKED BY PRODUCER
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`w-64 glass-panel p-4 flex flex-col gap-4 ${stageState.config.locked ? "opacity-50 pointer-events-none" : ""}`}>
        <h2 className="text-xl font-bold">Assets</h2>
        <label className="glass-button text-sm font-semibold py-2 px-3 rounded cursor-pointer text-center">
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          {uploading ? "Uploading..." : "Upload Asset"}
        </label>
        {uploadMessage && <div className="text-xs text-emerald-100/70">{uploadMessage}</div>}
        <div className="grid grid-cols-2 gap-2">
          {assetsLoading && <div className="text-xs text-emerald-100/60 col-span-2">Loading assets...</div>}
          {!assetsLoading && assets.length === 0 && (
            <div className="text-xs text-emerald-100/60 col-span-2">No approved assets yet</div>
          )}
          {assets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => spawnAsset(asset.id)}
              className="p-2 glass-panel hover:border-emerald-200/40 rounded flex flex-col items-center gap-2 text-xs"
            >
              {asset.type === "IMAGE" ? (
                <div className="w-full aspect-square bg-black/40 flex items-center justify-center rounded">
                    <img src={asset.url} className="max-w-full max-h-full" />
                </div>
              ) : asset.type === "VIDEO" ? (
                <div className="w-full aspect-square bg-black/40 flex items-center justify-center font-bold rounded">VID</div>
              ) : (
                <div className="w-full aspect-square bg-black/40 flex items-center justify-center rounded">T</div>
              )}
              <span className="truncate w-full text-center">{asset.filename}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Stage Area */}
      <div 
        ref={containerRef}
        className="flex-1 flex items-center justify-center relative overflow-hidden"
      >
        <div
          ref={stageRef}
          className="relative bg-black/70 shadow-2xl border border-emerald-200/10 overflow-hidden"
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
