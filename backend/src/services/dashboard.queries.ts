import prisma from '../config/database';

// The app stores message timestamps as UTC wall-clock values in a naive
// `timestamp without time zone` column, so we interpret them as UTC and render
// day/hour buckets in the business timezone (Jakarta).
const TZ = 'Asia/Jakarta';
const UTC = 'UTC';
// Extra history read before the SLA window so the first customer message in it can
// still tell whether it opened a new "turn" or continued an unanswered one.
const SLA_LOOKBACK_MS = 86_400_000;

export interface DayDirectionCount {
  day: string;
  direction: 'inbound' | 'outbound';
  count: number;
}

export interface SlaCounts {
  met: number;
  total: number;
}

/** Messages per Jakarta calendar day and direction, from `start` onwards. */
export async function fetchMessageTrendRows(start: Date): Promise<DayDirectionCount[]> {
  const rows = await prisma.$queryRaw<Array<{ day: string; direction: string; cnt: number }>>`
    SELECT
      to_char("timestamp" AT TIME ZONE ${UTC} AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day,
      direction::text AS direction,
      COUNT(*)::int AS cnt
    FROM messages
    WHERE "timestamp" >= ${start}
    GROUP BY 1, 2
  `;
  return rows.map((r) => ({
    day: r.day,
    direction: r.direction === 'inbound' ? 'inbound' : 'outbound',
    count: Number(r.cnt),
  }));
}

/** Inbound messages per 4-hour Jakarta slot (0 = 00:00-04:00 .. 5 = 20:00-24:00). */
export async function fetchPeakSlotRows(start: Date): Promise<Map<number, number>> {
  const rows = await prisma.$queryRaw<Array<{ slot: number; cnt: number }>>`
    SELECT (EXTRACT(HOUR FROM ("timestamp" AT TIME ZONE ${UTC} AT TIME ZONE ${TZ}))::int / 4) AS slot, COUNT(*)::int AS cnt
    FROM messages
    WHERE "timestamp" >= ${start} AND direction = 'inbound'
    GROUP BY 1
  `;
  return new Map(rows.map((r) => [Number(r.slot), Number(r.cnt)]));
}

/** Conversations with any activity since `start`, per contact channel ('WHATSAPP', ...). */
export async function fetchChannelCounts(start: Date): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ channel: string; cnt: number }>>`
    SELECT ct.channel::text AS channel, COUNT(*)::int AS cnt
    FROM conversations cv
    JOIN contacts ct ON ct.id = cv."contactId"
    WHERE cv."lastMessageAt" >= ${start}
    GROUP BY 1
  `;
  return new Map(rows.map((r) => [r.channel.toUpperCase(), Number(r.cnt)]));
}

/**
 * SLA = share of customer "turns" answered by an agent within the target. A turn starts
 * at a customer message that isn't continuing an already-unanswered one, and is answered
 * by the first later agent reply (auto-replies don't count). Turns still waiting but not
 * yet past the target are left out: they can't be judged yet. Returns the current period
 * [start, end) and the previous one [prevStart, start) from a single scan.
 */
export async function fetchSlaCounts(params: {
  prevStart: Date;
  start: Date;
  end: Date;
  now: Date;
  targetMinutes: number;
}): Promise<{ current: SlaCounts; previous: SlaCounts }> {
  const { prevStart, start, end, now, targetMinutes } = params;
  const lookbackStart = new Date(prevStart.getTime() - SLA_LOOKBACK_MS);
  // A turn that has gone unanswered since before this instant has already breached.
  const breachCutoff = new Date(now.getTime() - targetMinutes * 60_000);
  const targetSeconds = targetMinutes * 60;

  const rows = await prisma.$queryRaw<Array<{ is_current: boolean; met: number; total: number }>>`
    WITH msgs AS (
      SELECT
        "conversationId",
        "timestamp",
        direction,
        LAG(direction) OVER (PARTITION BY "conversationId" ORDER BY "timestamp") AS prev_direction
      FROM messages
      WHERE "timestamp" >= ${lookbackStart} AND "timestamp" < ${end}
        AND COALESCE(metadata->>'autoReply', 'false') <> 'true'
    ),
    turns AS (
      SELECT "conversationId", "timestamp" AS asked_at, ("timestamp" >= ${start}) AS is_current
      FROM msgs
      WHERE direction = 'inbound'
        AND (prev_direction IS NULL OR prev_direction = 'outbound')
        AND "timestamp" >= ${prevStart}
    )
    SELECT
      t.is_current,
      COUNT(*) FILTER (
        WHERE r.replied_at IS NOT NULL AND EXTRACT(EPOCH FROM (r.replied_at - t.asked_at)) <= ${targetSeconds}
      )::int AS met,
      COUNT(*) FILTER (WHERE r.replied_at IS NOT NULL OR t.asked_at < ${breachCutoff})::int AS total
    FROM turns t
    LEFT JOIN LATERAL (
      SELECT MIN(m."timestamp") AS replied_at
      FROM messages m
      WHERE m."conversationId" = t."conversationId"
        AND m.direction = 'outbound'
        AND m."timestamp" > t.asked_at
        AND m."senderId" IS NOT NULL
        AND COALESCE(m.metadata->>'autoReply', 'false') <> 'true'
    ) r ON true
    GROUP BY t.is_current
  `;

  const pick = (isCurrent: boolean): SlaCounts => {
    const row = rows.find((r) => r.is_current === isCurrent);
    return { met: Number(row?.met ?? 0), total: Number(row?.total ?? 0) };
  };
  return { current: pick(true), previous: pick(false) };
}
