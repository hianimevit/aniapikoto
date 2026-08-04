const ANIKOTO_SERVER_MAP = [
  { pattern: /vidplay/i, name: "VidPlay" },
  { pattern: /vidstream|stream-?2|s-2/i, name: "BYFMS" },
  { pattern: /hd-?1|megaplay|mega|s-5/i, name: "Mega" },
  { pattern: /kiwi|nekostream|pahe/i, name: "Pahe" },
  { pattern: /mapper|dghg/i, name: "DGHG" },
];

const BLOCKED_ANINEKO_PATTERNS = [
  /streamhg/i,
  /otakuhg/i,
  /earnvids/i,
  /otakuvid/i,
  /otakuvid\.online/i,
  /vid\.online\/embed/i,
];

function isBlockedAninekoServer(rawName, embedUrl) {
  const haystack = `${rawName} ${embedUrl ?? ""}`.toLowerCase();
  return BLOCKED_ANINEKO_PATTERNS.some((pattern) => pattern.test(haystack));
}

function assignAninekoHdNames(buckets) {
  for (const key of ["sub", "ssub", "dub", "raw"]) {
    if (!Array.isArray(buckets[key])) continue;
    buckets[key].forEach((item, index) => {
      item.serverName = `HD-${index + 1}`;
    });
  }
}

function mapServerName(rawName, embedUrl, source) {
  const haystack = `${rawName} ${embedUrl ?? ""}`.toLowerCase();
  const rules = source === "anikoto" ? ANIKOTO_SERVER_MAP : [];

  for (const rule of rules) {
    if (rule.pattern.test(haystack)) {
      return rule.name;
    }
  }

  return rawName.replace(/\s+(hard sub|sort sub|dub|raw|hsub|sub)\s*$/i, "").trim() || "Server";
}

function displayCategory(category, source) {
  if (source === "anineko" && category === "sub") return "ssub";
  if (category === "hsub") return "hsub";
  return category;
}

module.exports = {
  mapServerName,
  displayCategory,
  isBlockedAninekoServer,
  assignAninekoHdNames,
};
