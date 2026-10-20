import { Channel } from '@prisma/client';
import prisma from '../config/database';
import { fetchResponseTimesByAgent, weightedAverageMinutes, AgentResponseTime } from './responseTime';
import { fetchChannelCounts, fetchMessageTrendRows, fetchPeakSlotRows, fetchSlaCounts, SlaCounts } from './dashboard.queries';

const MS_DAY = 86_400_000;
// Timestamps are naive UTC; day boundaries are drawn in Jakarta (UTC+7).
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

export const DASHBOARD_RANGE_DAYS = [7, 30] as const;
export type DashboardRangeDays = (typeof DASHBOARD_RANGE_DAYS)[number];

// A customer message counts as handled on time when an agent replies within this window.
export const SLA_TARGET_HOURS = 4;
const TOP_AGENT_LIMIT = 5;
const ALERT_TEMPLATE_LIMIT = 3;
const PROBLEM_TEMPLATE_STATUSES = ['REJECTED', 'PAUSED', 'DISABLED'] as const;

// Matches the "Peak Hours" buckets rendered on the dashboard.
const HOUR_SLOTS = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];

export interface DashboardScope {
  role: string;
  companyId: string;
}

export interface DashboardStats {
  range: { days: number; start: string; end: string };
  kpis: {
    avgResponseMinutes: number | null;
    prevAvgResponseMinutes: number | null;
    resolvedConversations: number;
    prevResolvedConversations: number;
    activeConversations: number;
    sla: { targetHours: number; met: number; total: number; prevMet: number; prevTotal: number };
    agents: { online: number; total: number };
  };
  messageTrend: Array<{ date: string; inbound: number; outbound: number }>;
  channelDistribution: Array<{ channel: Channel; conversations: number }>;
  awaitingReply: { total: number; unassigned: number };
  topAgents: Array<{ id: string; name: string; avatar: string | null; resolved: number; avgResponseMinutes: number | null }>;
  alerts: {
    failedMessages: number;
    problemTemplateCount: number;
    problemTemplates: Array<{ id: string; name: string; status: string }>;
    failedBroadcasts: number;
    failedBroadcastRecipients: number;
  };
  peakHours: Array<{ hour: string; messages: number }>;
  labelDistribution: Array<{ id: string; name: string; color: string; value: number }>;
  contacts: { total: number; newInRange: number };
}

interface DashboardRange {
  days: number;
  now: Date;
  start: Date;
  prevStart: Date;
}

function resolveRange(days: DashboardRangeDays): DashboardRange {
  const now = new Date();
  // The UTC instant that starts "today" in Jakarta; the window covers today plus the
  // previous days - 1 days, and the comparison window is the same length right before it.
  const jktWall = new Date(now.getTime() + TZ_OFFSET_MS);
  const startToday = new Date(
    Date.UTC(jktWall.getUTCFullYear(), jktWall.getUTCMonth(), jktWall.getUTCDate()) - TZ_OFFSET_MS
  );
  const start = new Date(startToday.getTime() - (days - 1) * MS_DAY);
  return { days, now, start, prevStart: new Date(start.getTime() - days * MS_DAY) };
}

/** Jakarta 'YYYY-MM-DD' keys for every day in the range, oldest first. */
function dayKeys(range: DashboardRange): string[] {
  return Array.from({ length: range.days }, (_, i) =>
    new Date(range.start.getTime() + i * MS_DAY + TZ_OFFSET_MS).toISOString().slice(0, 10)
  );
}

/**
 * Aggregated business stats for the admin dashboard, all computed server-side in one
 * batch. Conversations/messages are deployment-wide (one deployment serves one business);
 * agents, templates and broadcasts are company-scoped unless the caller is SUPER_ADMIN.
 */
export class DashboardService {
  async getStats(scope: DashboardScope, days: DashboardRangeDays): Promise<DashboardStats> {
    const range = resolveRange(days);
    const companyWhere = scope.role === 'SUPER_ADMIN' ? {} : { companyId: scope.companyId };

    const [kpis, charts, awaitingReply, topAgents, alerts, contacts] = await Promise.all([
      this.loadKpis(range, companyWhere),
      this.loadCharts(range),
      this.loadAwaitingReply(),
      this.loadTopAgents(range, companyWhere),
      this.loadAlerts(range, companyWhere),
      this.loadContacts(range),
    ]);

    return {
      range: { days, start: range.start.toISOString(), end: range.now.toISOString() },
      kpis,
      ...charts,
      awaitingReply,
      topAgents,
      alerts,
      contacts,
    };
  }

  private async loadKpis(range: DashboardRange, companyWhere: { companyId?: string }): Promise<DashboardStats['kpis']> {
    const humanAgentWhere = { ...companyWhere, isActive: true, isBot: false };
    const [responseNow, responsePrev, resolved, prevResolved, activeConversations, sla, agentsTotal, agentsOnline] =
      await Promise.all([
        fetchResponseTimesByAgent(range.start, range.now),
        fetchResponseTimesByAgent(range.prevStart, range.start),
        prisma.conversation.count({ where: { status: 'RESOLVED', updatedAt: { gte: range.start } } }),
        prisma.conversation.count({ where: { status: 'RESOLVED', updatedAt: { gte: range.prevStart, lt: range.start } } }),
        prisma.conversation.count({ where: { lastMessageAt: { gte: range.start } } }),
        fetchSlaCounts({
          prevStart: range.prevStart,
          start: range.start,
          end: range.now,
          now: range.now,
          targetMinutes: SLA_TARGET_HOURS * 60,
        }),
        prisma.agent.count({ where: humanAgentWhere }),
        prisma.agent.count({ where: { ...humanAgentWhere, status: 'ACTIVE' } }),
      ]);

    return {
      avgResponseMinutes: weightedAverageMinutes(responseNow),
      prevAvgResponseMinutes: weightedAverageMinutes(responsePrev),
      resolvedConversations: resolved,
      prevResolvedConversations: prevResolved,
      activeConversations,
      sla: toSlaKpi(sla.current, sla.previous),
      agents: { online: agentsOnline, total: agentsTotal },
    };
  }

