import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { RequestDetailPanel } from '../components/RequestDetailPanel';
import { apiFetch } from '../api/client';
import type { Request as AttendanceRequest, RequestType } from '@attendance/shared';

type SortKey = 'newest' | 'oldest' | 'name';

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: '8px',
  fontSize: '0.85em', background: 'white', color: '#374151', cursor: 'pointer',
};

export function AdminPage() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<AttendanceRequest[]>([]);
  const [selected, setSelected] = useState<AttendanceRequest | null>(null);
  const [filterType, setFilterType] = useState<RequestType | ''>('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo]     = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [search, setSearch]         = useState('');
  const [sortBy, setSortBy]         = useState<SortKey>('newest');

  const fetchRequests = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterType) params.set('type', filterType);
    if (filterFrom) params.set('from', filterFrom);
    if (filterTo)   params.set('to',   filterTo);
    const res = await apiFetch(`/api/admin/requests?${params}`);
    if (res.ok) setRequests(await res.json());
  }, [filterType, filterFrom, filterTo]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  function handleRead(id: string) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, is_read: true } : r));
  }

  function handleUnread(id: string) {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, is_read: false } : r));
  }

  function handleDelete(id: string) {
    setRequests(prev => prev.filter(r => r.id !== id));
    setSelected(null);
  }

  const stats = useMemo(() => ({
    total: requests.length,
  }), [requests]);

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...requests]
      .filter(r => {
        if (filterUnread && r.is_read) return false;
        if (!q) return true;
        return (
          r.employee_name_ja.toLowerCase().includes(q) ||
          r.employee_name_en.toLowerCase().includes(q) ||
          r.employee_number.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'oldest') return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
        if (sortBy === 'name')   return a.employee_name_en.localeCompare(b.employee_name_en);
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });
  }, [requests, search, sortBy, filterUnread]);

  const hasFilters = filterType || filterFrom || filterTo;

  function clearFilters() {
    setFilterType(''); setFilterFrom(''); setFilterTo('');
  }

  function handleClose() {
    setSelected(null);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1, padding: '28px 20px', maxWidth: '1140px', margin: '0 auto', width: '100%' }}>

        {/* Header */}
        <h1 style={{ fontSize: '1.4em', color: '#111', marginBottom: '22px' }}>{t('admin.title')}</h1>

        {/* Stat cards — Total only */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '12px', marginBottom: '22px', maxWidth: '220px' }}>
          <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #f0f0f0' }}>
            <div style={{ fontSize: '0.72em', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
              {t('admin.stats.total')}
            </div>
            <div style={{ fontSize: '1.7em', fontWeight: 700, color: '#1d4ed8' }}>{stats.total}</div>
          </div>
        </div>

        {/* Search + sort row */}
        <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('admin.filter_name')}
            style={{ flex: '1 1 200px', padding: '7px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.88em' }}
          />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} style={selectStyle}>
            <option value="newest">{t('admin.sort_newest')}</option>
            <option value="oldest">{t('admin.sort_oldest')}</option>
            <option value="name">{t('admin.sort_name')}</option>
          </select>
          {search && (
            <button onClick={() => setSearch('')} style={{ padding: '7px 12px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82em', color: '#6b7280' }}>
              ✕ Clear search
            </button>
          )}
        </div>

        {/* Filter row */}
        <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78em', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '4px' }}>Filter</span>
          <select value={filterType} onChange={e => setFilterType(e.target.value as RequestType | '')} style={selectStyle}>
            <option value="">{t('admin.all')} ({t('form.request_type')})</option>
            {(['late', 'early_departure', 'absence', 'chokko', 'chokki', 'kyujitsu_shukkin', 'other_request'] as RequestType[]).map(type => (
              <option key={type} value={type}>{t(`request_type.${type}`)}</option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85em', color: '#6b7280' }}>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ ...selectStyle, color: filterFrom ? '#111' : '#9ca3af' }} />
            <span>→</span>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ ...selectStyle, color: filterTo ? '#111' : '#9ca3af' }} />
          </div>
          <button
            onClick={() => setFilterUnread(prev => !prev)}
            style={{
              padding: '7px 14px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.82em', fontWeight: 600,
              background: filterUnread ? '#3b82f6' : 'transparent',
              color: filterUnread ? 'white' : '#6b7280',
              border: filterUnread ? '1px solid #3b82f6' : '1px solid #d1d5db',
              transition: 'all 0.15s',
            }}
          >
            {t('admin.filter_unread')}
          </button>
          {hasFilters && (
            <button onClick={clearFilters} style={{ padding: '7px 12px', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.82em', color: '#6b7280' }}>
              ✕ Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          {displayed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
              <div style={{ fontSize: '2em', marginBottom: '10px' }}>🔍</div>
              <p style={{ fontSize: '0.92em' }}>No requests found</p>
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                    {['name', 'employee_number', 'date', 'time_from', 'time_to', 'type', 'reason', 'submitted'].map(col => (
                      <th key={col} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '0.75em', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {t(`admin.columns.${col}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((r, i) => {
                    const isUnread = !r.is_read;
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelected(r)}
                        style={{ borderBottom: i < displayed.length - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}
                      >
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: '0.9em', fontWeight: isUnread ? 700 : 500, color: '#111' }}>{r.employee_name_ja}</div>
                          <div style={{ fontSize: '0.78em', color: '#9ca3af', fontWeight: isUnread ? 700 : 400 }}>{r.employee_name_en}</div>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.82em', color: '#6b7280', fontWeight: isUnread ? 700 : 400 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isUnread && (
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block', flexShrink: 0 }} />
                            )}
                            {r.employee_number}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.88em', fontWeight: isUnread ? 700 : 400 }}>{r.start_date}{r.end_date ? ` – ${r.end_date}` : ''}</td>
                        <td style={{ padding: '12px 14px', fontSize: '0.88em', color: '#374151', fontWeight: isUnread ? 700 : 400 }}>{r.time_from ? r.time_from.slice(0, 5) : '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: '0.88em', color: '#374151', fontWeight: isUnread ? 700 : 400 }}>{r.time_to ? r.time_to.slice(0, 5) : '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: '0.88em', fontWeight: isUnread ? 700 : 400 }}>{t(`request_type.${r.request_type}`)}</td>
                        <td style={{ padding: '12px 14px', fontSize: '0.88em', color: '#6b7280', fontWeight: isUnread ? 700 : 400 }}>{r.reason_category ? t(`form.reasons.${r.reason_category}`) : '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: '0.88em', color: '#6b7280', fontWeight: isUnread ? 700 : 400 }}>{new Date(r.submitted_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ padding: '10px 14px', borderTop: '1px solid #f3f4f6', fontSize: '0.8em', color: '#9ca3af' }}>
                {displayed.length} / {requests.length} {t('admin.stats.total').toLowerCase()}
              </div>
            </>
          )}
        </div>

        <RequestDetailPanel
          request={selected}
          onClose={handleClose}
          onRead={handleRead}
          onUnread={handleUnread}
          onDelete={handleDelete}
        />
      </div>
      <Footer />
    </div>
  );
}
