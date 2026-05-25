import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { EmployeeListItem } from '@attendance/shared';
import { apiFetch } from '../api/client';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { EmployeeDetailPanel } from '../components/EmployeeDetailPanel';

type RoleFilter = 'all' | 'applicant' | 'admin';
type StatusFilter = 'all' | 'active' | 'deactivated';

export function AdminEmployeesPage() {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [panelMode, setPanelMode] = useState<'view' | 'create' | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => {
    apiFetch('/api/admin/employees')
      .then(r => r.json())
      .then(setEmployees);
  }, []);

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.name_ja.toLowerCase().includes(q) || e.name_en.toLowerCase().includes(q) || e.employee_number.toLowerCase().includes(q);
    const matchRole = roleFilter === 'all' || e.role === roleFilter;
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? e.is_active : !e.is_active);
    return matchSearch && matchRole && matchStatus;
  });

  function openCreate() { setPanelMode('create'); setSelectedId(undefined); }
  function openView(id: string) { setPanelMode('view'); setSelectedId(id); }
  function closePanel() { setPanelMode(null); setSelectedId(undefined); }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1, padding: '28px 20px', maxWidth: '960px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '1.4em', color: '#111' }}>{t('employees.title')}</h1>
          <button
            onClick={openCreate}
            style={{ padding: '9px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}
          >
            + {t('employees.add')}
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('employees.search_placeholder')}
            style={{ flex: 1, minWidth: '200px', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.9em' }}
          />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as RoleFilter)} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.9em', background: 'white' }}>
            <option value="all">{t('employees.filter_role')}: {t('admin.all')}</option>
            <option value="applicant">{t('profile.roles.applicant')}</option>
            <option value="admin">{t('profile.roles.admin')}</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.9em', background: 'white' }}>
            <option value="all">{t('employees.filter_status')}: {t('admin.all')}</option>
            <option value="active">{t('employees.status_active')}</option>
            <option value="deactivated">{t('employees.status_deactivated')}</option>
          </select>
        </div>

        {/* Table */}
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <Th>{t('employees.fields.employee_number')}</Th>
                <Th>{t('employees.fields.name_ja')}</Th>
                <Th>{t('employees.fields.name_en')}</Th>
                <Th>{t('employees.fields.email')}</Th>
                <Th>{t('employees.fields.role')}</Th>
                <Th>{t('employees.filter_status')}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr
                  key={e.id}
                  onClick={() => openView(e.id)}
                  style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={ev => (ev.currentTarget.style.background = 'white')}
                >
                  <Td>{e.employee_number}</Td>
                  <Td>{e.name_ja}</Td>
                  <Td>{e.name_en}</Td>
                  <Td>{e.email}</Td>
                  <Td>{t(`profile.roles.${e.role}`)}</Td>
                  <Td>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
                      fontSize: '0.8em', fontWeight: 700,
                      background: e.is_active ? '#d1fae5' : '#f3f4f6',
                      color: e.is_active ? '#065f46' : '#6b7280',
                    }}>
                      {e.is_active ? t('employees.status_active') : t('employees.status_deactivated')}
                    </span>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                    {t('dashboard.no_requests')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Footer />

      {panelMode && (
        <EmployeeDetailPanel
          mode={panelMode}
          employeeId={selectedId}
          allUsers={employees}
          onClose={closePanel}
          onCreated={(emp) => setEmployees(prev => [...prev, emp])}
          onUpdated={(emp) => setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e))}
          onDeleted={(id) => setEmployees(prev => prev.filter(e => e.id !== id))}
        />
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: '0.8em', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '12px 14px', color: '#374151' }}>{children}</td>;
}
