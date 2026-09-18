import prisma from '../config/database';

const MS_DAY = 86_400_000;
// Same convention as dashboard.service.ts: timestamps are stored as naive UTC,
// interpreted here in the Asia/Jakarta business timezone.
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;
// Response-time gaps longer than this are almost always "agent was offline
// overnight" rather than a real response-time problem, so they're excluded
// to keep the average meaningful.
const MAX_RESPONSE_GAP_MINUTES = 4 * 60;

export type DashboardPeriod = 'today' | 'week' | 'month' | 'custom';

export interface AgentPerformanceRow {
  id: string;
  name: string;
  role: string;
  avatar: string | null;
  isBot: boolean;
  status: string;
  statusUpdatedAt: Date | null;
  openConversations: number;
  resolvedConversations: number;
  totalConversations: number;
  messagesSent: number;
  messagesSentTotal: number;
  avgResponseMinutes: number | null;
  activeMinutes: number;
}

export interface AgentPerformanceStats {
  range: { start: string; end: string };
  summary: {
    totalAgents: number;
    activeNow: number;
    messagesSent: number;
    messagesSentByBot: number;
    messagesSentByHuman: number;
    resolvedInRange: number;
    avgResponseMinutes: number | null;
    totalActiveHours: number;
  };
  agents: AgentPerformanceRow[];
}

function startOfDayJakarta(date: Date): Date {
  const jktWall = new Date(date.getTime() + TZ_OFFSET_MS);
  return new Date(Date.UTC(jktWall.getUTCFullYear(), jktWall.getUTCMonth(), jktWall.getUTCDate()) - TZ_OFFSET_MS);
}

function resolveRange(period: DashboardPeriod, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  const todayStart = startOfDayJakarta(now);
  const todayEnd = new Date(todayStart.getTime() + MS_DAY);

  if (period === 'custom' && customStart && customEnd) {
    const start = startOfDayJakarta(new Date(customStart));
    const end = new Date(startOfDayJakarta(new Date(customEnd)).getTime() + MS_DAY);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
      return { start, end };
    }
  }

  if (period === 'week') {
    const jktWall = new Date(todayStart.getTime() + TZ_OFFSET_MS);
    const daysSinceMonday = (jktWall.getUTCDay() + 6) % 7; // Monday = 0
    return { start: new Date(todayStart.getTime() - daysSinceMonday * MS_DAY), end: todayEnd };
  }

  if (period === 'month') {
    const jktWall = new Date(todayStart.getTime() + TZ_OFFSET_MS);
    const start = new Date(Date.UTC(jktWall.getUTCFullYear(), jktWall.getUTCMonth(), 1) - TZ_OFFSET_MS);
    return { start, end: todayEnd };
  }

  return { start: todayStart, end: todayEnd };
}

class AgentPerformanceService {
  async getStats(
    role: string,
    companyId: string,
    period: DashboardPeriod = 'today',
    customStart?: string,
    customEnd?: string
  ): Promise<AgentPerformanceStats> {
    const now = new Date();
    const { start: rangeStart, end: rangeEnd } = resolveRange(period, customStart, customEnd);

    const agentWhere = role === 'SUPER_ADMIN' ? { isActive: true } : { isActive: true, companyId };

    const [agents, conversationCounts, resolvedInRange, messagesTotal, messagesInRange, activeLogsInRange, responseRows] = await Promise.all([
      prisma.agent.findMany({
        where: agentWhere,
        select: { id: true, name: true, role: true, avatar: true, isBot: true, status: true, statusUpdatedAt: true },
        orderBy: { name: 'asc' },
      }),
      prisma.conversation.groupBy({
        by: ['assignedAgentId', 'status'],
        where: { assignedAgentId: { not: null } },
        _count: { _all: true },
      }),
      prisma.conversation.count({ where: { status: 'RESOLVED', updatedAt: { gte: rangeStart, lt: rangeEnd } } }),
      prisma.message.groupBy({
        by: ['senderId'],
        where: { direction: 'OUTBOUND', senderId: { not: null } },
        _count: { _all: true },
      }),
      prisma.message.groupBy({
        by: ['senderId'],
        where: { direction: 'OUTBOUND', senderId: { not: null }, timestamp: { gte: rangeStart, lt: rangeEnd } },
        _count: { _all: true },
      }),
      prisma.agentStatusLog.findMany({
        where: {
          status: 'ACTIVE',
          startedAt: { lt: rangeEnd },
          OR: [{ endedAt: null }, { endedAt: { gt: rangeStart } }],
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
          WHERE "timestamp" >= ${rangeStart} AND "timestamp" < ${rangeEnd}
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
    const messagesInRangeByAgent = new Map(messagesInRange.map((r) => [r.senderId as string, r._count._all]));

    const activeMinutesByAgent = new Map<string, number>();
    for (const log of activeLogsInRange) {
      const segStart = Math.max(log.startedAt.getTime(), rangeStart.getTime());
      const segEnd = Math.min((log.endedAt ?? now).getTime(), rangeEnd.getTime());
      const minutes = Math.max(0, (segEnd - segStart) / 60_000);
      activeMinutesByAgent.set(log.agentId, (activeMinutesByAgent.get(log.agentId) ?? 0) + minutes);
    }

    const responseByAgent = new Map(responseRows.map((r) => [r.agentId, { avg: Number(r.avgMinutes), count: r.sampleCount }]));

    const agentRows: AgentPerformanceRow[] = agents.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      avatar: a.avatar,
      isBot: a.isBot,
      status: a.status,
      statusUpdatedAt: a.statusUpdatedAt,
      openConversations: openByAgent.get(a.id) ?? 0,
      resolvedConversations: resolvedByAgent.get(a.id) ?? 0,
      totalConversations: totalByAgent.get(a.id) ?? 0,
      messagesSent: messagesInRangeByAgent.get(a.id) ?? 0,
      messagesSentTotal: messagesTotalByAgent.get(a.id) ?? 0,
      avgResponseMinutes: responseByAgent.get(a.id)?.avg ?? null,
      activeMinutes: Math.round(activeMinutesByAgent.get(a.id) ?? 0),
    }));

    const responseSamples = agentRows
      .map((a) => ({ agentId: a.id, ...responseByAgent.get(a.id) }))
      .filter((r): r is { agentId: string; avg: number; count: number } => r.avg !== undefined);
    const totalSamples = responseSamples.reduce((sum, r) => sum + r.count, 0);
    const avgResponseMinutes = totalSamples > 0
      ? responseSamples.reduce((sum, r) => sum + r.avg * r.count, 0) / totalSamples
      : null;

    return {
      range: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
      summary: {
        totalAgents: agentRows.length,
        activeNow: agentRows.filter((a) => a.status === 'ACTIVE').length,
        messagesSent: agentRows.reduce((sum, a) => sum + a.messagesSent, 0),
        messagesSentByBot: agentRows.filter((a) => a.isBot).reduce((sum, a) => sum + a.messagesSent, 0),
        messagesSentByHuman: agentRows.filter((a) => !a.isBot).reduce((sum, a) => sum + a.messagesSent, 0),
        resolvedInRange,
        avgResponseMinutes,
        totalActiveHours: Math.round((agentRows.reduce((sum, a) => sum + a.activeMinutes, 0) / 60) * 10) / 10,
      },
      agents: agentRows,
    };
  }
}

export const agentPerformanceService = new AgentPerformanceService();
