import prisma from '../config/database';

// Response-time gaps longer than this are almost always "agent was offline
// overnight" rather than a real response-time problem, so they're excluded
// to keep the average meaningful.
const MAX_RESPONSE_GAP_MINUTES = 4 * 60;

export interface AgentResponseTime {
  agentId: string;
  sampleCount: number;
  avgMinutes: number;
}

/**
 * Average minutes between a customer message and the agent reply that directly follows
 * it, per replying agent, for replies sent in [start, end). Outside-hours auto-replies
 * (metadata.autoReply) are dropped entirely: they aren't a human response, and leaving
 * them in the window would also hide the real reply that comes after them.
 */
export async function fetchResponseTimesByAgent(start: Date, end: Date): Promise<AgentResponseTime[]> {
  const rows = await prisma.$queryRaw<Array<{ agentId: string; sampleCount: number; avgMinutes: number }>>`
    WITH ordered AS (
      SELECT
        "senderId",
        "timestamp",
        direction,
        LAG(direction) OVER (PARTITION BY "conversationId" ORDER BY "timestamp") AS prev_direction,
        LAG("timestamp") OVER (PARTITION BY "conversationId" ORDER BY "timestamp") AS prev_timestamp
      FROM messages
      WHERE "timestamp" >= ${start} AND "timestamp" < ${end}
        AND COALESCE(metadata->>'autoReply', 'false') <> 'true'
    )
    SELECT
      "senderId" AS "agentId",
      COUNT(*)::int AS "sampleCount",
      AVG(EXTRACT(EPOCH FROM ("timestamp" - prev_timestamp)) / 60) AS "avgMinutes"
    FROM ordered
    WHERE direction = 'outbound'
      AND prev_direction = 'inbound'
      AND "senderId" IS NOT NULL
      AND EXTRACT(EPOCH FROM ("timestamp" - prev_timestamp)) / 60 <= ${MAX_RESPONSE_GAP_MINUTES}
    GROUP BY "senderId"
  `;

  return rows.map((r) => ({ agentId: r.agentId, sampleCount: Number(r.sampleCount), avgMinutes: Number(r.avgMinutes) }));
}

/** Sample-weighted mean across agents, or null when nobody replied in the range. */
export function weightedAverageMinutes(rows: readonly AgentResponseTime[]): number | null {
  const totalSamples = rows.reduce((sum, r) => sum + r.sampleCount, 0);
  if (totalSamples === 0) return null;
  return rows.reduce((sum, r) => sum + r.avgMinutes * r.sampleCount, 0) / totalSamples;
}
