const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany().then(u => {
  console.log(u.map(x => ({ email: x.email, role: x.role, plan: x.plan })));
  return p.$disconnect();
});
