import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Navbar } from '../components/Navbar';
import { useRequests } from '../hooks/useRequests';
import { RequestStatus } from '@attendance/shared';

const STATUS_COLORS: Record<RequestStatus, string> = {
  pending: '#e8a838',
  approved: '#2d6a4f',
  rejected: '#c0392b',
};

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { requests, loading, fetchRequests } = useRequests();

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  return (
    <div>
      <Navbar />
      <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h1>{t('dashboard.title')}</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={fetchRequests} disabled={loading} style={{ padding: '8px 16px', cursor: 'pointer' }}>
              {loading ? '...' : t('dashboard.refresh')}
            </button>
            <button onClick={() => navigate('/request/new')} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {t('nav.new_request')}
            </button>
          </div>
        </div>

        {requests.length === 0 ? (
          <p style={{ color: '#888' }}>{t('dashboard.no_requests')}</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>{t('dashboard.columns.date')}</th>
                <th style={{ padding: '8px' }}>{t('dashboard.columns.type')}</th>
                <th style={{ padding: '8px' }}>{t('dashboard.columns.reason')}</th>
                <th style={{ padding: '8px' }}>{t('dashboard.columns.submitted')}</th>
                <th style={{ padding: '8px' }}>{t('dashboard.columns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px' }}>{r.start_date}{r.end_date ? ` – ${r.end_date}` : ''}</td>
                  <td style={{ padding: '8px' }}>{t(`request_type.${r.request_type}`)}</td>
                  <td style={{ padding: '8px' }}>{t(`form.reasons.${r.reason_category}`)}</td>
                  <td style={{ padding: '8px' }}>{new Date(r.submitted_at).toLocaleDateString()}</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{ color: STATUS_COLORS[r.status], fontWeight: 'bold' }}>
                      {t(`status.${r.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
