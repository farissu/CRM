import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

export interface BroadcastJobData {
  broadcastId: string;
}

export const broadcastQueue = new Queue<BroadcastJobData>('broadcast', {
  connection: redisConnection,
});

export async function enqueueBroadcast(broadcastId: string, sendAt?: Date) {
  const delay = sendAt ? Math.max(0, sendAt.getTime() - Date.now()) : 0;
  return broadcastQueue.add(
    'send-broadcast',
    { broadcastId },
    { delay, jobId: broadcastId, removeOnComplete: true, removeOnFail: 100 }
  );
}

export async function cancelBroadcastJob(broadcastId: string) {
  const job = await broadcastQueue.getJob(broadcastId);
  if (job) await job.remove();
}
