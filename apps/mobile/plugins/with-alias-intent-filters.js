// expo-alternate-app-icons switches Android icons by enabling one <activity-alias> and disabling
// MainActivity. Only MainActivity carries the app's VIEW intent filters (the `dosely://` scheme,
// the dev-client link, notification and Live Update taps), so with an alternate icon active those
// links stop resolving. This plugin copies every non-LAUNCHER intent filter from MainActivity onto
// each icon alias, so deep links keep working whichever icon is enabled.
const { withAndroidManifest } = require("expo/config-plugins");

function isLauncherFilter(filter) {
  const cats = filter.category ?? [];
  return cats.some((c) => c.$?.["android:name"] === "android.intent.category.LAUNCHER");
}

module.exports = function withAliasIntentFilters(config) {
  return withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (!app) return mod;
    const main = (app.activity ?? []).find((a) => a.$?.["android:name"] === ".MainActivity");
    const aliases = (app["activity-alias"] ?? []).filter((a) =>
      String(a.$?.["android:name"] ?? "").startsWith(".MainActivityIcon"),
    );
    if (!main || aliases.length === 0) return mod;
    const extra = (main["intent-filter"] ?? []).filter((f) => !isLauncherFilter(f));
    for (const alias of aliases) {
      const existing = alias["intent-filter"] ?? [];
      const launcherOnly = existing.filter(isLauncherFilter);
      alias["intent-filter"] = [...launcherOnly, ...JSON.parse(JSON.stringify(extra))];
    }
    return mod;
  });
};
