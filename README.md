# Motion Studio Server

Generates professional motion design videos from text prompts using Claude (Anthropic) and Remotion.

## Architecture

```
POST /generate { prompt }
       │
       ▼
  Claude Opus ──── generates Remotion JSX component
       │
       ▼
  @remotion/bundler ──── webpack bundles the component
       │
       ▼
  @remotion/renderer ──── headless Chrome renders frames → MP4
       │
       ▼
  GET /videos/:id.mp4
```

## Setup

```bash
cp .env.example .env
# Fill in ANTHROPIC_API_KEY
npm install
npm start
```

## API

### `POST /generate`

```json
{
  "prompt": "A cinematic intro for a fintech startup called Aurelia, dark luxury aesthetic, gold accents"
}
```

**Response:**
```json
{
  "success": true,
  "id": "uuid",
  "title": "Aurelia — Cinematic Brand Intro",
  "url": "http://localhost:3000/videos/uuid.mp4",
  "duration_seconds": 8.0,
  "fps": 30
}
```

### `GET /health`
Returns `{ "status": "ok" }`.

### `GET /videos/:id.mp4`
Streams the rendered video file.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | — | Anthropic API key |
| `PORT` | | `3000` | Server port |
| `BASE_URL` | | `http://localhost:3000` | Public URL (set to Railway domain) |
| `CLAUDE_MODEL` | | `claude-opus-4-6` | Model for component generation |

## Deploy to Railway

1. Push to GitHub
2. New project → Deploy from GitHub
3. Add environment variables in Railway dashboard
4. Railway will build the Dockerfile automatically

Note: First render after deployment may take ~30s as Chrome initialises.

## Notes

- Rendering a 10-second video typically takes 60–120 seconds
- Videos are stored in `videos/` — add a cleanup cron or use Railway Volumes + a CDN for production
- The generated code runs in a headless Chrome sandbox via Remotion
