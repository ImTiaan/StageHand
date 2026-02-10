export type UserRole = "PRODUCER" | "OPERATOR" | "LOADER" | "GUEST";

export interface User {
  id: string;
  twitchId: string;
  username: string;
  avatarUrl?: string;
  role: UserRole;
}

export type AssetType = "IMAGE" | "VIDEO" | "TEXT";

export interface Asset {
  id: string;
  type: AssetType;
  url: string;
  filename: string;
  metadata: {
    width?: number;
    height?: number;
    duration?: number; // in seconds
    mimeType?: string;
  };
  uploaderId: string;
  approved: boolean;
  createdAt: number;
}

export interface Transform {
  x: number; // 0-1 (normalized to stage width)
  y: number; // 0-1 (normalized to stage height)
  scale: number; // multiplier (1 = original size relative to stage reference)
  rotation: number; // degrees
}

export interface StageElement {
  id: string; // Instance ID
  assetId: string;
  asset: Asset; // Hydrated asset data
  transform: Transform;
  layer: number; // Z-index
  lockedBy?: string; // User ID who is currently dragging/editing
  visible: boolean;
}

export interface StageState {
  elements: Record<string, StageElement>;
  config: {
    width: number; // Reference width (e.g. 1920)
    height: number; // Reference height (e.g. 1080)
    backgroundColor?: string;
    locked: boolean; // Kill switch active
  };
}

// Socket Events
export interface ServerToClientEvents {
  "stage:update": (state: StageState) => void;
  "stage:element-locked": (elementId: string, userId: string) => void;
  "stage:element-unlocked": (elementId: string) => void;
  "stage:log": (message: string, userId?: string) => void;
  "error": (message: string) => void;
}

export interface ClientToServerEvents {
  "stage:join": (channelId: string) => void;
  "stage:update-element": (elementId: string, transform: Partial<Transform>) => void;
  "stage:add-element": (assetId: string, initialTransform?: Transform) => void;
  "stage:remove-element": (elementId: string) => void;
  "stage:lock-element": (elementId: string) => void;
  "stage:unlock-element": (elementId: string) => void;
  "stage:clear": () => void;
  "stage:undo": () => void;
  "stage:toggle-lock": () => void;
  "stage:drag-start": (elementId: string) => void;
}
