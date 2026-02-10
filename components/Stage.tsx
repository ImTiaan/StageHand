import { StageState, StageElement } from "@/types";
import React from "react";

interface StageProps {
  state: StageState | null;
  width?: number;
  height?: number;
}

const ElementRenderer = ({ element }: { element: StageElement }) => {
  const { asset, transform } = element;
  
  const style: React.CSSProperties = {
    position: "absolute",
    left: `${transform.x * 100}%`,
    top: `${transform.y * 100}%`,
    transform: `translate(-50%, -50%) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
    pointerEvents: "none", // Overlay shouldn't capture clicks usually, but Console will override
  };

  if (asset.type === "IMAGE") {
    return (
      <img
        src={asset.url}
        alt={asset.filename}
        style={style}
        className="max-w-none"
      />
    );
  }

  if (asset.type === "TEXT") {
    return (
      <div style={style} className="text-white text-4xl font-bold drop-shadow-md whitespace-nowrap">
        {asset.filename}
      </div>
    );
  }

  if (asset.type === "VIDEO") {
    return (
      <video
        src={asset.url}
        style={style}
        className="max-w-none"
        autoPlay
        loop
        muted
        playsInline
      />
    );
  }

  return null;
};

export const Stage = ({ state }: StageProps) => {
  if (!state) return null;

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        aspectRatio: `${state.config.width} / ${state.config.height}`,
      }}
    >
      {Object.values(state.elements)
        .sort((a, b) => a.layer - b.layer)
        .map((element) => (
          <ElementRenderer key={element.id} element={element} />
        ))}
    </div>
  );
};
