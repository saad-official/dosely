import * as shared from "./index";

describe("package entry", () => {
  it("re-exports every module's public API", () => {
    const names = [
      // ids, tz
      "isUuid", "newIdFrom", "uuidV7Timestamp", "hashBytes", "idFromKey",
      "zonedParts", "zonedMidnight", "zonedInstant", "addDaysToKey", "dayKeyOf", "weekdayOfKey", "localTime",
      // schemas
      "ProfileSchema", "MedicationSchema", "ScheduleSchema", "DoseSchema", "SettingsSchema", "DEFAULT_SETTINGS",
      "CircleSchema", "CircleMemberSchema", "DeviceSchema", "SyncPushRequestSchema", "SyncPullResponseSchema",
      "MED_PALETTE", "MED_ICONS",
      // domain
      "doseIdFor", "expandDoses", "nextDueAfter", "logAsNeeded", "asNeededRemaining",
      "doseState", "markTaken", "markSkipped", "snooze", "undo", "escalationDueAt", "activeWindow",
      "dailyRate", "weeklySummary", "streak", "onTimeRate",
      "decrement", "increment", "daysLeft", "refillDate", "needsRefill", "dosesPerDay",
      "SEASONS", "SEASON_IDS", "resolveSeason", "seasonWindows", "nthWeekdayOfMonth", "easterSunday", "effectiveTheme",
      "missedDosesForEscalation", "groupEscalations", "caregiverMessage",
      "mergeRows", "pickWinner", "rowVersion", "diffDirty", "applyPull",
      "csvEscape", "toCsv", "exportRows",
      // theme modules
      "THEME_IDS", "THEMES", "tokens",
    ];
    for (const n of names) expect(shared, n).toHaveProperty(n);
  });
});
