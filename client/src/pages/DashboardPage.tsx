import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useRequests } from '../hooks/useRequests';
import type { RequestType } from '@attendance/shared';

type SortKey = 'newest' | 'oldest';

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: '8px',
  fontSize: '0.85em', background: 'white', color: '#374151', cursor: 'pointer',
};

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { requests, loading, fetchRequests } = useRequests();

  const [search, setSearch]         = useState('');
  const [filterType, setFilterType] = useState<RequestType | ''>('');
  const [sortBy, setSortBy]         = useState<SortKey>('newest');

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const stats = useMemo(() => ({
    total: requests.length,
  }), [requests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests
      .filter(r => {
        if (filterType && r.request_type !== filterType) return false;
        if (q && !r.start_date.includes(q) &&
            !t(`request_type.${r.request_type}`).toLowerCase().includes(q) &&
            !t(`form.reasons.${r.reason_category}`).toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });
  }, [requests, search, filterType, sortBy, t]);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1, padding: '28px 20px', maxWidth: '960px', margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ fontSize: '1.4em', color: '#111', margin: 0 }}>{t('dashboard.title')}</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={fetchRequests} disabled={loading}
              style={{ padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '0.85em', color: '#6b7280' }}
            >
              {loading ? '…' : t('dashboard.refresh')}
            </button>
            <button
              onClick={() => navigate('/request/new')}
              style={{ padding: '8px 18px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.88em', fontWeight: 600 }}
            >
              + {t('nav.new_request')}
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '12px', marginBottom: '22px', maxWidth: '200px' }}>
          <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
              {t('dashboard.stats.total')}
            </div>
            <div style={{ fontSize: '1.7em', fontWeight: 700, color: '#1d4ed8' }}>{stats.total}</div>
          </div>
        </div>

        {/* Search + filters */}
        <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('dashboard.search_placeholder')}
            style={{ flex: '1 1 180px', padding: '7px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.88em', minWidth: '140px' }}
          />
          <select value={filterType} onChange={e => setFilterType(e.target.value as RequestType | '')} style={selectStyle}>
            <option value="">{t('admin.all')} ({t('form.request_type')})</option>
            {(['late', 'early_departure', 'absence', 'chokko', 'chokki', 'kyujitsu_shukkin', 'other_request'] as RequestType[]).map(type => (
              <option key={type} value={type}>{t(`request_type.${type}`)}</option>
            ))}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} style={selectStyle}>
            <option value="newest">{t('dashboard.sort_newest')}</option>
            <option value="oldest">{t('dashboard.sort_oldest')}</option>
          </select>
          {(search || filterType) && (
            <button
              onClick={() => { setSearch(''); setFilterType(''); }}
              style={{ padding: '7px 12px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82em', color: '#6b7280' }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: '2.2em', marginBottom: '10px' }}>📭</div>
            <p style={{ fontSize: '0.92em' }}>{t('dashboard.no_requests')}</p>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                  {['date', 'time_from', 'time_to', 'type', 'reason', 'submitted'].map(col => (
                    <th key={col} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75em', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {t(`dashboard.columns.${col}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '13px 16px', fontSize: '0.9em', fontWeight: 500 }}>
                      {r.start_date}{r.end_date ? ` – ${r.end_date}` : ''}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '0.88em', color: '#374151' }}>
                      {r.time_from ? r.time_from.slice(0, 5) : '—'}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '0.88em', color: '#374151' }}>
                      {r.time_to ? r.time_to.slice(0, 5) : '—'}
                    </td>
                    <td style={{ padding: '13px 16px', fontSize: '0.9em' }}>{t(`request_type.${r.request_type}`)}</td>
                    <td style={{ padding: '13px 16px', fontSize: '0.88em', color: '#6b7280' }}>{r.reason_category ? t(`form.reasons.${r.reason_category}`) : '—'}</td>
                    <td style={{ padding: '13px 16px', fontSize: '0.88em', color: '#6b7280' }}>{new Date(r.submitted_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f3f4f6', fontSize: '0.8em', color: '#9ca3af' }}>
              {filtered.length} / {requests.length} {t('dashboard.stats.total').toLowerCase()}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
