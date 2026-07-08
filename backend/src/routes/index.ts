import { Router } from 'express';
import authRoutes from './auth.routes';
import transactionRoutes from './transaction.routes';
import investmentRoutes from './investment.routes';
import goalRoutes from './goal.routes';
import loanRoutes from './loan.routes';
import billRoutes from './bill.routes';
import dashboardRoutes from './dashboard.routes';
import accountRoutes from './account.routes';
import categoryRoutes from './category.routes';
import creditCardRoutes from './credit-card.routes';
import p2pRoutes from './p2p.routes';
import cardEMIRoutes from './card-emi.routes';
import familyRoutes from './family.routes';
import budgetRoutes from './budget.routes';
import debtRoutes from './debt.routes';
import assetLoanRoutes from './assetLoan.routes';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/transactions', transactionRoutes);
router.use('/investments', investmentRoutes);
router.use('/goals', goalRoutes);
router.use('/loans', loanRoutes);
router.use('/bills', billRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/accounts', accountRoutes);
router.use('/categories', categoryRoutes);
router.use('/credit-cards', creditCardRoutes);
router.use('/p2p', p2pRoutes);
router.use('/card-emis', cardEMIRoutes);
router.use('/family', familyRoutes);
router.use('/budgets', budgetRoutes);
router.use('/debt', debtRoutes);
router.use('/asset-loans', assetLoanRoutes);

export default router;
