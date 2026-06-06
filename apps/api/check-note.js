const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.note.findFirst({ orderBy: { createdAt: 'desc' } }).then(n => {
  console.log(n);
  return p.$disconnect();
});
