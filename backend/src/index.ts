import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import routes from './routes';
import { errorHandler, notFound } from './middleware/error.middleware';

const PLACEHOLDER_JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === PLACEHOLDER_JWT_SECRET) {
  console.error(
    '\n[FATAL] JWT_SECRET is missing or still set to the placeholder value.\n' +
    '        Generate a real secret and set it in backend/.env before starting the server.\n' +
    "        e.g. node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"\n"
  );
  process.exit(1);
}

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/v1/health\n`);
});

export default app;
