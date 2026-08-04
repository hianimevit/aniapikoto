const { resolveEmbedStream } = require("../src/services/embed-resolver");
const { fetchAnikotoWatchStreams } = require("../src/services/anikoto");
const { fetchAninekoWatchStreams } = require("../src/services/anineko");

async function main() {
  console.log("=== embed fixes ===");
  const soft = await resolveEmbedStream(
    "https://vivibebe.site/e6693c8de8202fbe?sub=https://cdn.anizara.store/subtitles/c4/ca/c4ca4238a0b923820dcc509a6f75849b_eng-2.vtt",
    "https://anineko.to/",
  );
  console.log("vivibebe soft sub:", soft.m3u8 ? "OK" : "FAIL", "subs:", soft.subtitles.length);

  const hg = await resolveEmbedStream(
    "https://otakuhg.site/e/8ekp2e9yut3l?caption_1=https://cdn.anizara.store/subtitles/c4/ca/c4ca4238a0b923820dcc509a6f75849b_eng-2.vtt",
    "https://anineko.to/",
  );
  console.log("otakuhg soft sub:", hg.m3u8 ? "OK" : "FAIL", hg.m3u8?.slice(0, 80));

  console.log("\n=== anikoto ===");
  const anikoto = await fetchAnikotoWatchStreams(21, 1);
  console.log(JSON.stringify(anikoto, (k, v) => (k === "m3u8" ? v?.slice(0, 60) : v), 2).slice(0, 2500));

  console.log("\n=== anineko ===");
  const anineko = await fetchAninekoWatchStreams(21, 1);
  console.log(JSON.stringify(anineko, (k, v) => (k === "m3u8" ? v?.slice(0, 60) : v), 2).slice(0, 3500));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
