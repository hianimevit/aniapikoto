const { ScrapeSession } = require("./http");

const MEGAPLAY_HOSTS = [
  "megaplay.buzz",
  "megaplay-1.buzz",
  "vidtube.site",
  "vidplay.site",
  "embed.bunkrerrer.com",
];

const DIRECT_SRC_HOSTS = [
  "vivibebe.site",
  "vibeplayer.site",
  "bibiemb.xyz",
  "vibevibe.workers.dev",
];

function decodeMaybe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeHost(embedUrl) {
  return new URL(embedUrl).hostname.replace(/^www\./, "");
}

function isMegaplayHost(host) {
  return MEGAPLAY_HOSTS.some((item) => host.includes(item));
}

function megaplayReferer(embedUrl) {
  return embedUrl.includes("?") ? embedUrl : `${embedUrl}?ajax=1`;
}

function extractSubtitlesFromEmbedUrl(embedUrl) {
  const subtitles = [];
  let parsed;

  try {
    parsed = new URL(embedUrl);
  } catch {
    return subtitles;
  }

  for (const [key, rawValue] of parsed.searchParams.entries()) {
    const value = decodeMaybe(rawValue);
    if (!value.startsWith("http")) continue;

    if (key === "sub" || key.startsWith("caption") || key.startsWith("c1_file")) {
      subtitles.push({
        lang: "en",
        label:
          parsed.get("sub_1") ??
          parsed.get("c1_label") ??
          (key.startsWith("caption") ? "English" : "English"),
        url: value,
        format: value.endsWith(".vtt") ? "vtt" : "srt",
      });
    }
  }

  return subtitles;
}

function extractSubtitlesFromApiData(apiData) {
  const subtitles = [];

  if (Array.isArray(apiData.subtitles)) {
    for (const sub of apiData.subtitles) {
      if (!sub || typeof sub !== "object") continue;
      const url = String(sub.url ?? sub.file ?? "");
      if (!url) continue;
      subtitles.push({
        lang: String(sub.code ?? sub.language ?? "en"),
        label: String(sub.label ?? sub.language ?? "Unknown"),
        url,
        format: String(sub.format ?? "srt"),
      });
    }
  }

  if (Array.isArray(apiData.tracks)) {
    for (const track of apiData.tracks) {
      if (!track || typeof track !== "object") continue;
      const kind = String(track.kind ?? track.type ?? "").toLowerCase();
      if (!["subtitles", "captions"].includes(kind)) continue;
      const url = String(track.file ?? track.src ?? "");
      if (!url) continue;
      subtitles.push({
        lang: String(track.srclang ?? track.language ?? "en"),
        label: String(track.label ?? track.language ?? "Unknown"),
        url,
        format: String(track.format ?? (url.endsWith(".vtt") ? "vtt" : "srt")),
      });
    }
  }

  return subtitles;
}

function extractStreamUrlFromApiData(apiData) {
  const sources = apiData.sources;

  if (sources && typeof sources === "object" && !Array.isArray(sources)) {
    const file = sources.file ?? sources.url ?? sources.src;
    if (file) return String(file);
  }

  if (Array.isArray(sources)) {
    for (const source of sources) {
      if (!source) continue;
      if (typeof source === "string" && source.startsWith("http")) {
        return source;
      }
      if (typeof source === "object") {
        const file = source.file ?? source.url ?? source.src;
        if (file) return String(file);
      }
    }
  }

  return String(apiData.source ?? apiData.url ?? apiData.file ?? "");
}

function extractDirectStreamFromHtml(html) {
  const patterns = [
    /const\s+src\s*=\s*["'](https?:\/\/[^"']+)["']/i,
    /file:\s*["'](https?:\/\/[^"']+)["']/i,
    /source:\s*["'](https?:\/\/[^"']+)["']/i,
    /hlsUrl\s*:\s*["'](https?:\/\/[^"']+)["']/i,
    /["']file["']\s*:\s*["'](https?:\/\/[^"']+)["']/i,
    /"(https?:\/\/[^"']+\.m3u8[^"']*)"/i,
    /'(https?:\/\/[^"']+\.m3u8[^"']*)'/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

function buildResolvedStream(streamUrl, subtitles, fallbackSubtitles) {
  return {
    m3u8: streamUrl.includes(".m3u8") ? streamUrl : undefined,
    mp4: streamUrl.includes(".m3u8") ? undefined : streamUrl,
    type: streamUrl.includes(".m3u8") ? "hls" : "mp4",
    subtitles: subtitles.length ? subtitles : fallbackSubtitles,
  };
}

async function resolveMegaplayGetSources(session, embedUrl, html) {
  const dataId = html.match(/data-id="(\d+)"/)?.[1];
  if (!dataId) return null;

  const host = normalizeHost(embedUrl);
  const referer = megaplayReferer(embedUrl);
  const apiHosts = [host, "megaplay.buzz", "vidtube.site"];

  for (const apiHost of [...new Set(apiHosts)]) {
    try {
      const apiData = await session.json(
        `https://${apiHost}/stream/getSources?id=${dataId}`,
        {
          headers: {
            Accept: "application/json, text/plain, */*",
            Referer: referer,
            Origin: `https://${apiHost}`,
            "X-Requested-With": "XMLHttpRequest",
          },
        },
      );

      const streamUrl = extractStreamUrlFromApiData(apiData);
      if (!streamUrl) continue;

      return {
        streamUrl,
        subtitles: extractSubtitlesFromApiData(apiData),
      };
    } catch {
      continue;
    }
  }

  return null;
}

async function resolveEmbedStream(embedUrl, referer) {
  const subtitles = extractSubtitlesFromEmbedUrl(embedUrl);
  const session = new ScrapeSession(referer);
  const host = normalizeHost(embedUrl);
  const fetchUrl = isMegaplayHost(host) ? megaplayReferer(embedUrl) : embedUrl;

  const html = await session.text(fetchUrl, {
    headers: { Accept: "text/html,*/*" },
  });

  const direct = extractDirectStreamFromHtml(html);
  if (direct) {
    return buildResolvedStream(direct, subtitles, subtitles);
  }

  if (
    isMegaplayHost(host) ||
    html.includes("megaplay-player") ||
    html.includes('data-id="')
  ) {
    const megaplay = await resolveMegaplayGetSources(session, embedUrl, html);
    if (megaplay) {
      return buildResolvedStream(
        megaplay.streamUrl,
        megaplay.subtitles,
        subtitles,
      );
    }
  }

  if (DIRECT_SRC_HOSTS.some((item) => host.includes(item.replace(/^www\./, "")))) {
    return { subtitles };
  }

  return { subtitles };
}

module.exports = { resolveEmbedStream };
