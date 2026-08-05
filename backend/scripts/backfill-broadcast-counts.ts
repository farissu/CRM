import { PrismaClient, BroadcastRecipientStatus } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const broadcasts = await prisma.broadcast.findMany({ include: { recipients: true } });
  let fixed = 0;

  for (const b of broadcasts) {
    const sentCount = b.recipients.filter(r => r.status !== BroadcastRecipientStatus.PENDING && r.status !== BroadcastRecipientStatus.FAILED).length;
    const deliveredCount = b.recipients.filter(r => r.status === BroadcastRecipientStatus.DELIVERED || r.status === BroadcastRecipientStatus.READ).length;
    const readCount = b.recipients.filter(r => r.status === BroadcastRecipientStatus.READ).length;
    const failedCount = b.recipients.filter(r => r.status === BroadcastRecipientStatus.FAILED).length;

    if (
      sentCount !== b.sentCount ||
      deliveredCount !== b.deliveredCount ||
      readCount !== b.readCount ||
      failedCount !== b.failedCount
    ) {
      await prisma.broadcast.update({
        where: { id: b.id },
        data: { sentCount, deliveredCount, readCount, failedCount },
      });
      fixed++;
      console.log(`Fixed "${b.name}" (${b.id}): sent ${b.sentCount}->${sentCount}, delivered ${b.deliveredCount}->${deliveredCount}, read ${b.readCount}->${readCount}, failed ${b.failedCount}->${failedCount}`);
    }
  }

  console.log(`Done. ${fixed}/${broadcasts.length} broadcasts had stale counts corrected.`);
}

main().finally(() => prisma.$disconnect());
