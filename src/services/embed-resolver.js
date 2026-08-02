const { ScrapeSession } = require("./http");

const MEGAPLAY_HOSTS = [
  "megaplay.buzz",
  "megaplay-1.buzz",
  "vidtube.site",
  "vidplay.site",
  "embed.bunkrerrer.com",
];

const MEGAPLAY_API_HOSTS = {
  "vidtube.site": ["vidtube.site", "megaplay.buzz"],
  "vidplay.site": ["vidplay.site", "megaplay.buzz"],
  "megaplay.buzz": ["megaplay.buzz"],
  "megaplay-1.buzz": ["megaplay.buzz", "megaplay-1.buzz"],
  "embed.bunkrerrer.com": ["megaplay.buzz"],
};

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

function embedFetchHeaders(referer, embedUrl) {
  const headers = { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };
  if (referer.includes("anikoto")) {
    headers.Referer = referer;
    headers.Origin = new URL(referer).origin;
  } else if (embedUrl) {
    headers.Referer = megaplayReferer(embedUrl);
    headers.Origin = `https://${normalizeHost(embedUrl)}`;
  }
  return headers;
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
          parsed.searchParams.get("sub_1") ??
          parsed.searchParams.get("c1_label") ??
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

  const flat = String(apiData.source ?? apiData.url ?? apiData.file ?? "");
  if (flat.startsWith("http")) return flat;

  const backup = apiData.backup;
  if (typeof backup === "string" && backup.startsWith("http")) return backup;
  if (backup && typeof backup === "object") {
    const file = backup.file ?? backup.url ?? backup.src;
    if (file) return String(file);
  }

  return "";
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

  return extractStreamFromPackedEval(html);
}

function unpackPackerEval(html) {
  const match = html.match(
    /eval\(function\(p,a,c,k,e,d\)\{while\(c--\)if\(k\[c\]\)p=p\.replace\(new RegExp\('\\\\b'\+c\.toString\(a\)\+'\\\\b','g'\),k\[c\]\);return p\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)\)\)/,
  );
  if (!match) return null;

  let payload = match[1];
  const base = Number(match[2]);
  let count = Number(match[3]);
  const dict = match[4].split("|");

  while (count--) {
    if (dict[count]) {
      payload = payload.replace(
        new RegExp("\\b" + count.toString(base) + "\\b", "g"),
        dict[count],
      );
    }
  }

  return payload;
}

function extractStreamFromPackedEval(html) {
  const unpacked = unpackPackerEval(html);
  if (!unpacked) return null;

  const matches = [
    ...unpacked.matchAll(/https?:\/\/[^"'\\\s]+\.m3u8[^"'\\\s]*/gi),
  ].map((item) => item[0]);

  return matches[0] ?? null;
}

function buildResolvedStream(streamUrl, subtitles, fallbackSubtitles) {
  return {
    m3u8: streamUrl.includes(".m3u8") ? streamUrl : undefined,
    mp4: streamUrl.includes(".m3u8") ? undefined : streamUrl,
    type: streamUrl.includes(".m3u8") ? "hls" : "mp4",
    subtitles: subtitles.length ? subtitles : fallbackSubtitles,
  };
}

function megaplayApiHostList(embedHost) {
  const mapped = MEGAPLAY_API_HOSTS[embedHost] ?? [embedHost, "megaplay.buzz", "vidtube.site"];
  return [...new Set(mapped)];
}

async function fetchMegaplayApiData(session, apiHost, dataId, embedUrl, referer) {
  const playerReferer = megaplayReferer(embedUrl);
  const requestHeaders = {
    Accept: "application/json, text/plain, */*",
    Referer: playerReferer,
    Origin: `https://${apiHost}`,
    "X-Requested-With": "XMLHttpRequest",
  };

  const endpoints = [
    `https://${apiHost}/stream/getSources?id=${dataId}`,
    `https://${apiHost}/ajax/sources/${dataId}`,
  ];

  for (const url of endpoints) {
    try {
      const response = await session.fetch(url, { headers: requestHeaders });
      if (!response.ok) continue;

      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      if (!contentType.includes("json") && !text.trim().startsWith("{")) continue;

      const apiData = JSON.parse(text);
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

async function resolveMegaplayStream(session, embedUrl, html, referer) {
  const dataId = html.match(/data-id="(\d+)"/)?.[1];
  if (!dataId) return null;

  const embedHost = normalizeHost(embedUrl);
  const apiHosts = megaplayApiHostList(embedHost);

  for (const apiHost of apiHosts) {
    const resolved = await fetchMegaplayApiData(
      session,
      apiHost,
      dataId,
      embedUrl,
      referer,
    );
    if (resolved) return resolved;
  }

  return null;
}

async function fetchEmbedHtml(session, embedUrl, referer) {
  const host = normalizeHost(embedUrl);
  const candidates = isMegaplayHost(host)
    ? [embedUrl, megaplayReferer(embedUrl)]
    : [embedUrl];

  for (const url of candidates) {
    try {
      const html = await session.text(url, {
        headers: embedFetchHeaders(referer, embedUrl),
      });
      if (html.includes('data-id="') || html.includes(".m3u8")) {
        return html;
      }
    } catch {
      continue;
    }
  }

  return session.text(candidates[0], {
    headers: embedFetchHeaders(referer, embedUrl),
  });
}

async function resolveEmbedStream(embedUrl, referer, existingSession) {
  const subtitles = extractSubtitlesFromEmbedUrl(embedUrl);
  const session = existingSession ?? new ScrapeSession(referer);
  const host = normalizeHost(embedUrl);

  const html = await fetchEmbedHtml(session, embedUrl, referer);

  const direct = extractDirectStreamFromHtml(html);
  if (direct) {
    return buildResolvedStream(direct, subtitles, subtitles);
  }

  if (
    isMegaplayHost(host) ||
    html.includes("megaplay-player") ||
    html.includes('data-id="')
  ) {
    const megaplay = await resolveMegaplayStream(session, embedUrl, html, referer);
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
