import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { AppError } from '../middleware/errorHandler';
import { pool } from '../db/pool';
import { generateTempPassword } from '../utils/generatePassword';
import {
  createEmployee, listEmployees, getEmployeeById, updateEmployee,
  assignManager, removeManager, addTrainLine, removeTrainLine,
  writeAuditLog, getAuditLog, deactivateEmployee, reactivateEmployee,
  deleteEmployee, resetEmployeePassword, getEmployeeSnapshot,
} from '../db/queries/employees';

export const employeesRouter = Router();
employeesRouter.use(authMiddleware);
employeesRouter.use(requireRole('admin'));

// POST / — create employee, auto-generate temp password
employeesRouter.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { employee_number, name_ja, name_en, email, role } = req.body;
    if (!employee_number || !name_ja || !name_en || !email || !role) {
      throw new AppError(400, 'Missing required fields');
    }
    if (role !== 'admin' && role !== 'applicant') {
      throw new AppError(400, 'Invalid role');
    }
    const tempPassword = generateTempPassword();
    const id = await createEmployee({ employee_number, name_ja, name_en, email, password: tempPassword, role });
    await writeAuditLog({ employee_id: id, changed_by: req.user!.id, action: 'created' });
    res.status(201).json({ id, tempPassword });
  } catch (err: any) {
    if (err.code === '23505') return next(new AppError(409, 'employee_number or email already exists'));
    next(err);
  }
});

// GET / — list all employees (includes is_active)
employeesRouter.get('/', async (_req: AuthRequest, res: Response, next) => {
  try {
    res.json(await listEmployees());
  } catch (err) { next(err); }
});

// GET /:id — get employee detail (includes is_active)
employeesRouter.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const employee = await getEmployeeById(req.params.id);
    if (!employee) throw new AppError(404, 'Employee not found');
    res.json(employee);
  } catch (err) { next(err); }
});

// PATCH /:id — update fields, write audit log with diff
employeesRouter.patch('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { employee_number, name_ja, name_en, email, role, work_start, work_end, dispatch_company } = req.body;
    if (role !== undefined && role !== 'admin' && role !== 'applicant') {
      throw new AppError(400, 'Invalid role');
    }

    const before = await getEmployeeById(req.params.id);
    if (!before) throw new AppError(404, 'Employee not found');

    const patch = { employee_number, name_ja, name_en, email, role, work_start, work_end, dispatch_company };
    const updated = await updateEmployee(req.params.id, patch);
    if (!updated) throw new AppError(404, 'Employee not found');

    const fieldMap: Record<string, string | undefined> = {
      employee_number, name_ja, name_en, email, role, work_start, work_end, dispatch_company,
    };
    const changes: Record<string, { from: string; to: string }> = {};
    for (const [key, newVal] of Object.entries(fieldMap)) {
      if (newVal !== undefined) {
        const oldVal = String(before[key] ?? '');
        const nv = String(newVal ?? '');
        if (oldVal !== nv) changes[key] = { from: oldVal, to: nv };
      }
    }
    if (Object.keys(changes).length > 0) {
      await writeAuditLog({ employee_id: req.params.id, changed_by: req.user!.id, action: 'updated', changes });
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /:id/reset-password
employeesRouter.post('/:id/reset-password', async (req: AuthRequest, res: Response, next) => {
  try {
    const employee = await getEmployeeById(req.params.id);
    if (!employee) throw new AppError(404, 'Employee not found');

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);
    await resetEmployeePassword(req.params.id, hash);
    await writeAuditLog({ employee_id: req.params.id, changed_by: req.user!.id, action: 'password_reset' });

    res.json({ tempPassword });
  } catch (err) { next(err); }
});

// PATCH /:id/deactivate
employeesRouter.patch('/:id/deactivate', async (req: AuthRequest, res: Response, next) => {
  try {
    if (req.params.id === req.user!.id) throw new AppError(400, 'Cannot deactivate yourself');
    const result = await deactivateEmployee(req.params.id);
    if (result === 'not_found') throw new AppError(404, 'Employee not found');
    if (result === 'already_inactive') throw new AppError(409, 'Account is already deactivated');
    await writeAuditLog({ employee_id: req.params.id, changed_by: req.user!.id, action: 'deactivated' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /:id/reactivate
employeesRouter.patch('/:id/reactivate', async (req: AuthRequest, res: Response, next) => {
  try {
    const result = await reactivateEmployee(req.params.id);
    if (result === 'not_found') throw new AppError(404, 'Employee not found');
    if (result === 'already_active') throw new AppError(409, 'Account is already active');
    await writeAuditLog({ employee_id: req.params.id, changed_by: req.user!.id, action: 'reactivated' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /:id — hard delete (write audit log first, then delete)
employeesRouter.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    if (req.params.id === req.user!.id) throw new AppError(400, 'Cannot delete yourself');
    const snapshot = await getEmployeeSnapshot(req.params.id);
    if (!snapshot) throw new AppError(404, 'Employee not found');
    await writeAuditLog({ employee_id: req.params.id, changed_by: req.user!.id, action: 'deleted', snapshot });
    await deleteEmployee(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /:id/audit-log
employeesRouter.get('/:id/audit-log', async (req: AuthRequest, res: Response, next) => {
  try {
    const employee = await getEmployeeById(req.params.id);
    if (!employee) throw new AppError(404, 'Employee not found');
    res.json(await getAuditLog(req.params.id));
  } catch (err) { next(err); }
});

// POST /:id/managers — assign manager, write audit log
employeesRouter.post('/:id/managers', async (req: AuthRequest, res: Response, next) => {
  try {
    const { managerId } = req.body;
    if (!managerId) throw new AppError(400, 'managerId is required');
    if (managerId === req.params.id) throw new AppError(400, 'Employee cannot be assigned as their own manager');
    const { rows } = await pool.query(`SELECT id FROM users WHERE id = $1`, [managerId]);
    if (!rows[0]) throw new AppError(404, 'Manager not found');
    await assignManager(req.params.id, managerId);
    await writeAuditLog({ employee_id: req.params.id, changed_by: req.user!.id, action: 'manager_assigned' });
    res.status(201).json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /:id/managers/:managerId — remove manager, write audit log
employeesRouter.delete('/:id/managers/:managerId', async (req: AuthRequest, res: Response, next) => {
  try {
    const count = await removeManager(req.params.id, req.params.managerId);
    if (count === 0) throw new AppError(404, 'Manager assignment not found');
    await writeAuditLog({ employee_id: req.params.id, changed_by: req.user!.id, action: 'manager_removed' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Train line routes (no audit logging per spec)
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
