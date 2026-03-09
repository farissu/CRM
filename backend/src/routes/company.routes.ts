import { Router } from 'express';
import * as companyController from '../controllers/company.controller';
import { authenticate, requireSuperAdmin } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Company viewing - all authenticated users can view
router.get('/', companyController.getAllCompanies);
router.get('/:companyId', companyController.getCompanyById);

// Company management - Super Admin only
router.post('/', requireSuperAdmin, companyController.createCompany);
router.put('/:companyId', requireSuperAdmin, companyController.updateCompany);
router.delete('/:companyId', requireSuperAdmin, companyController.deleteCompany);

export default router;
