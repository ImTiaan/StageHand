import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@supabase/supabase-js";
import { StageState, ServerToClientEvents, ClientToServerEvents, StageElement, Asset } from "./types";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory store (Replace with Redis later)
const stages: Record<string, StageState> = {};
// Undo History: channelId -> stack of stringified StageState
const histories: Record<string, string[]> = {};
const MAX_HISTORY = 50;

// Mock Assets
const MOCK_ASSETS: Record<string, Asset> = {
  "asset-1": {
    id: "asset-1",
    type: "IMAGE",
    url: "https://placehold.co/400x400/png",
    filename: "placeholder.png",
    metadata: { width: 400, height: 400 },
    uploaderId: "user-1",
    approved: true,
    createdAt: Date.now(),
  },
  "asset-2": {
    id: "asset-2",
    type: "TEXT",
    url: "",
    filename: "Hello World",
    metadata: {},
    uploaderId: "user-1",
    approved: true,
    createdAt: Date.now(),
  },
  "asset-3": {
    id: "asset-3",
    type: "VIDEO",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    filename: "flower.mp4",
    metadata: { width: 400, height: 400 },
    uploaderId: "user-1",
    approved: true,
    createdAt: Date.now(),
  },
};

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

const fetchAsset = async (assetId: string): Promise<Asset | null> => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return MOCK_ASSETS[assetId] ?? null;
  }

  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .single();

  if (error || !data) {
    return MOCK_ASSETS[assetId] ?? null;
  }

  const asset = mapAssetRow(data as AssetRow);
  if (!asset.approved) {
    return null;
  }

  return asset;
};

const getOrCreateStage = (channelId: string): StageState => {
  if (!stages[channelId]) {
    stages[channelId] = {
      elements: {},
      config: {
        width: 1920,
        height: 1080,
        locked: false,
      },
    };
  }
  return stages[channelId];
};

