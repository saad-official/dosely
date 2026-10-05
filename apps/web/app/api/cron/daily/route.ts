import { unauthorized } from "@/app/api/_lib/respond";
import { isAuthorizedCron } from "@/app/api/_lib/secrets";
import { runDailyJob } from "@/lib/services/daily";

/**
 * Daily job (vercel.json: 06:00 UTC). `Authorization: Bearer <CRON_SECRET>`.
 * Keeps the database warm and sweeps missed doses the member's device could
 * not report (lib/services/daily.ts).
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return unauthorized();
  try {
    const result = await runDailyJob();
    console.info(
      `[cron] daily: ${result.sweep.candidates} missed, ${result.sweep.escalated} escalated, ${result.sweep.notified} pushes, ${result.sweep.errors} errors`,
    );
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron] daily failed", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, error: "daily job failed" }, { status: 500 });
  }
}
