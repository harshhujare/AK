const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.planConfig.findMany().then(r => {
  console.log(JSON.stringify(r, null, 2));
  return p.$disconnect();
});
