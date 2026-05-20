import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Request as AttendanceRequest, RequestStatus } from '@attendance/shared';
import { apiFetch } from '../api/client';

interface Props {
  request: AttendanceRequest | null;
  onClose: () => void;
  onStatusChange: (id: string, status: RequestStatus) => void;
}

export function RequestDetailPanel({ request, onClose, onStatusChange }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [sendNotification, setSendNotification] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [result, setResult] = useState<'approved' | 'rejected' | null>(null);

  useEffect(() => {
    setSendNotification(false);
    setRejectionReason('');
    setResult(null);
  }, [request?.id]);

  if (!request) return null;

  async function handleAction(status: 'approved' | 'rejected') {
    if (!request) return;
    setLoading(status === 'approved' ? 'approve' : 'reject');
    try {
      const res = await apiFetch(`/api/admin/requests/${request.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          sendNotification,
          ...(status === 'rejected' && rejectionReason ? { rejectionReason } : {}),
        }),
      });
      if (res.ok) {
        onStatusChange(request.id, status);
        setResult(status);
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100 }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, width: '380px', height: '100vh',
        background: 'white', boxShadow: '-6px 0 24px rgba(0,0,0,0.12)',
        zIndex: 101, overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <h2 style={{ fontSize: '1.05em', fontWeight: 700, color: '#111' }}>{t('detail_panel.title')}</h2>
          <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', width: '28px', height: '28px', borderRadius: '50%', fontSize: '0.9em', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>✕</button>
        </div>

        {result !== null ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5em', color: result === 'approved' ? '#16a34a' : '#991b1b', marginBottom: '12px' }}>
              {result === 'approved' ? '✓' : '✗'}
            </div>
            <p style={{ fontSize: '1.1em', fontWeight: 700, color: result === 'approved' ? '#16a34a' : '#991b1b', marginBottom: '28px' }}>
              {t(result === 'approved' ? 'detail_panel.approved_title' : 'detail_panel.rejected_title')}
            </p>
            <button onClick={onClose} style={{ padding: '10px 28px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95em', fontWeight: 600, color: '#374151' }}>
              {t('detail_panel.close')}
            </button>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, padding: '20px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Field label={t('admin.columns.name')}>
                  <span style={{ fontWeight: 600 }}>{request.employee_name_ja}</span>
                  <span style={{ color: '#6b7280', marginLeft: '8px', fontSize: '0.9em' }}>{request.employee_name_en}</span>
                </Field>
                <Field label={t('admin.columns.type')}>
                  {t(`request_type.${request.request_type}`)}
                </Field>
                <Field label={t('admin.columns.date')}>
                  {request.start_date}{request.end_date ? ` – ${request.end_date}` : ''}
                </Field>
                <Field label={t('admin.columns.reason')}>
                  {t(`form.reasons.${request.reason_category}`)}
                </Field>
                {request.reason_detail && (
                  <Field label={t('form.reason_detail')}>
                    <span style={{ color: '#374151' }}>{request.reason_detail}</span>
                  </Field>
                )}
                {request.leave_type && (
                  <Field label={t('admin.columns.leave_type')}>
                    {t(`form.leave_types.${request.leave_type}`)}
                  </Field>
                )}
                {request.admin_message && (
                  <Field label={t('detail_panel.admin_message')}>
                    <span style={{ color: '#374151' }}>{request.admin_message}</span>
                  </Field>
                )}
                <Field label={t('admin.columns.status')}>
                  <StatusBadge status={request.status} label={t(`status.${request.status}`)} />
                </Field>
              </div>

              {request.attachment && (
                <div style={{ marginTop: '20px', padding: '12px 14px', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2em' }}>📎</span>
                  <a
                    href={`/api/attachments/${request.attachment.id}`}
                    download={request.attachment.original_filename}
                    style={{ color: '#1d4ed8', fontSize: '0.9em', textDecoration: 'none' }}
                  >
                    {request.attachment.original_filename}
                  </a>
                </div>
              )}
            </div>

            {request.status === 'pending' && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0' }}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88em', color: '#374151', cursor: 'pointer' }}>
                    <input type="checkbox" checked={sendNotification} onChange={e => setSendNotification(e.target.checked)} />
                    {t('detail_panel.send_notification')}
                  </label>
                </div>
                {sendNotification && (
                  <div style={{ marginBottom: '10px' }}>
                    <textarea
                      value={rejectionReason}
                      onChange={e => setRejectionReason(e.target.value)}
                      placeholder={t('detail_panel.rejection_reason_placeholder')}
                      rows={3}
                      style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.88em', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => handleAction('approved')}
                    disabled={!!loading}
                    style={{ flex: 1, padding: '11px', background: '#065f46', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}
                  >
                    {loading === 'approve' ? '…' : t('detail_panel.approve')}
                  </button>
                  <button
                    onClick={() => handleAction('rejected')}
                    disabled={!!loading}
                    style={{ flex: 1, padding: '11px', background: '#991b1b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}
                  >
                    {loading === 'reject' ? '…' : t('detail_panel.reject')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.75em', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '0.93em', color: '#111' }}>{children}</div>
    </div>
  );
}

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  pending:  { color: '#92400e', bg: '#fef3c7' },
  approved: { color: '#065f46', bg: '#d1fae5' },
  rejected: { color: '#991b1b', bg: '#fee2e2' },
};

function StatusBadge({ status, label }: { status: string; label: string }) {
  const s = STATUS_STYLES[status] ?? { color: '#374151', bg: '#f3f4f6' };
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '0.78em', fontWeight: 700, color: s.color, background: s.bg }}>
      {label}
    </span>
  );
}
