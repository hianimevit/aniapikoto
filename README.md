# aniapikoto

AniNeko & AniKoto **watch stream API**. Returns SUB / SSUB / DUB / RAW servers with **direct m3u8** links and subtitle files by MAL ID + episode number.

Deploy on **Vercel** or run locally with Express.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health + endpoint list |
| GET | `/api/anineko/mal/:malId/:episode` | AniNeko watch streams |
| GET | `/api/anikoto/mal/:malId/:episode` | AniKoto watch streams |

### Examples

```bash
# One Piece episode 1
curl "https://aniapikoto.vercel.app/api/anineko/mal/21/1"
curl "https://aniapikoto.vercel.app/api/anikoto/mal/21/1"
```

### AniKoto response

Server names: **Mega**, **BYFMS**, **VidPlay**, **Pahe**, **DGHG**

```json
{
  "success": true,
  "data": {
    "source": "anikoto",
    "malId": 21,
    "episodeNumber": 1,
    "title": "One Piece",
    "slug": "one-piece-odmau",
    "sub": [
      {
        "serverName": "Mega",
        "category": "sub",
        "m3u8": "https://....master.m3u8",
        "type": "hls",
        "subtitles": [{ "lang": "en", "label": "English", "url": "https://....vtt", "format": "vtt" }]
      }
    ],
    "dub": [],
    "raw": []
  }
}
```

### AniNeko response

Server names: **HD-1**, **HD-2**, **HD-3**… (StreamHG / EarnVids embeds are skipped)

```json
{
  "success": true,
  "data": {
    "source": "anineko",
    "malId": 21,
    "episodeNumber": 1,
    "title": "One Piece",
    "slug": "one-piece",
    "sub": [],
    "ssub": [
      {
        "serverName": "HD-1",
        "category": "ssub",
        "m3u8": "https://....master.m3u8",
        "type": "hls",
        "subtitles": [{ "lang": "en", "url": "https://....vtt", "format": "vtt" }]
      }
    ],
    "dub": [],
    "raw": []
  }
}
```

- `sub` = hard sub (hsub)
- `ssub` = soft sub (external subtitles)
- No `embedUrl` in response — only resolved m3u8/mp4

## Local run

```powershell
cd anime-watch-api
npm install
npm run dev
```

Server: **http://localhost:3002**

```powershell
curl http://localhost:3002/api/anineko/mal/21/1
curl http://localhost:3002/api/anikoto/mal/21/1
```

## Vercel deploy

1. Repo: https://github.com/hianimevit/aniapikoto
2. Import in Vercel
3. Optional env: `NEKOSTREAM_MAPPER_URL`

## Project structure

```
aniapikoto/
├── api/index.js
├── src/
│   ├── app.js
│   ├── routes/anineko.js, anikoto.js
│   └── services/
│       ├── anineko.js
│       ├── anikoto.js
│       ├── embed-resolver.js
│       ├── server-names.js
│       ├── http.js
│       ├── jikan.js
│       └── nekostream-mapper.js
├── package.json
└── vercel.json
```

## Use from hianime-next

```env
WATCH_API_URL=https://aniapikoto.vercel.app
```

```
GET ${WATCH_API_URL}/api/anineko/mal/21/1
GET ${WATCH_API_URL}/api/anikoto/mal/21/1
```