  private async loadCharts(range: DashboardRange) {
    const [trendRows, peakBySlot, channelCounts, labelRefs, labelCounts] = await Promise.all([
      fetchMessageTrendRows(range.start),
      fetchPeakSlotRows(range.start),
      fetchChannelCounts(range.start),
      prisma.label.findMany({ select: { id: true, name: true, color: true } }),
      prisma.contactLabel.groupBy({ by: ['labelId'], _count: { _all: true } }),
    ]);

    const messageTrend = dayKeys(range).map((date) => ({
      date,
      inbound: trendRows.find((r) => r.day === date && r.direction === 'inbound')?.count ?? 0,
      outbound: trendRows.find((r) => r.day === date && r.direction === 'outbound')?.count ?? 0,
    }));

    const channelDistribution = Object.values(Channel).map((channel) => ({
      channel,
      conversations: channelCounts.get(channel) ?? 0,
    }));

    const peakHours = HOUR_SLOTS.map((hour, slot) => ({ hour, messages: peakBySlot.get(slot) ?? 0 }));

    const countByLabel = new Map(labelCounts.map((l) => [l.labelId, l._count._all]));
    const labelDistribution = labelRefs
      .map((label) => ({ ...label, value: countByLabel.get(label.id) ?? 0 }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value);

    return { messageTrend, channelDistribution, peakHours, labelDistribution };
  }

  /** Open/pending conversations whose last message is from the customer. */
  private async loadAwaitingReply(): Promise<DashboardStats['awaitingReply']> {
    const where = { status: { in: ['OPEN' as const, 'PENDING' as const] }, lastMessageDirection: 'INBOUND' as const };
    const [total, unassigned] = await Promise.all([
      prisma.conversation.count({ where }),
      prisma.conversation.count({ where: { ...where, assignedAgentId: null } }),
    ]);
    return { total, unassigned };
  }

  private async loadTopAgents(range: DashboardRange, companyWhere: { companyId?: string }): Promise<DashboardStats['topAgents']> {
    const [agents, resolvedRows, responseRows] = await Promise.all([
      prisma.agent.findMany({
        where: { ...companyWhere, isActive: true, isBot: false },
        select: { id: true, name: true, avatar: true },
      }),
      prisma.conversation.groupBy({
        by: ['assignedAgentId'],
        where: { status: 'RESOLVED', assignedAgentId: { not: null }, updatedAt: { gte: range.start } },
        _count: { _all: true },
      }),
      fetchResponseTimesByAgent(range.start, range.now),
    ]);

    const resolvedByAgent = new Map(resolvedRows.map((r) => [r.assignedAgentId as string, r._count._all]));
    const responseByAgent = new Map<string, AgentResponseTime>(responseRows.map((r) => [r.agentId, r]));

    return agents
      .map((a) => ({
        ...a,
        resolved: resolvedByAgent.get(a.id) ?? 0,
        avgResponseMinutes: responseByAgent.get(a.id)?.avgMinutes ?? null,
      }))
      .filter((a) => a.resolved > 0)
      .sort((a, b) => b.resolved - a.resolved)
      .slice(0, TOP_AGENT_LIMIT);
  }

  private async loadAlerts(range: DashboardRange, companyWhere: { companyId?: string }): Promise<DashboardStats['alerts']> {
    const templateWhere = { ...companyWhere, status: { in: [...PROBLEM_TEMPLATE_STATUSES] } };
    const [failedMessages, problemTemplateCount, problemTemplates, broadcasts] = await Promise.all([
      prisma.message.count({ where: { direction: 'OUTBOUND', status: 'FAILED', timestamp: { gte: range.start } } }),
      prisma.messageTemplate.count({ where: templateWhere }),
      prisma.messageTemplate.findMany({
        where: templateWhere,
        select: { id: true, name: true, status: true },
        orderBy: { updatedAt: 'desc' },
        take: ALERT_TEMPLATE_LIMIT,
      }),
      prisma.broadcast.aggregate({
        where: { ...companyWhere, createdAt: { gte: range.start }, OR: [{ status: 'FAILED' }, { failedCount: { gt: 0 } }] },
        _count: { _all: true },
        _sum: { failedCount: true },
      }),
    ]);

    return {
      failedMessages,
      problemTemplateCount,
      problemTemplates,
      failedBroadcasts: broadcasts._count._all,
      failedBroadcastRecipients: broadcasts._sum.failedCount ?? 0,
    };
  }

  private async loadContacts(range: DashboardRange): Promise<DashboardStats['contacts']> {
    const [total, newInRange] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({ where: { createdAt: { gte: range.start } } }),
    ]);
    return { total, newInRange };
  }
}

function toSlaKpi(current: SlaCounts, previous: SlaCounts): DashboardStats['kpis']['sla'] {
  return {
    targetHours: SLA_TARGET_HOURS,
    met: current.met,
    total: current.total,
    prevMet: previous.met,
    prevTotal: previous.total,
  };
}

export const dashboardService = new DashboardService();