const pushHistory = (channelId: string, state: StageState) => {
  if (!histories[channelId]) {
    histories[channelId] = [];
  }
  const history = histories[channelId];
  // Deep clone state to avoid reference issues
  history.push(JSON.stringify(state));
  if (history.length > MAX_HISTORY) {
    history.shift();
  }
};

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer);

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.access_token as string | undefined;
    if (!token) {
      return next();
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      socket.data.user = {
        id: data.user.id,
        email: data.user.email,
      };
    }
    return next();
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    const getChannelId = () => {
      const rooms = Array.from(socket.rooms);
      return rooms.find(r => r !== socket.id);
    };

    const log = (channelId: string, message: string) => {
      io.to(channelId).emit("stage:log", message, socket.id);
    };

    socket.on("stage:join", (channelId) => {
      socket.join(channelId);
      const stage = getOrCreateStage(channelId);
      socket.emit("stage:update", stage);
      console.log(`Socket ${socket.id} joined stage ${channelId}`);
      log(channelId, `User joined`);
    });

    socket.on("stage:add-element", async (assetId, initialTransform) => {
      const channelId = getChannelId();
      if (!channelId) return;
      if (!socket.data.user) {
        socket.emit("error", "Unauthorised");
        return;
      }

      const stage = stages[channelId];
      if (stage.config.locked) {
        socket.emit("error", "Stage is locked");
        return;
      }

      pushHistory(channelId, stage);

      const asset = await fetchAsset(assetId);
      
      if (!asset) {
          console.error(`Asset ${assetId} not found or not approved`);
          return;
      }

      const elementId = uuidv4();
      const newElement: StageElement = {
        id: elementId,
        assetId,
        asset,
        transform: initialTransform || {
          x: 0.5,
          y: 0.5,
          scale: 1,
          rotation: 0,
        },
        layer: Object.keys(stage.elements).length,
        visible: true,
      };

      stage.elements[elementId] = newElement;
      io.to(channelId).emit("stage:update", stage);
      log(channelId, `Added element ${asset.filename}`);
    });

    socket.on("stage:update-element", (elementId, transform) => {
      const channelId = getChannelId();
      if (!channelId) return;
      if (!socket.data.user) {
        socket.emit("error", "Unauthorised");
        return;
      }

      const stage = stages[channelId];
      if (stage.config.locked) {
        // We don't error on drag updates to avoid spam, just ignore
        return;
      }
      
      if (stage && stage.elements[elementId]) {
        // Check lock ownership
        if (stage.elements[elementId].lockedBy && stage.elements[elementId].lockedBy !== socket.id) {
            socket.emit("error", "Element is locked by another user");
            return;
        }

        stage.elements[elementId].transform = {
          ...stage.elements[elementId].transform,
          ...transform,
        };
        io.to(channelId).emit("stage:update", stage);
      }
    });

    socket.on("stage:lock-element", (elementId) => {
      const channelId = getChannelId();
      if (!channelId) return;
      if (!socket.data.user) {
        socket.emit("error", "Unauthorised");
        return;
      }

      const stage = stages[channelId];
      if (stage && stage.elements[elementId]) {
        if (stage.elements[elementId].lockedBy && stage.elements[elementId].lockedBy !== socket.id) {
            socket.emit("error", "Element already locked");
            return;
        }
        stage.elements[elementId].lockedBy = socket.id;
        io.to(channelId).emit("stage:update", stage);
        io.to(channelId).emit("stage:element-locked", elementId, socket.id);
      }
    });

    socket.on("stage:unlock-element", (elementId) => {
      const channelId = getChannelId();
      if (!channelId) return;
      if (!socket.data.user) {
        socket.emit("error", "Unauthorised");
        return;
      }

      const stage = stages[channelId];
      if (stage && stage.elements[elementId]) {
         if (stage.elements[elementId].lockedBy === socket.id) {
             delete stage.elements[elementId].lockedBy;
             io.to(channelId).emit("stage:update", stage);
             io.to(channelId).emit("stage:element-unlocked", elementId);
         }
      }
    });

    socket.on("stage:drag-start", (elementId) => {
      const channelId = getChannelId();
      if (!channelId) return;
      if (!socket.data.user) {
        socket.emit("error", "Unauthorised");
        return;
      }
      const stage = stages[channelId];
      if (stage && !stage.config.locked) {
        pushHistory(channelId, stage);
      }
    });

    socket.on("stage:remove-element", (elementId) => {
        const channelId = getChannelId();
        if (!channelId) return;
        if (!socket.data.user) {
          socket.emit("error", "Unauthorised");
          return;
        }

        const stage = stages[channelId];
        if (stage.config.locked) {
          socket.emit("error", "Stage is locked");
          return;
        }

        if (stage && stage.elements[elementId]) {
            if (stage.elements[elementId].lockedBy && stage.elements[elementId].lockedBy !== socket.id) {
                socket.emit("error", "Element is locked by another user");
                return;
            }
            pushHistory(channelId, stage);
            const name = stage.elements[elementId].asset.filename;
            delete stage.elements[elementId];
            io.to(channelId).emit("stage:update", stage);
            log(channelId, `Removed ${name}`);
        }
    });

    socket.on("stage:clear", () => {
      const channelId = getChannelId();
      if (!channelId) return;
      if (!socket.data.user) {
        socket.emit("error", "Unauthorised");
        return;
      }

      const stage = stages[channelId];
      if (stage) {
        pushHistory(channelId, stage);
        stage.elements = {};
        io.to(channelId).emit("stage:update", stage);
        log(channelId, "Cleared stage");
      }
    });

    socket.on("stage:undo", () => {
      const channelId = getChannelId();
      if (!channelId) return;
      if (!socket.data.user) {
        socket.emit("error", "Unauthorised");
        return;
      }

      if (!histories[channelId] || histories[channelId].length === 0) {
        return;
      }

      const previousStateJson = histories[channelId].pop();
      if (previousStateJson) {
        const previousState = JSON.parse(previousStateJson);
        // Preserve current config/locks if needed, but for true undo we restore everything
        stages[channelId] = previousState;
        io.to(channelId).emit("stage:update", previousState);
        log(channelId, "Undid last action");
      }
    });

    socket.on("stage:toggle-lock", () => {
      const channelId = getChannelId();
      if (!channelId) return;
      if (!socket.data.user) {
        socket.emit("error", "Unauthorised");
        return;
      }
      
      const stage = stages[channelId];
      if (stage) {
        stage.config.locked = !stage.config.locked;
        io.to(channelId).emit("stage:update", stage);
        log(channelId, stage.config.locked ? "LOCKED STAGE (KILL SWITCH)" : "UNLOCKED STAGE");
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
