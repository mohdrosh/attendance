import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Request as AttendanceRequest } from '@attendance/shared';
import { apiFetch } from '../api/client';

interface Props {
  request: AttendanceRequest | null;
  onClose: () => void;
  onRead: (id: string) => void;
  onUnread: (id: string) => void;
  onDelete: (id: string) => void;
}

export function RequestDetailPanel({ request, onClose, onRead, onUnread, onDelete }: Props) {
  const { t } = useTranslation();
  const [isRead, setIsRead] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!request) return;
    setIsRead(request.is_read ?? false);
    setShowDeleteConfirm(false);

    apiFetch(`/api/admin/requests/${request.id}/read`, { method: 'POST' })
      .then(() => {
        setIsRead(true);
        onRead(request.id);
      })
      .catch(() => {/* fire and forget */});
  }, [request?.id]);

  if (!request) return null;

  async function handleMarkUnread() {
    if (!request) return;
    await apiFetch(`/api/admin/requests/${request.id}/unread`, { method: 'POST' });
    setIsRead(false);
    onUnread(request.id);
  }

  async function handleMarkRead() {
    if (!request) return;
    await apiFetch(`/api/admin/requests/${request.id}/read`, { method: 'POST' });
    setIsRead(true);
    onRead(request.id);
  }

  async function handleDelete() {
    if (!request) return;
    await apiFetch(`/api/admin/requests/${request.id}`, { method: 'DELETE' });
    onDelete(request.id);
    onClose();
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
            {request.reason_category && (
              <Field label={t('admin.columns.reason')}>
                {t(`form.reasons.${request.reason_category}`)}
              </Field>
            )}
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

        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0' }}>
          {showDeleteConfirm ? (
            <div>
              <p style={{ fontSize: '0.88em', color: '#374151', marginBottom: '12px' }}>{t('detail_panel.confirm_delete')}</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{ flex: 1, padding: '10px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em', color: '#374151' }}
                >
                  {t('detail_panel.close')}
                </button>
                <button
                  onClick={handleDelete}
                  style={{ flex: 1, padding: '10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}
                >
                  {t('detail_panel.delete')}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={isRead ? handleMarkUnread : handleMarkRead}
                style={{ flex: 1, padding: '10px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88em', color: '#374151' }}
              >
                {isRead ? t('detail_panel.mark_unread') : t('detail_panel.mark_read')}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{ flex: 1, padding: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.88em', color: '#dc2626' }}
              >
                {t('detail_panel.delete')}
              </button>
            </div>
          )}
        </div>
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
