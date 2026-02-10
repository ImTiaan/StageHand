StageHand — Full Project Plan & System Specification
1. High-Level Summary
StageHand is a web-first, real-time stage management system for livestream overlays.
It allows a streamer and their moderators to manually place, drag, resize, rotate, and throw visual assets (images, GIFs, videos with sound, text) on top of a live stream via OBS, in real time, through a collaborative web interface.
StageHand is not chat-triggered.
It is human-operated, like a live TV control room.
Primary goals:
Feel like a live broadcast graphics desk
Be safe, controllable, undoable
Be resolution-independent
Be web-debuggable
Work with 1–5 active operators, from a roster of up to ~20 mods
2. Core Product Concept
Mental Model
StageHand = Stage Manager / Control Room for Stream Overlays
OBS shows a single Browser Source (the stage)
Mods open a Control Console (web UI)
Streamer opens a Producer Console (web UI)
All actions update a shared, authoritative stage state
No OBS plugins required.
3. System Architecture (Web-First)
Surfaces
Overlay Renderer
Web page loaded as OBS Browser Source
Transparent canvas
Renders current stage state only
No controls, no auth UI
Must survive reloads gracefully
Operator Console
Web UI for mods/operators
Spawn assets
Drag / scale / rotate / throw
See locks, guides, safe zones
Producer Console
Web UI for streamer / owner
Manage roles & permissions
Approve assets
Configure scene profiles & safe zones
Panic / undo / kill switch
View audit log
4. Virtual Stage & Resolution Handling (Critical)
Virtual Stage System
All positioning is resolution-independent.
Define a canonical virtual stage (e.g. 1920×1080)
Store all transforms in normalized coordinates
Example:
{
  "x": 0.42,
  "y": 0.18,
  "scale": 0.15,
  "rotation": 7
}
Overlay renderer maps this to:
1080p
1440p
4K
Ultrawide
Scene Profiles
Each streamer selects a Scene Profile, defining:
Resolution & aspect ratio
Safe zones (facecam, HUD, subtitles)
Max asset size
Max concurrent assets
Physics enabled/disabled
Audio policy
Mods never think about pixels.
5. Asset System
Asset Types
Image (PNG, WebP)
Animated (GIF, WebM preferred)
Video (MP4, WebM) with sound
Text (labels, stamps, lower thirds)
Asset Library
Upload & approve workflow
Tags + favorites
Packs (grouped assets)
Versioning & rollback
File limits (size, duration, dimensions)
Asset Lifetimes
Auto-despawn after X seconds
Fade in/out
Loop count
“Pinned” (stays until removed)
6. Real-Time Interaction Model
Core Interactions
Drag → move
Drag handle / modifier → scale
Rotate handle → rotate
Flick gesture → throw (velocity + spin)
Snap guides (safe zones, thirds, center)
Physics (Optional Mode)
Gravity
Bounce
Friction
Edge rules (bounce / stick / slide)
Physics is a mode, not always on.
7. Multi-User Collaboration Model
Operator Roster
Up to ~20 possible operators
Typically 1–5 active at once
Twitch OAuth identity
Roles
Producer: full control, panic, config
Operator: manipulate assets
Loader: spawn approved assets only
Guest: temporary restricted access
Asset Locking
Soft lock when an operator grabs an asset
Visible ownership indicator
Auto-release after inactivity
8. Safety & Trust Features (Non-Negotiable)
Producer Controls
Undo (last N actions)
Clear Stage
Kill Switch (disable operator input)
Rate limits per operator
Hard caps on:
Asset count
Asset size
Audio volume
Audit Log
Who spawned / moved / removed what
Timestamped
Visible to Producer
Rehearsal Mode
Mods can practice off-stream
Same scene rules
No OBS output
9. Audio Handling
Browser Source audio routed into OBS mixer
Per-asset volume control
Hard limiter always on
Optional ducking vs mic/game
Audio permissions by role
10. Realtime & State Management
Authoritative State
Server is the source of truth
Clients send intent, not final state
Server resolves conflicts
Reconnect Behavior (Critical)
Overlay fetches full stage snapshot on connect
Subscribes to deltas after snapshot
On disconnect:
Overlay keeps last known state
Never clears automatically
Update Strategy
Drag updates throttled (~20–30fps)
Overlay interpolates smoothly
Physics ticks fixed rate
11. Optional Local Helper (Future, Not v1)
Purpose
Reliability, not features
Helper does ONLY:
Hold stage state locally
Serve overlay via localhost
Cache assets on disk
Act as failsafe if cloud drops
No UI. No Electron. No custom graphics.
Helper is optional, Pro-level later.
12. Tech Stack (Suggested, Web-Debuggable)
Frontend: Next.js / React
Realtime: WebSockets (Socket.IO or native)
State pub/sub: Redis
Database: Postgres
Asset storage: S3-compatible (e.g. Cloudflare R2)
CDN: Cloudflare
Auth: Twitch OAuth
Hosting: Fly.io / Render / Railway
13. MVP Scope (What to Build First)
StageHand v1 (Must Have)
Overlay renderer (browser source)
Operator console: spawn + drag/scale/rotate
Producer console: roles, approvals, panic
Virtual stage + scene profiles
Asset library (image/video)
Audio support + limiter
Undo / clear stage
v1.5 (Wow Factor)
Throw gesture
Physics mode
Moments (save + replay gags)
Scene preset switching
14. Non-Goals (Explicitly Out of Scope)
Chat-triggered effects
OBS plugins (for v1)
AI automation (human-operated only)
Viewer-driven chaos (this is mod-driven)
15. Product Positioning (for AI Context)
StageHand is:
Not Streamlabs alerts
Not chat bots
Not static overlays
It is:
A live broadcast control tool
Designed for trust, safety, and performance
Built for roleplay, comedy, live production
16. Naming
StageHand
Tagline (optional):
Live stage control for streamers.
17. Success Criteria
StageHand is successful if:
Mods can safely operate overlays live
Streamer trusts it mid-broadcast
OBS reloads do not break visuals
Works identically on 1080p → 4K
Debuggable entirely via web tools