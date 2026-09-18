import prisma from '../config/database';

const MS_DAY = 86_400_000;
// Same convention as dashboard.service.ts: timestamps are stored as naive UTC,
// interpreted here in the Asia/Jakarta business timezone.
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
// First-response time is only meaningful within a recent window, and gaps longer
// than this are almost always "agent was offline overnight" rather than a real
// response-time problem, so they're excluded to keep the average meaningful.
const RESPONSE_WINDOW_DAYS = 30;
const MAX_RESPONSE_GAP_MINUTES = 4 * 60;

export interface AgentPerformanceRow {
  id: string;
  name: string;
  role: string;
  avatar: string | null;
  status: string;
  statusUpdatedAt: Date | null;
  openConversations: number;
  resolvedConversations: number;
  totalConversations: number;
  messagesSentToday: number;
  messagesSentTotal: number;
  avgResponseMinutes: number | null;
  activeMinutesToday: number;
}

export interface AgentPerformanceStats {
  summary: {
    totalAgents: number;
    activeNow: number;
    messagesSentToday: number;
    resolvedToday: number;
    avgResponseMinutes: number | null;
    totalActiveHoursToday: number;
  };
  agents: AgentPerformanceRow[];
}

function startOfTodayJakarta(now: Date): Date {
  const jktWall = new Date(now.getTime() + TZ_OFFSET_MS);
  return new Date(Date.UTC(jktWall.getUTCFullYear(), jktWall.getUTCMonth(), jktWall.getUTCDate()) - TZ_OFFSET_MS);
}

class AgentPerformanceService {
  async getStats(role: string, companyId: string): Promise<AgentPerformanceStats> {
    const now = new Date();
    const startToday = startOfTodayJakarta(now);
    const endToday = new Date(startToday.getTime() + MS_DAY);
    const responseWindowStart = new Date(startToday.getTime() - RESPONSE_WINDOW_DAYS * MS_DAY);

    const agentWhere = role === 'SUPER_ADMIN' ? { isActive: true } : { isActive: true, companyId };

    const [agents, conversationCounts, resolvedToday, messagesTotal, messagesToday, activeLogsToday, responseRows] = await Promise.all([
      prisma.agent.findMany({
        where: agentWhere,
        select: { id: true, name: true, role: true, avatar: true, status: true, statusUpdatedAt: true },
        orderBy: { name: 'asc' },
      }),
      prisma.conversation.groupBy({
        by: ['assignedAgentId', 'status'],
        where: { assignedAgentId: { not: null } },
        _count: { _all: true },
      }),
      prisma.conversation.count({ where: { status: 'RESOLVED', updatedAt: { gte: startToday } } }),
      prisma.message.groupBy({
        by: ['senderId'],
        where: { direction: 'OUTBOUND', senderId: { not: null } },
        _count: { _all: true },
      }),
      prisma.message.groupBy({
        by: ['senderId'],
        where: { direction: 'OUTBOUND', senderId: { not: null }, timestamp: { gte: startToday } },
        _count: { _all: true },
      }),
      prisma.agentStatusLog.findMany({
        where: {
          status: 'ACTIVE',
          startedAt: { lt: endToday },
          OR: [{ endedAt: null }, { endedAt: { gt: startToday } }],
        },
        select: { agentId: true, startedAt: true, endedAt: true },
      }),
      prisma.$queryRaw<Array<{ agentId: string; sampleCount: number; avgMinutes: number }>>`
        WITH ordered AS (
          SELECT
            "senderId",
            "timestamp",
            direction,
            LAG(direction) OVER (PARTITION BY "conversationId" ORDER BY "timestamp") AS prev_direction,
            LAG("timestamp") OVER (PARTITION BY "conversationId" ORDER BY "timestamp") AS prev_timestamp
          FROM messages
          WHERE "timestamp" >= ${responseWindowStart}
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
      `,
    ]);

    const openByAgent = new Map<string, number>();
    const resolvedByAgent = new Map<string, number>();
    const totalByAgent = new Map<string, number>();
    for (const row of conversationCounts) {
      const agentId = row.assignedAgentId;
      if (!agentId) continue;
      const count = row._count._all;
      totalByAgent.set(agentId, (totalByAgent.get(agentId) ?? 0) + count);
      if (row.status === 'OPEN') openByAgent.set(agentId, (openByAgent.get(agentId) ?? 0) + count);
      if (row.status === 'RESOLVED') resolvedByAgent.set(agentId, (resolvedByAgent.get(agentId) ?? 0) + count);
    }

    const messagesTotalByAgent = new Map(messagesTotal.map((r) => [r.senderId as string, r._count._all]));
    const messagesTodayByAgent = new Map(messagesToday.map((r) => [r.senderId as string, r._count._all]));

    const activeMinutesByAgent = new Map<string, number>();
    for (const log of activeLogsToday) {
      const segStart = Math.max(log.startedAt.getTime(), startToday.getTime());
      const segEnd = Math.min((log.endedAt ?? now).getTime(), endToday.getTime());
      const minutes = Math.max(0, (segEnd - segStart) / 60_000);
      activeMinutesByAgent.set(log.agentId, (activeMinutesByAgent.get(log.agentId) ?? 0) + minutes);
    }

    const responseByAgent = new Map(responseRows.map((r) => [r.agentId, { avg: Number(r.avgMinutes), count: r.sampleCount }]));

    const agentRows: AgentPerformanceRow[] = agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      avatar: a.avatar,
      status: a.status,
      statusUpdatedAt: a.statusUpdatedAt,
      openConversations: openByAgent.get(a.id) ?? 0,
      resolvedConversations: resolvedByAgent.get(a.id) ?? 0,
      totalConversations: totalByAgent.get(a.id) ?? 0,
      messagesSentToday: messagesTodayByAgent.get(a.id) ?? 0,
      messagesSentTotal: messagesTotalByAgent.get(a.id) ?? 0,
      avgResponseMinutes: responseByAgent.get(a.id)?.avg ?? null,
      activeMinutesToday: Math.round(activeMinutesByAgent.get(a.id) ?? 0),
    }));

    const responseSamples = agentRows
      .map((a) => ({ agentId: a.id, ...responseByAgent.get(a.id) }))
      .filter((r): r is { agentId: string; avg: number; count: number } => r.avg !== undefined);
    const totalSamples = responseSamples.reduce((sum, r) => sum + r.count, 0);
    const avgResponseMinutes = totalSamples > 0
      ? responseSamples.reduce((sum, r) => sum + r.avg * r.count, 0) / totalSamples
      : null;

    return {
      summary: {
        totalAgents: agentRows.length,
        activeNow: agentRows.filter((a) => a.status === 'ACTIVE').length,
        messagesSentToday: agentRows.reduce((sum, a) => sum + a.messagesSentToday, 0),
        resolvedToday,
        avgResponseMinutes,
        totalActiveHoursToday: Math.round((agentRows.reduce((sum, a) => sum + a.activeMinutesToday, 0) / 60) * 10) / 10,
      },
      agents: agentRows,
    };
  }
}

export const agentPerformanceService = new AgentPerformanceService();
