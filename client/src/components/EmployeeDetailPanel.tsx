import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { EmployeeDetail, EmployeeListItem, AuditLogEntry } from '@attendance/shared';
import { apiFetch } from '../api/client';
import { PasswordRevealModal } from './PasswordRevealModal';

interface Props {
  mode: 'view' | 'create';
  employeeId?: string;
  allUsers: EmployeeListItem[];
  onClose: () => void;
  onCreated: (employee: EmployeeListItem) => void;
  onUpdated: (employee: EmployeeListItem) => void;
  onDeleted: (id: string) => void;
}

type Tab = 'details' | 'audit_log';

interface FormState {
  employee_number: string;
  name_ja: string;
  name_en: string;
  email: string;
  role: string;
  work_start: string;
  work_end: string;
  dispatch_company: string;
}

function emptyForm(): FormState {
  return { employee_number: '', name_ja: '', name_en: '', email: '', role: 'applicant', work_start: '', work_end: '', dispatch_company: '' };
}

function employeeToForm(e: EmployeeDetail): FormState {
  return {
    employee_number: e.employee_number,
    name_ja: e.name_ja,
    name_en: e.name_en,
    email: e.email,
    role: e.role,
    work_start: e.work_start ?? '',
    work_end: e.work_end ?? '',
    dispatch_company: e.dispatch_company ?? '',
  };
}

