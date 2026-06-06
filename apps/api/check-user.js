const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findFirst({ orderBy: { createdAt: 'desc' } }).then(u => {
  console.log(u);
  return p.$disconnect();
});
