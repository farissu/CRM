import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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

  // Create a default super admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const agent = await prisma.agent.upsert({
    where: { email: 'admin@waku.com' },
    update: {},
    create: {
      email: 'admin@waku.com',
      password: hashedPassword,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      companyId: company.id,
      isActive: true,
    },
  });

  console.log('✅ Created Super Admin:', agent.email);
  console.log('   Password: admin123');
  
  // Create sample agent user
  const agentPassword = await bcrypt.hash('agent123', 10);
  
  const agentUser = await prisma.agent.upsert({
    where: { email: 'agent@waku.com' },
    update: {},
    create: {
      email: 'agent@waku.com',
      password: agentPassword,
      name: 'Agent User',
      role: 'AGENT',
      companyId: company.id,
      isActive: true,
    },
  });

  console.log('✅ Created Agent:', agentUser.email);
  console.log('   Password: agent123');

  // Create sample contacts and conversations
  const contact1 = await prisma.contact.upsert({
    where: { phoneNumber: '6281234567890' },
    update: {},
    create: {
      phoneNumber: '6281234567890',
      name: 'John Doe',
      email: 'john@example.com',
    },
  });

  const conversation1 = await prisma.conversation.upsert({
    where: { id: contact1.id },
    update: {},
    create: {
      contactId: contact1.id,
      assignedAgentId: agent.id,
      status: 'open',
      unreadCount: 2,
      lastMessageText: 'Hello, I need help with my order',
      lastMessageAt: new Date(),
    },
  });

  // Create sample messages
  await prisma.message.create({
    data: {
      conversationId: conversation1.id,
      direction: 'inbound',
      text: 'Hello, I need help with my order',
      messageType: 'text',
      status: 'received',
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation1.id,
      direction: 'outbound',
      text: 'Hi! I\'d be happy to help. What\'s your order number?',
      messageType: 'text',
      status: 'delivered',
      senderId: agent.id,
      timestamp: new Date(Date.now() - 3000000), // 50 minutes ago
    },
  });

  // Create more sample contacts and conversations
  const contact2 = await prisma.contact.upsert({
    where: { phoneNumber: '6281234567891' },
    update: {},
    create: {
      phoneNumber: '6281234567891',
      name: 'Jane Smith',
      email: 'jane@example.com',
    },
  });

  const conversation2 = await prisma.conversation.upsert({
    where: { id: contact2.id },
    update: {},
    create: {
      contactId: contact2.id,
      assignedAgentId: agent.id,
      status: 'resolved',
      unreadCount: 0,
      lastMessageText: 'Thanks for your help!',
      lastMessageAt: new Date(Date.now() - 86400000), // 1 day ago
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation2.id,
      direction: 'inbound',
      text: 'Can I change my delivery address?',
      messageType: 'text',
      status: 'received',
      timestamp: new Date(Date.now() - 90000000), // ~25 hours ago
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation2.id,
      direction: 'outbound',
      text: 'Yes, I can help you with that. What\'s your new address?',
      messageType: 'text',
      status: 'delivered',
      senderId: agent.id,
      timestamp: new Date(Date.now() - 89000000),
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation2.id,
      direction: 'inbound',
      text: '123 Main Street, Jakarta',
      messageType: 'text',
      status: 'received',
      timestamp: new Date(Date.now() - 88000000),
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation2.id,
      direction: 'outbound',
      text: 'Done! Your address has been updated.',
      messageType: 'text',
      status: 'delivered',
      senderId: agent.id,
      timestamp: new Date(Date.now() - 87000000),
    },
  });

  await prisma.message.create({
    data: {
      conversationId: conversation2.id,
      direction: 'inbound',
      text: 'Thanks for your help!',
      messageType: 'text',
      status: 'received',
      timestamp: new Date(Date.now() - 86400000),
    },
  });

  const contact3 = await prisma.contact.upsert({
    where: { phoneNumber: '6281234567892' },
    update: {},
    create: {
      phoneNumber: '6281234567892',
      name: 'Bob Johnson',
    },
  });

  await prisma.conversation.upsert({
    where: { id: contact3.id },
    update: {},
    create: {
      contactId: contact3.id,
      status: 'resolved',
      unreadCount: 0,
      lastMessageText: 'Perfect, thank you!',
      lastMessageAt: new Date(Date.now() - 172800000), // 2 days ago
    },
  });

  console.log('Database seeded successfully!');
  console.log('\nDefault credentials:');
  console.log('Email: admin@example.com');
  console.log('Password: admin123');
  console.log('\nCreated:');
  console.log('- 3 contacts');
  console.log('- 3 conversations (1 open, 2 resolved)');
  console.log('- Multiple messages');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
