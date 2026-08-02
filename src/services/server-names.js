const ANIKOTO_SERVER_MAP = [
  { pattern: /vidplay/i, name: "VidPlay" },
  { pattern: /vidstream|stream-?2|s-2/i, name: "BYFMS" },
  { pattern: /hd-?1|megaplay|mega|s-5/i, name: "Mega" },
  { pattern: /kiwi|nekostream|pahe/i, name: "Pahe" },
  { pattern: /mapper|dghg/i, name: "DGHG" },
];

const ANINEKO_SERVER_MAP = [
  { pattern: /dood|playmogo|mogo/i, name: "VidPlay" },
  { pattern: /streamhg|otakuhg|hg/i, name: "BYFMS" },
  { pattern: /earnvids|otakuvid|vid\.online/i, name: "DGHG" },
  { pattern: /hd-?1|vibe|vivibebe|neko/i, name: "Neko" },
  { pattern: /pahe|kiwi|nekostream/i, name: "Pahe" },
];

function mapServerName(rawName, embedUrl, source) {
  const haystack = `${rawName} ${embedUrl ?? ""}`.toLowerCase();
  const rules = source === "anikoto" ? ANIKOTO_SERVER_MAP : ANINEKO_SERVER_MAP;

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
};
