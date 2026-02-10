# StageHand

StageHand is a real-time, web-first livestream overlay control system. It is a human-operated, real-time stage management system for OBS overlays, suitable for livestreaming environments.

## Architecture

StageHand uses a web-first architecture, ensuring everything is debuggable via standard browser tools.

### Tech Stack
-   **Frontend**: Next.js (React)
-   **Realtime**: Socket.IO (Custom Node.js server with Next.js)
-   **State Management**: Redis (Hot state) + Postgres (Persistence)
-   **Storage**: S3-compatible (e.g., Cloudflare R2) - *Local storage for dev*
-   **Auth**: Twitch OAuth (NextAuth.js)

### System Components
1.  **Overlay Renderer**: A transparent web page loaded as an OBS Browser Source. It renders the current state of the stage.
2.  **Operator Console**: A web UI for moderators to spawn, move, scale, and throw assets.
3.  **Producer Console**: A web UI for the streamer to manage permissions, approve assets, and configure the stage.

### Data Flow
1.  **State**: The server holds the authoritative state of the stage (active elements, positions, etc.).
2.  **Updates**: Clients (consoles) send *intents* (e.g., "move element X to Y") via WebSockets.
3.  **Sync**: The server validates the intent, updates the state, and broadcasts the new state to all connected clients (overlays and consoles).
4.  **Persistence**: Critical data (assets, logs, user roles) is stored in Postgres. The stage state is kept in Redis for speed and periodically snapshotted.

## Data Models

### User
-   `id`: UUID
-   `twitchId`: String
-   `username`: String
-   `role`: Enum (PRODUCER, OPERATOR, LOADER, GUEST)

### Asset
-   `id`: UUID
-   `type`: Enum (IMAGE, VIDEO, TEXT)
-   `url`: String
-   `filename`: String
-   `metadata`: JSON (width, height, duration, etc.)
-   `uploaderId`: UUID
-   `approved`: Boolean

### StageElement (Active on Stage)
-   `id`: UUID
-   `assetId`: UUID
-   `instanceId`: UUID (unique per spawn)
-   `transform`: JSON
    -   `x`: Float (0-1)
    -   `y`: Float (0-1)
    -   `scale`: Float
    -   `rotation`: Float
    -   `velocity`: Vector2 (for physics/throwing)
-   `layer`: Integer
-   `lockedBy`: UUID (User ID, for soft locking)

## Setup

1.  `npm install`
2.  `npm run dev` (Starts Next.js + Socket.IO server)

## License

Private.
