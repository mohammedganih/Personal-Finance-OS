/**
 * Restores: family members + default categories for existing user.
 * Run: node restore.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ log: ['error'] });

const DEFAULT_CATEGORIES = [
  { name: 'Salary',              icon: '💰', color: '#10B981', type: 'INCOME' },
  { name: 'Freelance',           icon: '💻', color: '#3B82F6', type: 'INCOME' },
  { name: 'Business',            icon: '🏢', color: '#8B5CF6', type: 'INCOME' },
  { name: 'Investments',         icon: '📈', color: '#F59E0B', type: 'INCOME' },
  { name: 'Other Income',        icon: '💵', color: '#6B7280', type: 'INCOME' },
  { name: 'Food & Dining',       icon: '🍽️', color: '#EF4444', type: 'EXPENSE' },
  { name: 'Groceries',           icon: '🛒', color: '#22C55E', type: 'EXPENSE' },
  { name: 'Transportation',      icon: '🚗', color: '#F97316', type: 'EXPENSE' },
  { name: 'Shopping',            icon: '🛍️', color: '#EC4899', type: 'EXPENSE' },
  { name: 'Entertainment',       icon: '🎮', color: '#8B5CF6', type: 'EXPENSE' },
  { name: 'Healthcare',          icon: '🏥', color: '#14B8A6', type: 'EXPENSE' },
  { name: 'Electricity',         icon: '⚡', color: '#EAB308', type: 'EXPENSE' },
  { name: 'Internet',            icon: '🌐', color: '#06B6D4', type: 'EXPENSE' },
  { name: 'Utilities',           icon: '🔧', color: '#F59E0B', type: 'EXPENSE' },
  { name: 'Rent',                icon: '🏠', color: '#3B82F6', type: 'EXPENSE' },
  { name: 'Education',           icon: '📚', color: '#06B6D4', type: 'EXPENSE' },
  { name: 'Travel',              icon: '✈️', color: '#10B981', type: 'EXPENSE' },
  { name: 'Personal Care',       icon: '💆', color: '#A855F7', type: 'EXPENSE' },
  { name: 'Subscriptions',       icon: '📱', color: '#6366F1', type: 'EXPENSE' },
  { name: 'Investment',          icon: '📈', color: '#F59E0B', type: 'EXPENSE' },
  { name: 'Loan EMI',            icon: '🏦', color: '#F97316', type: 'EXPENSE' },
  { name: 'Credit Card Bill',    icon: '💳', color: '#EF4444', type: 'EXPENSE' },
  { name: 'Card EMI',            icon: '📦', color: '#8B5CF6', type: 'EXPENSE' },
  { name: 'Other',               icon: '📦', color: '#6B7280', type: 'EXPENSE' },
];

async function main() {
  const user = await p.user.findFirst({ select: { id: true, name: true, email: true } });

  if (!user) {
    console.log('\n⚠️  No user found. Please register first at http://localhost:3000/register');
    console.log('   After registering, run this script again to seed family members.\n');
    return;
  }

  console.log(`\nUser found: ${user.name} (${user.email})`);

  // Seed categories
  const existingCats = await p.category.count({ where: { userId: user.id } });
  if (existingCats === 0) {
    await p.category.createMany({
      data: DEFAULT_CATEGORIES.map(c => ({ ...c, userId: user.id, isDefault: true })),
      skipDuplicates: true,
    });
    console.log(`✓ Seeded ${DEFAULT_CATEGORIES.length} categories`);
  } else {
    console.log(`  Categories already exist (${existingCats})`);
  }

  // Seed family members
  const existingFM = await p.familyMember.count({ where: { userId: user.id } });
  if (existingFM === 0) {
    await p.familyMember.createMany({
      data: [
        { userId: user.id, name: 'Mohammed Gani', relation: 'Self',   color: '#7C3AED', emoji: '👨', isDefault: true },
        { userId: user.id, name: 'Fathimah',      relation: 'Spouse', color: '#EC4899', emoji: '👩', isDefault: false },
      ],
    });
    console.log('✓ Seeded family members: Mohammed Gani + Fathimah');
  } else {
    console.log(`  Family members already exist (${existingFM})`);
  }

  const members = await p.familyMember.findMany({ where: { userId: user.id } });
  members.forEach(m => console.log(`  ${m.emoji} ${m.name} (${m.id})`));
  console.log('\n✓ Done! Re-enter your accounts, loans, and investments in the app.\n');
}

main().catch(console.error).finally(() => p.$disconnect());
