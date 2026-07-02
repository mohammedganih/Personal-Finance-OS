import { prisma } from '../lib/prisma';

// Hard safety guard: resetDatabase() wipes every row. If DATABASE_URL ever
// isn't pointed at a database with "test" in its name -- e.g. .env.test
// failed to load and we silently fell back to the real DATABASE_URL --
// refuse to run rather than risk wiping real financial data.
const dbUrl = process.env.DATABASE_URL ?? '';
if (!/\/[^/?]*test[^/?]*(\?|$)/i.test(dbUrl)) {
  throw new Error(
    `Refusing to run tests: DATABASE_URL does not look like a test database.\n` +
    `  DATABASE_URL="${dbUrl}"\n` +
    `  Expected the database name to contain "test" (see backend/.env.test).`
  );
}

/** Wipes all data. Deleting every User cascades to every other table. */
export async function resetDatabase() {
  await prisma.user.deleteMany({});
}

export { prisma };
