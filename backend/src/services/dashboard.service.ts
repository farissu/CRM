import prisma from '../config/database';

const MS_DAY = 86_400_000;
// The app stores message timestamps as UTC wall-clock values in a naive
// `timestamp without time zone` column, so we interpret them as UTC and render
// day/hour buckets in the business timezone (Jakarta).
const TZ = 'Asia/Jakarta';
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
const UTC = 'UTC';

// Matches the "Peak Hours" buckets rendered on the dashboard.
const HOUR_SLOTS = [
  { hour: '00:00', start: 0, end: 4 },
  { hour: '04:00', start: 4, end: 8 },
  { hour: '08:00', start: 8, end: 12 },
  { hour: '12:00', start: 12, end: 16 },
  { hour: '16:00', start: 16, end: 20 },
  { hour: '20:00', start: 20, end: 24 },
];

export interface DashboardStats {
  totalConversations: number;
  openConversations: number;
  resolvedConversations: number;
  totalMessages: number;
  todayMessages: number;
  totalContacts: number;
  newContactsToday: number;
  messageVolume: Array<{ day: string; messages: number }>;
  peakHours: Array<{ hour: string; messages: number }>;
  labelDistribution: Array<{ id: string; name: string; color: string; value: number }>;
}

/**
 * Aggregated business stats for the dashboard. Everything is computed server-side in
 * one batch (a handful of COUNT queries + two grouped raw queries) instead of the old
 * client approach that fetched a capped slice of conversations and summed messages
 * from only a couple of them — which made every number under-report.
 */
export class DashboardService {
  async getStats(): Promise<DashboardStats> {
    const now = new Date();
    // The exact UTC instant that starts "today" in Jakarta (e.g. 2026-08-29T17:00Z =
    // 2026-08-30 00:00 Jakarta), and 6 days earlier for the trailing 7-day window.
    const jktWall = new Date(now.getTime() + TZ_OFFSET_MS);
    const startToday = new Date(
      Date.UTC(jktWall.getUTCFullYear(), jktWall.getUTCMonth(), jktWall.getUTCDate()) - TZ_OFFSET_MS
    );
    const start7Days = new Date(startToday.getTime() - 6 * MS_DAY);

    const [
      totalConversations,
      openConversations,
      resolvedConversations,
      totalMessages,
      todayMessages,
      totalContacts,
      newContactsToday,
      volumeRows,
      peakRows,
      labelRefs,
      labelCounts,
    ] = await Promise.all([
      prisma.conversation.count(),
      prisma.conversation.count({ where: { status: 'OPEN' } }),
      prisma.conversation.count({ where: { status: 'RESOLVED' } }),
      prisma.message.count(),
      prisma.message.count({ where: { timestamp: { gte: startToday } } }),
      prisma.contact.count(),
      prisma.contact.count({ where: { createdAt: { gte: startToday } } }),
      prisma.$queryRaw<Array<{ day: string; cnt: number }>>`
        SELECT to_char("timestamp" AT TIME ZONE ${UTC} AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day, COUNT(*)::int AS cnt
        FROM messages
        WHERE "timestamp" >= ${start7Days}
        GROUP BY 1
      `,
      prisma.$queryRaw<Array<{ slot: number; cnt: number }>>`
        SELECT (EXTRACT(HOUR FROM ("timestamp" AT TIME ZONE ${UTC} AT TIME ZONE ${TZ}))::int / 4) AS slot, COUNT(*)::int AS cnt
        FROM messages
        WHERE "timestamp" >= ${start7Days} AND direction = 'inbound'
        GROUP BY 1
      `,
      prisma.label.findMany({ select: { id: true, name: true, color: true } }),
      prisma.contactLabel.groupBy({ by: ['labelId'], _count: { _all: true } }),
    ]);

    const volumeByDay = new Map(volumeRows.map(r => [r.day, Number(r.cnt)]));
    const messageVolume = Array.from({ length: 7 }, (_, i) => {
      const inst = new Date(startToday.getTime() - (6 - i) * MS_DAY);
      const wall = new Date(inst.getTime() + TZ_OFFSET_MS);
      const dayName = wall.toLocaleDateString('en-US', { weekday: 'short', timeZone: UTC });
      const key = wall.toISOString().slice(0, 10);
      return { day: dayName, messages: volumeByDay.get(key) ?? 0 };
    });

    const peakBySlot = new Map(peakRows.map(r => [Number(r.slot), Number(r.cnt)]));
    const peakHours = HOUR_SLOTS.map(slot => ({
      hour: slot.hour,
      messages: peakBySlot.get(slot.start / 4) ?? 0,
    }));

    const countByLabel = new Map(labelCounts.map(l => [l.labelId, l._count._all]));
    const labelDistribution = labelRefs
      .map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        value: countByLabel.get(label.id) ?? 0,
      }))
      .filter(entry => entry.value > 0)
      .sort((a, b) => b.value - a.value);

    return {
      totalConversations,
      openConversations,
      resolvedConversations,
      totalMessages,
      todayMessages,
      totalContacts,
      newContactsToday,
      messageVolume,
      peakHours,
      labelDistribution,
    };
  }
}

export const dashboardService = new DashboardService();
