import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '../components/Navbar';
import { RequestDetailPanel } from '../components/RequestDetailPanel';
import { apiFetch } from '../api/client';
import { Request as AttendanceRequest, RequestStatus, RequestType } from '@attendance/shared';

const STATUS_COLORS: Record<RequestStatus, string> = {
  pending: '#e8a838',
  approved: '#2d6a4f',
  rejected: '#c0392b',
};

export function AdminPage() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [selected, setSelected] = useState<AttendanceRequest | null>(null);
  const [filters, setFilters] = useState({ name: '', type: '', from: '', to: '', status: '' });

  const fetchRequests = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.name) params.set('name', filters.name);
    if (filters.type) params.set('type', filters.type);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.status) params.set('status', filters.status);
    const res = await apiFetch(`/api/admin/requests?${params}`);
    if (res.ok) setRequests(await res.json());
  }, [filters]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  function handleStatusChange(id: string, status: RequestStatus) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    setSelected(prev => prev?.id === id ? { ...prev, status } : prev);
  }

  return (
    <div>
      <Navbar />
      <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '16px' }}>{t('admin.title')}</h1>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', padding: '16px', background: '#f9f9f9', borderRadius: '8px' }}>
          <input placeholder={t('admin.filter_name')} value={filters.name} onChange={e => setFilters(f => ({ ...f, name: e.target.value }))} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option value="">{t('admin.all')}</option>
            {(['late', 'early_departure', 'absence', 'other_request'] as RequestType[]).map(type => (
              <option key={type} value={type}>{t(`request_type.${type}`)}</option>
            ))}
          </select>
          <input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
            <option value="">{t('admin.all')}</option>
            {(['pending', 'approved', 'rejected'] as RequestStatus[]).map(s => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </select>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>{t('admin.columns.name')}</th>
              <th style={{ padding: '8px' }}>{t('admin.columns.employee_number')}</th>
              <th style={{ padding: '8px' }}>{t('admin.columns.date')}</th>
              <th style={{ padding: '8px' }}>{t('admin.columns.type')}</th>
              <th style={{ padding: '8px' }}>{t('admin.columns.reason')}</th>
              <th style={{ padding: '8px' }}>{t('admin.columns.submitted')}</th>
              <th style={{ padding: '8px' }}>{t('admin.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id} onClick={() => setSelected(r)} style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={{ padding: '8px' }}>{r.employee_name_ja}</td>
                <td style={{ padding: '8px' }}>{r.employee_number}</td>
                <td style={{ padding: '8px' }}>{r.start_date}{r.end_date ? ` – ${r.end_date}` : ''}</td>
                <td style={{ padding: '8px' }}>{t(`request_type.${r.request_type}`)}</td>
                <td style={{ padding: '8px' }}>{t(`form.reasons.${r.reason_category}`)}</td>
                <td style={{ padding: '8px' }}>{new Date(r.submitted_at).toLocaleDateString()}</td>
                <td style={{ padding: '8px' }}>
                  <span style={{ color: STATUS_COLORS[r.status], fontWeight: 'bold' }}>{t(`status.${r.status}`)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <RequestDetailPanel
          request={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      </div>
    </div>
  );
}