export function EmployeeDetailPanel({ mode, employeeId, allUsers, onClose, onCreated, onUpdated, onDeleted }: Props) {
  const { t } = useTranslation();
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [savedForm, setSavedForm] = useState<FormState>(emptyForm());
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [pendingCreated, setPendingCreated] = useState<EmployeeListItem | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [addManagerId, setAddManagerId] = useState('');

  const isDirty = mode === 'view' && JSON.stringify(form) !== JSON.stringify(savedForm);

  useEffect(() => {
    if (mode === 'view' && employeeId) {
      apiFetch(`/api/admin/employees/${employeeId}`)
        .then(r => r.json())
        .then((data: EmployeeDetail) => {
          setEmployee(data);
          const f = employeeToForm(data);
          setForm(f);
          setSavedForm(f);
        });
    }
  }, [mode, employeeId]);

  async function loadAuditLog() {
    if (!employeeId || auditLoaded) return;
    const res = await apiFetch(`/api/admin/employees/${employeeId}/audit-log`);
    const data = await res.json();
    setAuditLog(data);
    setAuditLoaded(true);
  }

  async function handleSave() {
    if (!employeeId || !isDirty) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/employees/${employeeId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          employee_number: form.employee_number,
          name_ja: form.name_ja,
          name_en: form.name_en,
          email: form.email,
          role: form.role,
          work_start: form.work_start || null,
          work_end: form.work_end || null,
          dispatch_company: form.dispatch_company || null,
        }),
      });
      if (!res.ok) return;
      setSavedForm({ ...form });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
      if (employee) {
        const updated: EmployeeListItem = {
          id: employee.id,
          employee_number: form.employee_number,
          name_ja: form.name_ja,
          name_en: form.name_en,
          email: form.email,
          role: form.role as EmployeeListItem['role'],
          is_active: employee.is_active,
        };
        setEmployee({ ...employee, ...updated });
        onUpdated(updated);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/employees', {
        method: 'POST',
        body: JSON.stringify({
          employee_number: form.employee_number,
          name_ja: form.name_ja,
          name_en: form.name_en,
          email: form.email,
          role: form.role,
        }),
      });
      if (!res.ok) return;
      const { id, tempPassword: tp } = await res.json();
      const newEmployee: EmployeeListItem = {
        id,
        employee_number: form.employee_number,
        name_ja: form.name_ja,
        name_en: form.name_en,
        email: form.email,
        role: form.role as EmployeeListItem['role'],
        is_active: true,
      };
      setPendingCreated(newEmployee);
      setTempPassword(tp);
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!employeeId) return;
    const res = await apiFetch(`/api/admin/employees/${employeeId}/reset-password`, { method: 'POST' });
    if (!res.ok) return;
    const { tempPassword: tp } = await res.json();
    setTempPassword(tp);
  }

  async function handleDeactivate() {
    if (!employeeId || !employee) return;
    const res = await apiFetch(`/api/admin/employees/${employeeId}/deactivate`, { method: 'PATCH' });
    if (res.ok) {
      setEmployee({ ...employee, is_active: false });
      onUpdated({ ...employee, is_active: false, role: employee.role });
      setConfirmDeactivate(false);
    }
  }

  async function handleReactivate() {
    if (!employeeId || !employee) return;
    const res = await apiFetch(`/api/admin/employees/${employeeId}/reactivate`, { method: 'PATCH' });
    if (res.ok) {
      setEmployee({ ...employee, is_active: true });
      onUpdated({ ...employee, is_active: true, role: employee.role });
    }
  }

  async function handleDelete() {
    if (!employeeId || deleteInput !== 'delete') return;
    const res = await apiFetch(`/api/admin/employees/${employeeId}`, { method: 'DELETE' });
    if (res.ok) {
      onDeleted(employeeId);
      onClose();
    }
  }

  async function handleAddManager() {
    if (!employeeId || !addManagerId || !employee) return;
    const res = await apiFetch(`/api/admin/employees/${employeeId}/managers`, {
      method: 'POST',
      body: JSON.stringify({ managerId: addManagerId }),
    });
    if (res.ok) {
      const newManager = allUsers.find(u => u.id === addManagerId);
      if (newManager) {
        const updatedManagers = [...employee.managers, { id: newManager.id, name_ja: newManager.name_ja, name_en: newManager.name_en, email: newManager.email }];
        setEmployee({ ...employee, managers: updatedManagers });
      }
      setAddManagerId('');
    }
  }

  async function handleRemoveManager(managerId: string) {
    if (!employeeId || !employee) return;
    const res = await apiFetch(`/api/admin/employees/${employeeId}/managers/${managerId}`, { method: 'DELETE' });
    if (res.ok) {
      setEmployee({ ...employee, managers: employee.managers.filter(m => m.id !== managerId) });
    }
  }

  const availableManagers = allUsers.filter(u =>
    u.role === 'admin' && u.id !== employeeId && !employee?.managers.some(m => m.id === u.id)
  );

  const isCreateValid = form.employee_number && form.name_ja && form.name_en && form.email && form.role;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, width: '420px', height: '100vh',
        background: 'white', boxShadow: '-6px 0 24px rgba(0,0,0,0.12)',
        zIndex: 101, overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: mode === 'create' ? '1px solid #f0f0f0' : 'none', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mode === 'create' ? '16px' : '0' }}>
            <h2 style={{ fontSize: '1.05em', fontWeight: 700, color: '#111' }}>
              {mode === 'create' ? t('employees.add') : (employee?.name_ja ?? '…')}
            </h2>
            <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', width: '28px', height: '28px', borderRadius: '50%', fontSize: '0.9em', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>✕</button>
          </div>

          {/* Tabs — view mode only */}
          {mode === 'view' && (
            <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #f0f0f0', marginTop: '4px' }}>
              {(['details', 'audit_log'] as Tab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); if (tab === 'audit_log') loadAuditLog(); }}
                  style={{
                    padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: '0.88em', fontWeight: 600,
                    background: 'none', color: activeTab === tab ? '#2563eb' : '#6b7280',
                    borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
                  }}
                >
                  {t(`employees.tabs.${tab}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {(mode === 'create' || activeTab === 'details') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <FieldInput label={t('employees.fields.employee_number')} value={form.employee_number} onChange={v => setForm(f => ({ ...f, employee_number: v }))} />
              <FieldInput label={t('employees.fields.name_ja')} value={form.name_ja} onChange={v => setForm(f => ({ ...f, name_ja: v }))} />
              <FieldInput label={t('employees.fields.name_en')} value={form.name_en} onChange={v => setForm(f => ({ ...f, name_en: v }))} />
              <FieldInput label={t('employees.fields.email')} value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
              <div>
                <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '5px' }}>
                  {t('employees.fields.role')}
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.9em', background: 'white' }}
                >
                  <option value="applicant">{t('profile.roles.applicant')}</option>
                  <option value="admin">{t('profile.roles.admin')}</option>
                </select>
              </div>
              {mode === 'view' && (
                <>
                  <FieldInput label={t('employees.fields.work_start')} value={form.work_start} onChange={v => setForm(f => ({ ...f, work_start: v }))} type="time" />
                  <FieldInput label={t('employees.fields.work_end')} value={form.work_end} onChange={v => setForm(f => ({ ...f, work_end: v }))} type="time" />
                  <FieldInput label={t('employees.fields.dispatch_company')} value={form.dispatch_company} onChange={v => setForm(f => ({ ...f, dispatch_company: v }))} />

                  {/* Managers section */}
                  <div>
                    <div style={{ fontSize: '0.75em', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                      {t('employees.fields.managers')}
                    </div>
                    {employee?.managers.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: '#f8fafc', borderRadius: '7px', marginBottom: '6px', fontSize: '0.88em' }}>
                        <span>{m.name_ja} <span style={{ color: '#9ca3af' }}>({m.name_en})</span></span>
                        <button
                          onClick={() => handleRemoveManager(m.id)}
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.85em', fontWeight: 600 }}
                        >
                          ✕ {t('employees.actions.remove')}
                        </button>
                      </div>
                    ))}
                    {availableManagers.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <select
                          value={addManagerId}
                          onChange={e => setAddManagerId(e.target.value)}
                          style={{ flex: 1, padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.88em', background: 'white' }}
                        >
                          <option value="">— {t('employees.actions.add_manager')} —</option>
                          {availableManagers.map(u => (
                            <option key={u.id} value={u.id}>{u.name_ja} ({u.name_en})</option>
                          ))}
                        </select>
                        <button
                          onClick={handleAddManager}
                          disabled={!addManagerId}
                          style={{ padding: '7px 14px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '8px', cursor: addManagerId ? 'pointer' : 'not-allowed', fontSize: '0.88em', fontWeight: 600 }}
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Audit Log tab */}
          {mode === 'view' && activeTab === 'audit_log' && (
            <div>
              {auditLog.length === 0 && <p style={{ color: '#9ca3af', fontSize: '0.9em' }}>No history yet.</p>}
              {auditLog.map(entry => (
                <div key={entry.id} style={{ borderLeft: '3px solid #e5e7eb', paddingLeft: '14px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '0.78em', color: '#9ca3af', marginBottom: '3px' }}>
                    {new Date(entry.changed_at).toLocaleString('sv-SE').slice(0, 16).replace('T', ' ')}
                    {entry.changed_by_name_ja && ` · ${entry.changed_by_name_ja}`}
                  </div>
                  <div style={{ fontSize: '0.9em', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
                    {t(`employees.audit.${entry.action}`)}
                  </div>
                  {entry.changes && Object.entries(entry.changes).map(([field, diff]) => (
                    <div key={field} style={{ fontSize: '0.82em', color: '#6b7280' }}>
                      <strong>{field}:</strong> {diff.from} → {diff.to}
                    </div>
                  ))}
                  {entry.snapshot && entry.action === 'deleted' && (
                    <div style={{ fontSize: '0.82em', color: '#6b7280' }}>
                      {Object.entries(entry.snapshot).map(([k, v]) => (
                        <div key={k}><strong>{k}:</strong> {v}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {mode === 'create' ? (
            <button
              onClick={handleCreate}
              disabled={!isCreateValid || saving}
              style={{ padding: '11px', background: isCreateValid ? '#3b82f6' : '#93c5fd', color: 'white', border: 'none', borderRadius: '8px', cursor: isCreateValid ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.95em' }}
            >
              {saving ? '…' : t('employees.add')}
            </button>
          ) : (
            <>
              {/* Save Changes */}
              <button
                onClick={handleSave}
                disabled={!isDirty || saving}
                style={{ padding: '11px', background: isDirty ? '#3b82f6' : '#e5e7eb', color: isDirty ? 'white' : '#9ca3af', border: 'none', borderRadius: '8px', cursor: isDirty ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.95em' }}
              >
                {saving ? '…' : savedOk ? t('employees.actions.saved') : t('employees.actions.save')}
              </button>

              {/* Reset Password */}
              <button
                onClick={handleResetPassword}
                style={{ padding: '10px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}
              >
                {t('employees.actions.reset_password')}
              </button>

              {/* Deactivate / Reactivate */}
              {employee && (employee.is_active ? (
                confirmDeactivate ? (
                  <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '12px' }}>
                    <p style={{ fontSize: '0.88em', color: '#92400e', marginBottom: '10px' }}>{t('employees.confirm_deactivate')}</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setConfirmDeactivate(false)} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #d1d5db', borderRadius: '7px', cursor: 'pointer', fontSize: '0.88em' }}>Cancel</button>
                      <button onClick={handleDeactivate} style={{ flex: 1, padding: '8px', background: '#d97706', color: 'white', border: 'none', borderRadius: '7px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88em' }}>{t('employees.actions.deactivate')}</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeactivate(true)} style={{ padding: '10px', background: 'white', color: '#d97706', border: '1px solid #fcd34d', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}>
                    {t('employees.actions.deactivate')}
                  </button>
                )
              ) : (
                <button onClick={handleReactivate} style={{ padding: '10px', background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}>
                  {t('employees.actions.reactivate')}
                </button>
              ))}

              {/* Delete Account */}
              {showDeleteConfirm ? (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px' }}>
                  <p style={{ fontSize: '0.88em', color: '#991b1b', marginBottom: '8px' }}>{t('employees.confirm_delete')}</p>
                  <input
                    value={deleteInput}
                    onChange={e => setDeleteInput(e.target.value)}
                    placeholder="delete"
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #fecaca', borderRadius: '7px', fontSize: '0.88em', marginBottom: '8px', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }} style={{ flex: 1, padding: '8px', background: 'white', border: '1px solid #d1d5db', borderRadius: '7px', cursor: 'pointer', fontSize: '0.88em' }}>Cancel</button>
                    <button onClick={handleDelete} disabled={deleteInput !== 'delete'} style={{ flex: 1, padding: '8px', background: deleteInput === 'delete' ? '#dc2626' : '#fca5a5', color: 'white', border: 'none', borderRadius: '7px', cursor: deleteInput === 'delete' ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.88em' }}>
                      {t('employees.actions.delete')}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: '10px', background: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}>
                  {t('employees.actions.delete')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Password modal — shown after create or reset */}
      {tempPassword && (
        <PasswordRevealModal
          password={tempPassword}
          onClose={() => {
            setTempPassword(null);
            if (pendingCreated) {
              onCreated(pendingCreated);
              setPendingCreated(null);
              onClose();
            }
          }}
        />
      )}
    </>
  );
}

function FieldInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={{ fontSize: '0.75em', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '5px' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.9em', boxSizing: 'border-box' }}
      />
    </div>
  );
}
