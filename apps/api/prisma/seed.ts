import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Subjects
  const childDev = await prisma.subject.upsert({
    where: { name: 'Child Development & Pedagogy' },
    update: {},
    create: { name: 'Child Development & Pedagogy' },
  });

  const language1 = await prisma.subject.upsert({
    where: { name: 'Language I (Marathi)' },
    update: {},
    create: { name: 'Language I (Marathi)' },
  });

  const mathematics = await prisma.subject.upsert({
    where: { name: 'Mathematics' },
    update: {},
    create: { name: 'Mathematics' },
  });

  console.log('✅ Subjects created');

  // Admin user
  const adminHash = await bcrypt.hash('Admin@1234', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ajitsir.com' },
    update: {},
    create: {
      name: 'Ajit Kambale',
      email: 'admin@ajitsir.com',
      passwordHash: adminHash,
      role: 'ADMIN',
      plan: 'PAID',
    },
  });

  // Demo student
  const studentHash = await bcrypt.hash('Student@1234', 12);
  await prisma.user.upsert({
    where: { email: 'student@ajitsir.com' },
    update: {},
    create: {
      name: 'Demo Student',
      email: 'student@ajitsir.com',
      passwordHash: studentHash,
      role: 'STUDENT',
      plan: 'FREE',
    },
  });

  console.log('✅ Users created');

  // Sample free test
  const test = await prisma.test.create({
    data: {
      title: 'Child Development — Paper I (Sample)',
      description: 'Sample MCQ test for TET Paper I',
      subjectId: childDev.id,
      isPaid: false,
      questions: {
        create: [
          {
            text: "According to Piaget's theory, at which stage does a child develop the concept of object permanence?",
            options: [
              { id: 'A', text: 'Pre-operational stage' },
              { id: 'B', text: 'Sensorimotor stage' },
              { id: 'C', text: 'Concrete operational stage' },
              { id: 'D', text: 'Formal operational stage' },
            ],
            correctOption: 'B',
            explanation: 'Object permanence develops during the Sensorimotor stage (0-2 years) according to Piaget.',
            order: 1,
          },
          {
            text: 'Which of the following is NOT a characteristic of the pre-operational stage?',
            options: [
              { id: 'A', text: 'Egocentrism' },
              { id: 'B', text: 'Animism' },
              { id: 'C', text: 'Conservation' },
              { id: 'D', text: 'Symbolic thinking' },
            ],
            correctOption: 'C',
            explanation: 'Conservation develops during the Concrete Operational stage, not the Pre-operational stage.',
            order: 2,
          },
          {
            text: "Vygotsky's Zone of Proximal Development (ZPD) refers to:",
            options: [
              { id: 'A', text: 'Tasks a child can do alone' },
              { id: 'B', text: 'Tasks a child cannot do even with help' },
              { id: 'C', text: "Tasks a child can do with a more knowledgeable other's help" },
              { id: 'D', text: 'Tasks that are too easy for the child' },
            ],
            correctOption: 'C',
            explanation: "ZPD is the gap between what a learner can do independently and what they can achieve with guidance.",
            order: 3,
          },
        ],
      },
    },
  });

  console.log('✅ Sample test created:', test.title);
  console.log('\n🎉 Seed complete!');
  console.log('   Admin: admin@ajitsir.com / Admin@1234');
  console.log('   Student: student@ajitsir.com / Student@1234');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
