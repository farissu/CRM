import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

function generateTempPassword(): string {
  return crypto.randomBytes(12).toString('base64url');
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Create default company first
  const company = await prisma.company.upsert({
    where: { id: 'default-company-id' },
    update: {},
    create: {
      id: 'default-company-id',
      name: 'Waku Digital',
      brand: 'Waku',
      address: 'Jakarta, Indonesia',
      businessEntities: 'PT',
      businessType: 'Technology',
      email: 'contact@waku.digital',
      phone: '+62 21 1234 5678',
      isActive: true,
    },
  });

  console.log('✅ Created Company:', company.name);

  // Create a default super admin with a random temporary password
  // (only generated/printed when the account doesn't already exist —
  // re-running the seed must not overwrite a password an admin already changed)
  let superAdminTempPassword: string | null = null;
  let agent = await prisma.agent.findUnique({ where: { email: 'admin@waku.com' } });
  if (!agent) {
    superAdminTempPassword = generateTempPassword();
    agent = await prisma.agent.create({
      data: {
        email: 'admin@waku.com',
        password: await bcrypt.hash(superAdminTempPassword, 10),
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        companyId: company.id,
        isActive: true,
        mustChangePassword: true,
      },
    });
  }

  console.log('✅ Super Admin:', agent.email);

  // Create sample agent user with a random temporary password
  let agentTempPassword: string | null = null;
  let agentUser = await prisma.agent.findUnique({ where: { email: 'agent@waku.com' } });
  if (!agentUser) {
    agentTempPassword = generateTempPassword();
    agentUser = await prisma.agent.create({
      data: {
        email: 'agent@waku.com',
        password: await bcrypt.hash(agentTempPassword, 10),
        name: 'Agent User',
        role: 'AGENT',
        companyId: company.id,
        isActive: true,
        mustChangePassword: true,
      },
    });
  }

  console.log('✅ Created Agent:', agentUser.email);

  console.log('\nDatabase seeded successfully!');

  if (superAdminTempPassword || agentTempPassword) {
    console.log('\n⚠️  Temporary passwords (shown once — save them now, both accounts must change on first login):');
    if (superAdminTempPassword) console.log(`   Super Admin (${agent.email}): ${superAdminTempPassword}`);
    if (agentTempPassword) console.log(`   Agent (${agentUser.email}): ${agentTempPassword}`);
  } else {
    console.log('\nAccounts already existed — no new passwords generated.');
  }

  console.log('\nCreated:');
  console.log('- 1 company');
  console.log('- 2 agent accounts (super admin + agent)');
  console.log('- No contacts or conversations (clean start)');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
