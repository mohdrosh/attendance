import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Request as AttendanceRequest, RequestStatus } from '@attendance/shared';
import { apiFetch } from '../api/client';

interface Props {
  request: AttendanceRequest | null;
  onClose: () => void;
  onStatusChange: (id: string, status: RequestStatus) => void;
}

export function RequestDetailPanel({ request, onClose, onStatusChange }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);

  if (!request) return null;

  async function handleAction(status: 'approved' | 'rejected') {
    if (!request) return;
    setLoading(status === 'approved' ? 'approve' : 'reject');
    try {
      const res = await apiFetch(`/api/admin/requests/${request.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (res.ok) onStatusChange(request.id, status);
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, width: '400px', height: '100vh',
        background: 'white', boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
        zIndex: 101, padding: '24px', overflowY: 'auto',
      }}>
        <h2 style={{ marginBottom: '16px' }}>{t('detail_panel.title')}</h2>

        <dl style={{ lineHeight: 2, marginBottom: '24px' }}>
          <dt style={{ color: '#888', fontSize: '0.8em' }}>{t('admin.columns.name')}</dt>
          <dd>{request.employee_name_ja} / {request.employee_name_en}</dd>
          <dt style={{ color: '#888', fontSize: '0.8em' }}>{t('admin.columns.type')}</dt>
          <dd>{t(`request_type.${request.request_type}`)}</dd>
          <dt style={{ color: '#888', fontSize: '0.8em' }}>{t('admin.columns.date')}</dt>
          <dd>{request.start_date}{request.end_date ? ` – ${request.end_date}` : ''}</dd>
          <dt style={{ color: '#888', fontSize: '0.8em' }}>{t('admin.columns.reason')}</dt>
          <dd>{t(`form.reasons.${request.reason_category}`)}</dd>
          {request.reason_detail && <><dt style={{ color: '#888', fontSize: '0.8em' }}>{t('form.reason_detail')}</dt><dd>{request.reason_detail}</dd></>}
          {request.leave_type && <><dt style={{ color: '#888', fontSize: '0.8em' }}>{t('admin.columns.leave_type')}</dt><dd>{t(`form.leave_types.${request.leave_type}`)}</dd></>}
          {request.admin_message && <><dt style={{ color: '#888', fontSize: '0.8em' }}>{t('detail_panel.admin_message')}</dt><dd>{request.admin_message}</dd></>}
          <dt style={{ color: '#888', fontSize: '0.8em' }}>{t('admin.columns.status')}</dt>
          <dd>{t(`status.${request.status}`)}</dd>
        </dl>

        {request.attachment && (
          <div style={{ marginBottom: '24px', padding: '12px', border: '1px solid #eee', borderRadius: '4px' }}>
            <strong>{t('detail_panel.attachment')}: </strong>
            <a href={`/api/attachments/${request.attachment.id}`} download={request.attachment.original_filename}>
              📎 {request.attachment.original_filename}
            </a>
          </div>
        )}

        {request.status === 'pending' && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => handleAction('approved')} disabled={!!loading} style={{ flex: 1, padding: '10px', background: '#2d6a4f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {loading === 'approve' ? '...' : t('detail_panel.approve')}
            </button>
            <button onClick={() => handleAction('rejected')} disabled={!!loading} style={{ flex: 1, padding: '10px', background: '#c0392b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {loading === 'reject' ? '...' : t('detail_panel.reject')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
