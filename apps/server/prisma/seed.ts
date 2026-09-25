import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('password', 10);
  const user = await prisma.user.create({
    data: {
      email: 'demo@example.com',
      password: hash,
      name: 'Demo User',
    },
  });

  const deck = await prisma.deck.create({
    data: {
      name: 'Spanish Basics',
      description: 'Basic Spanish vocabulary',
      userId: user.id,
      cards: {
        create: [
          { front: 'Hello', back: 'Hola', userId: user.id },
          { front: 'Goodbye', back: 'Adiós', userId: user.id },
          { front: 'Thank you', back: 'Gracias', userId: user.id },
        ],
      },
    },
  });

  console.log(`Created demo user ${user.email} with deck ${deck.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
