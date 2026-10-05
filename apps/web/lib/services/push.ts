import "server-only";
import { inArray } from "drizzle-orm";
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import type { Db } from "@/lib/db/client";
import { devices } from "@/lib/db/schema";
import { optionalEnv } from "@/lib/env";

/** Sends a batch of messages; tickets come back in message order. */
export type PushSender = (messages: ExpoPushMessage[]) => Promise<ExpoPushTicket[]>;

/** Android notification channel the app creates for caregiver alerts. */
export const CAREGIVER_CHANNEL_ID = "caregiver-alerts";

/** Real sender: Expo Push API, chunked to its 100-message limit. */
export function expoPushSender(): PushSender {
  const accessToken = optionalEnv("EXPO_ACCESS_TOKEN");
  const expo = new Expo(accessToken ? { accessToken } : {});
  return async (messages) => {
    const tickets: ExpoPushTicket[] = [];
    for (const chunk of expo.chunkPushNotifications(messages)) {
      tickets.push(...(await expo.sendPushNotificationsAsync(chunk)));
    }
    return tickets;
  };
}

let testSender: PushSender | null = null;

/** The sender routes use: Expo, or the one a test installed. */
export function getPushSender(): PushSender {
  return testSender ?? expoPushSender();
}

/** Tests: route every push through `sender` (null restores Expo). */
export function setPushSenderForTests(sender: PushSender | null): void {
  testSender = sender;
}

/** Deletes tokens whose tickets say DeviceNotRegistered (app uninstalled, token rotated). Returns how many. */
export async function pruneDeadTokens(db: Db, messages: ExpoPushMessage[], tickets: ExpoPushTicket[]): Promise<number> {
  const gone = tickets.flatMap((ticket, index) =>
    ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered" ? [messages[index]!.to as string] : [],
  );
  if (gone.length === 0) return 0;
  const removed = await db.delete(devices).where(inArray(devices.expoPushToken, gone)).returning({ id: devices.id });
  return removed.length;
}

function listMeds(names: string[]): { text: string; plural: boolean } {
  if (names.length === 1) return { text: names[0]!, plural: false };
  if (names.length === 2) return { text: `${names[0]} and ${names[1]}`, plural: true };
  return { text: `${names[0]}, ${names[1]} and ${names.length - 2} more`, plural: true };
}

function ago(dueAt: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - dueAt.getTime()) / 60_000));
  if (minutes < 180) return `${minutes} min ago`;
  return `about ${Math.round(minutes / 60)} hours ago`;
}

/**
 * The caregiver alert. Plain and calm: who, what, how long ago. Relative
 * time, because the server does not know the caregiver's time zone.
 */
export function missedDoseMessage(
  input: { profileName: string; medNames: string[]; dueAt: string | Date },
  now = new Date(),
): { title: string; body: string } {
  const meds = listMeds(input.medNames);
  const due = typeof input.dueAt === "string" ? new Date(input.dueAt) : input.dueAt;
  return {
    title: `${input.profileName} hasn't marked a dose`,
    body: `${meds.text} ${meds.plural ? "were" : "was"} due ${ago(due, now)}. You may want to check in.`,
  };
}
