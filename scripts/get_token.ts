import { config } from 'dotenv';
config({ path: 'apps/api/.env' });
import { signAccessToken } from '../apps/api/src/services/token';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("No user found in the DB. Create one first.");
    return;
  }
  
  const token = signAccessToken({
    userId: user.id,
    role: user.role,
    plan: user.plan
  });
  
  console.log("AccessToken:", token);
}

main().finally(() => prisma.$disconnect());
