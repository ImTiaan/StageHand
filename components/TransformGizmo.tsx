import React, { useState, useEffect, useRef, useCallback } from "react";
import { Transform } from "@/types";

interface TransformGizmoProps {
  transform: Transform;
  isSelected: boolean;
  layer?: number;
  isLocked?: boolean;
  lockedBy?: string;
  onUpdate: (newTransform: Partial<Transform>) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLElement>;
  stageConfig?: { width: number; height: number };
}

export const TransformGizmo = ({
  transform,
  isSelected,
  layer,
  isLocked,
  lockedBy,
  onUpdate,
  onDragStart,
  onDragEnd,
  children,
  containerRef,
  stageConfig,
}: TransformGizmoProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Drag state refs
  const startPos = useRef({ x: 0, y: 0 });
  const startTransform = useRef(transform);
  const dragState = useRef<{
    fixedPoint?: { x: number; y: number }; // Pixel coordinates relative to stage
    initialDiagonalLen?: number;
    initialDiagonalVec?: { x: number; y: number };
    startScale?: number;
    elementSize?: { width: number; height: number };
  }>({});

  // Helper: Convert screen mouse coords to Stage Reference Pixels (e.g. 1920x1080 space)
  const getStagePoint = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current || !stageConfig) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    
    // Normalized 0-1 relative to container (screen)
    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;
    
    // Convert to Reference Pixels
    return {
        x: normX * stageConfig.width,
        y: normY * stageConfig.height
    };
  }, [containerRef, stageConfig]);

  // Helper: Convert Stage Reference Pixels to Normalized (0-1)
  const toNormalized = useCallback((point: { x: number, y: number }) => {
      if (!stageConfig) return { x: 0, y: 0 };
      return {
          x: point.x / stageConfig.width,
          y: point.y / stageConfig.height
      };
  }, [stageConfig]);

  // Drag Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isLocked) return;
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);
    startPos.current = { x: e.clientX, y: e.clientY };
    startTransform.current = { ...transform };
    onDragStart?.();
  };

  // Resize Logic
  const handleResizeStart = (e: React.MouseEvent, handle: string) => {
    if (isLocked || !containerRef.current || !stageConfig || !contentRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    setResizeHandle(handle);
    onDragStart?.();

    const rect = containerRef.current.getBoundingClientRect();
    const stageWidth = stageConfig.width;
    const stageHeight = stageConfig.height;

    // 1. Get current Center in Stage Reference Pixels
    const currentCenter = {
        x: transform.x * stageWidth,
        y: transform.y * stageHeight
    };

    // 2. Get unscaled element size
    // Note: contentRef is inside the scale transform, so offsetWidth is unscaled width
    const w = contentRef.current.offsetWidth;
    const h = contentRef.current.offsetHeight;
    dragState.current.elementSize = { width: w, height: h };
    dragState.current.startScale = transform.scale;

    // 3. Calculate corner offsets (unrotated)
    // Scale is applied to these offsets
    const s = transform.scale;
    const halfW = (w * s) / 2;
    const halfH = (h * s) / 2;

    const corners = {
        tl: { x: -halfW, y: -halfH },
        tr: { x: halfW, y: -halfH },
        bl: { x: -halfW, y: halfH },
        br: { x: halfW, y: halfH },
    };

    // 4. Rotate offsets
    const rad = (transform.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const rotate = (p: { x: number, y: number }) => ({
        x: p.x * cos - p.y * sin,
        y: p.x * sin + p.y * cos
    });

    // 5. Identify Handle and Fixed Point
    // Map handle string to opposite handle string
    const oppositeMap: Record<string, string> = {
        'tl': 'br', 'tr': 'bl', 'bl': 'tr', 'br': 'tl'
    };
    const fixedHandle = oppositeMap[handle];

    const handleOffset = rotate(corners[handle as keyof typeof corners]);
    const fixedOffset = rotate(corners[fixedHandle as keyof typeof corners]);

    const fixedPoint = {
        x: currentCenter.x + fixedOffset.x,
        y: currentCenter.y + fixedOffset.y
    };
    
    const handlePoint = {
        x: currentCenter.x + handleOffset.x,
        y: currentCenter.y + handleOffset.y
    };

    dragState.current.fixedPoint = fixedPoint;

    // Initial diagonal vector (from Fixed to Handle)
    const diagonalVec = {
        x: handlePoint.x - fixedPoint.x,
        y: handlePoint.y - fixedPoint.y
    };
    dragState.current.initialDiagonalVec = diagonalVec;
    dragState.current.initialDiagonalLen = Math.sqrt(diagonalVec.x ** 2 + diagonalVec.y ** 2);
    
    startTransform.current = { ...transform };
  };

  // Rotate Logic
  const handleRotateStart = (e: React.MouseEvent) => {
    if (isLocked) return;
    e.stopPropagation();
    e.preventDefault();
    setIsRotating(true);
    startPos.current = { x: e.clientX, y: e.clientY };
    startTransform.current = { ...transform };
    onDragStart?.();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !stageConfig) return;

      if (isDragging) {
        const rect = containerRef.current.getBoundingClientRect();
        const deltaX = (e.clientX - startPos.current.x) / rect.width;
        const deltaY = (e.clientY - startPos.current.y) / rect.height;
        
        onUpdate({
          x: startTransform.current.x + deltaX,
          y: startTransform.current.y + deltaY,
        });
      } else if (resizeHandle && dragState.current.fixedPoint && dragState.current.initialDiagonalVec) {
        const mouseStage = getStagePoint(e.clientX, e.clientY);
        const fixed = dragState.current.fixedPoint;
        const initVec = dragState.current.initialDiagonalVec;
        const startScale = dragState.current.startScale || 1;

        // Vector from Fixed to Mouse
        const currentVec = {
            x: mouseStage.x - fixed.x,
            y: mouseStage.y - fixed.y
        };

        // Project currentVec onto initVec to maintain aspect/rotation
        // Projection scalar t = (current . init) / (init . init)
        // New length along diagonal = t * |init|
        // Or simpler: ratio = (current . init) / |init|^2
        // newScale = startScale * ratio
        
        const dot = currentVec.x * initVec.x + currentVec.y * initVec.y;
        const initMagSq = initVec.x ** 2 + initVec.y ** 2;
        
        if (initMagSq === 0) return;

        const ratio = dot / initMagSq;
        const newScale = Math.max(0.1, startScale * ratio);

        // Calculate new center
        // Center is FixedPoint + (NewDiagonalVector / 2)
        // NewDiagonalVector = InitVec * ratio
        
        const newDiagX = initVec.x * ratio;
        const newDiagY = initVec.y * ratio;
        
        const newCenterPx = {
            x: fixed.x + newDiagX / 2,
            y: fixed.y + newDiagY / 2
        };

        const newCenterNorm = toNormalized(newCenterPx);

        onUpdate({
            scale: newScale,
            x: newCenterNorm.x,
            y: newCenterNorm.y
        });

      } else if (isRotating) {
         const deltaX = (e.clientX - startPos.current.x);
         onUpdate({
             rotation: startTransform.current.rotation + deltaX 
         });
      }
    };

    const handleMouseUp = () => {
      if (isDragging || resizeHandle || isRotating) {
        setIsDragging(false);
        setResizeHandle(null);
        setIsRotating(false);
        onDragEnd?.();
      }
    };

    if (isDragging || resizeHandle || isRotating) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, resizeHandle, isRotating, onUpdate, onDragEnd, stageConfig, containerRef, getStagePoint, toNormalized]);

  return (
    <div
      style={{
        position: "absolute",
        left: `${transform.x * 100}%`,
        top: `${transform.y * 100}%`,
        transform: `translate(-50%, -50%) rotate(${transform.rotation}deg)`,
        zIndex: (layer ?? 0) + 1,
      }}
    >
      <div
        ref={contentRef}
        style={{
          transform: `scale(${transform.scale})`,
          position: "relative",
          cursor: isLocked ? "not-allowed" : (isDragging ? "grabbing" : "grab"),
        }}
        onMouseDown={handleMouseDown}
        className={`${isSelected ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-black" : ""} ${isLocked ? "ring-2 ring-red-500 ring-offset-2 ring-offset-black opacity-80" : ""}`}
      >
        {children}

        {isLocked && (
             <div className="absolute -top-6 left-1/2 -translate-x-1/2 glass-panel text-rose-200 text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap z-50 font-bold tracking-wider uppercase border border-rose-300/40">
                LOCKED
            </div>
        )}

        {isSelected && !isLocked && (
          <>
            {/* Corners */}
            <div
              className="absolute -top-2 -left-2 w-4 h-4 glass-panel border border-emerald-200/60 rounded-full cursor-nwse-resize z-50"
              onMouseDown={(e) => handleResizeStart(e, 'tl')}
            />
            <div
              className="absolute -top-2 -right-2 w-4 h-4 glass-panel border border-emerald-200/60 rounded-full cursor-nesw-resize z-50"
              onMouseDown={(e) => handleResizeStart(e, 'tr')}
            />
            <div
              className="absolute -bottom-2 -left-2 w-4 h-4 glass-panel border border-emerald-200/60 rounded-full cursor-nesw-resize z-50"
              onMouseDown={(e) => handleResizeStart(e, 'bl')}
            />
            <div
              className="absolute -bottom-2 -right-2 w-4 h-4 glass-panel border border-emerald-200/60 rounded-full cursor-nwse-resize z-50"
              onMouseDown={(e) => handleResizeStart(e, 'br')}
            />
            
            {/* Rotate Handle */}
            <div
              className="absolute -top-8 left-1/2 -translate-x-1/2 w-4 h-4 glass-panel border border-emerald-200/60 rounded-full cursor-ew-resize z-50 flex flex-col items-center"
              onMouseDown={handleRotateStart}
            >
                <div className="w-0.5 h-4 bg-emerald-200/60 absolute top-full left-1/2 -translate-x-1/2" />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
