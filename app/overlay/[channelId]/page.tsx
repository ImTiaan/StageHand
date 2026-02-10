"use client";

import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import { StageState } from "@/types";
import { Stage } from "@/components/Stage";

export default function OverlayPage({ params }: { params: { channelId: string } }) {
  const socket = useSocket();
  const [stageState, setStageState] = useState<StageState | null>(null);

  useEffect(() => {
    if (!socket) return;

    socket.emit("stage:join", params.channelId);

    socket.on("stage:update", (state) => {
      setStageState(state);
    });

    return () => {
      socket.off("stage:update");
    };
  }, [socket, params.channelId]);

  if (!stageState) {
    return <div className="text-transparent">Connecting...</div>;
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-transparent">
      <Stage state={stageState} />
    </main>
  );
}
