import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { AppError } from '../middleware/errorHandler';
import { pool } from '../db/pool';
import {
  createEmployee, listEmployees, getEmployeeById, updateEmployee,
  assignManager, removeManager, addTrainLine, removeTrainLine,
} from '../db/queries/employees';

export const employeesRouter = Router();
employeesRouter.use(authMiddleware);
employeesRouter.use(requireRole('admin'));

function validatePassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

employeesRouter.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { employee_number, name_ja, name_en, email, password, role } = req.body;
    if (!employee_number || !name_ja || !name_en || !email || !password || !role) {
      throw new AppError(400, 'Missing required fields');
    }
    if (!validatePassword(password)) {
      throw new AppError(400, 'Password must be at least 8 characters with one uppercase letter, one digit, and one special character');
    }
    const id = await createEmployee({ employee_number, name_ja, name_en, email, password, role });
    res.status(201).json({ id });
  } catch (err: any) {
    if (err.code === '23505') return next(new AppError(409, 'employee_number or email already exists'));
    next(err);
  }
});

employeesRouter.get('/', async (_req: AuthRequest, res: Response, next) => {
  try {
    res.json(await listEmployees());
  } catch (err) { next(err); }
});

employeesRouter.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const employee = await getEmployeeById(req.params.id);
    if (!employee) throw new AppError(404, 'Employee not found');
    res.json(employee);
  } catch (err) { next(err); }
});

employeesRouter.patch('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { name_ja, name_en, email, role, work_start, work_end } = req.body;
    await updateEmployee(req.params.id, { name_ja, name_en, email, role, work_start, work_end });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

employeesRouter.post('/:id/managers', async (req: AuthRequest, res: Response, next) => {
  try {
    const { managerId } = req.body;
    if (!managerId) throw new AppError(400, 'managerId is required');
    const { rows } = await pool.query(`SELECT id FROM users WHERE id = $1`, [managerId]);
    if (!rows[0]) throw new AppError(404, 'Manager not found');
    await assignManager(req.params.id, managerId);
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

employeesRouter.delete('/:id/managers/:managerId', async (req: AuthRequest, res: Response, next) => {
  try {
    const count = await removeManager(req.params.id, req.params.managerId);
    if (count === 0) throw new AppError(404, 'Manager assignment not found');
    res.json({ ok: true });
  } catch (err) { next(err); }
});

employeesRouter.post('/:id/train-lines', async (req: AuthRequest, res: Response, next) => {
  try {
    const { line_name_ja, line_name_en } = req.body;
    if (!line_name_ja || !line_name_en) throw new AppError(400, 'line_name_ja and line_name_en are required');
    const id = await addTrainLine(req.params.id, { line_name_ja, line_name_en });
    res.status(201).json({ id });
  } catch (err) { next(err); }
});

employeesRouter.delete('/:id/train-lines/:lineId', async (req: AuthRequest, res: Response, next) => {
  try {
    const count = await removeTrainLine(req.params.lineId);
    if (count === 0) throw new AppError(404, 'Train line not found');
    res.json({ ok: true });
  } catch (err) { next(err); }
});
