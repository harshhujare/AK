const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.planConfig.upsert({
  where: { planDuration: 30 },
  update: {},
  create: {
    planDuration: 30,
    price: 49900,
    label: 'Premium Access',
    description: 'Unlock all premium handwritten notes by Ajit Sir. Get instant access to chapter-wise PDFs, bilingual explanations, and exclusive TET study material.',
    isActive: true,
  },
}).then(function(r) {
  console.log('Seeded PlanConfig:', JSON.stringify(r, null, 2));
  return p.$disconnect();
}).catch(function(e) {
  console.error('Error:', e);
  return p.$disconnect();
});
