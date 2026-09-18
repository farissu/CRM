import type { AgentStatus, StatusChangeSource } from '@prisma/client';
import prisma from '../config/database';
import { io } from '../index';

const STATUS_SELECT = { id: true, name: true, status: true, statusUpdatedAt: true } as const;

interface StatusHistoryPage {
  logs: Array<{
    id: string;
    status: AgentStatus;
    source: StatusChangeSource;
    startedAt: Date;
    endedAt: Date | null;
  }>;
  total: number;
  page: number;
  limit: number;
}

class PresenceService {
  async setStatus(agentId: string, status: AgentStatus, source: StatusChangeSource) {
    const now = new Date();

    const agent = await prisma.$transaction(async (tx) => {
      const openLog = await tx.agentStatusLog.findFirst({
        where: { agentId, endedAt: null },
        orderBy: { startedAt: 'desc' },
      });

      if (openLog?.status === status) {
        return tx.agent.findUniqueOrThrow({ where: { id: agentId }, select: STATUS_SELECT });
      }

      if (openLog) {
        await tx.agentStatusLog.update({ where: { id: openLog.id }, data: { endedAt: now } });
      }

      await tx.agentStatusLog.create({ data: { agentId, status, source, startedAt: now } });

      return tx.agent.update({
        where: { id: agentId },
        data: { status, statusUpdatedAt: now },
        select: STATUS_SELECT,
      });
    });

    io.emit('agent_status_updated', agent);
    return agent;
  }

  async getHistory(agentId: string, page: number, limit: number): Promise<StatusHistoryPage> {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.agentStatusLog.findMany({
        where: { agentId },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        select: { id: true, status: true, source: true, startedAt: true, endedAt: true },
      }),
      prisma.agentStatusLog.count({ where: { agentId } }),
    ]);

    return { logs, total, page, limit };
  }
}

export const presenceService = new PresenceService();
