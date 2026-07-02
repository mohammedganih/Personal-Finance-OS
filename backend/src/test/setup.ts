import dotenv from 'dotenv';
import path from 'path';

// Must run before any test file imports lib/prisma, since PrismaClient reads
// DATABASE_URL at module-load time. `override: true` guarantees this wins
// even if a DATABASE_URL happens to already be set in the shell -- tests
// must never accidentally point at a real database.
dotenv.config({ path: path.resolve(__dirname, '../../.env.test'), override: true });
