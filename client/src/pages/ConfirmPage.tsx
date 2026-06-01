import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { generateMessage } from '@attendance/shared';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { AttachmentPreviewModal } from '../components/AttachmentPreviewModal';
import { apiFetch } from '../api/client';
import { useToast } from '../context/ToastContext';

export function ConfirmPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { form, user } = location.state ?? {};

  const { showToast } = useToast();
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [todoke, setTodoke] = useState<{ blob: Blob; filename: string } | null>(null);
  const [todokeLoading, setTodokeLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  if (!form || !user) {
    navigate('/request/new');
    return null;
  }

  const { japanese, english } = generateMessage({
    requestType: form.requestType,
    reasonCategory: form.reasonCategory,
    reasonDetail: form.reasonDetail || undefined,
    trainLineName: form.trainLineName || undefined,
    startDate: form.startDate,
    endDate: form.endDate || undefined,
    timeFrom: form.timeFrom || undefined,
    timeTo: form.timeTo || undefined,
    leaveType: form.leaveType || undefined,
    adminMessage: form.adminMessage || undefined,
    employeeName: { ja: user.name_ja, en: user.name_en },
    inputLanguage: form.inputLanguage,
  });

  async function handleGenerateTodoke() {
    setTodokeLoading(true);
    try {
      const res = await apiFetch('/api/todoke/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: form.requestType,
          startDate: form.startDate,
          endDate: form.endDate || undefined,
          timeFrom: form.timeFrom || undefined,
          timeTo: form.timeTo || undefined,
          reasonCategory: form.reasonCategory || undefined,
          reasonDetail: form.reasonCategory === 'train_delay'
            ? (form.trainLineName || undefined)
            : (form.reasonDetail || undefined),
          leaveType: form.leaveType || undefined,
          adminMessage: form.adminMessage || undefined,
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const disposition = res.headers.get('Content-Disposition') ?? '';
        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        const asciiMatch = disposition.match(/filename="([^"]+)"/);
        const filename = utf8Match ? decodeURIComponent(utf8Match[1]) : (asciiMatch ? asciiMatch[1] : 'todoke.xlsx');
        setTodoke({ blob, filename });
      } else {
        showToast('Failed to generate todoke. Please try again.');
      }
    } finally {
      setTodokeLoading(false);
    }
  }

  async function handleSend() {
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('requestType', form.requestType);
      formData.append('startDate', form.startDate);
      if (form.endDate) formData.append('endDate', form.endDate);
      if (form.timeFrom) formData.append('timeFrom', form.timeFrom);
      if (form.timeTo) formData.append('timeTo', form.timeTo);
      if (form.reasonCategory) formData.append('reasonCategory', form.reasonCategory);
      const effectiveReasonDetail = form.reasonCategory === 'train_delay'
        ? form.trainLineName
        : form.reasonDetail;
      if (effectiveReasonDetail) formData.append('reasonDetail', effectiveReasonDetail);
      if (form.leaveType) formData.append('leaveType', form.leaveType);
      if (form.adminMessage) formData.append('adminMessage', form.adminMessage);
      formData.append('inputLanguage', form.inputLanguage);
      if (todoke) {
        formData.append('file', todoke.blob, todoke.filename);
      } else if (form.file) {
        formData.append('file', form.file);
      }

      const res = await apiFetch('/api/requests', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Failed to submit');

      setSubmitted(true);
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: '1.1em', color: '#374151', marginBottom: '28px', maxWidth: '480px' }}>{t('confirm.submitted_message')}</p>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ padding: '11px 28px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95em' }}
          >
            {t('confirm.back_to_dashboard')}
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <div style={{ flex: 1, padding: '28px 20px', maxWidth: '680px', margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: '1.4em', marginBottom: '24px', color: '#111' }}>{t('confirm.title')}</h1>

        <section style={{ marginBottom: '16px', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '0.95em', fontWeight: 700, color: '#374151', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('confirm.summary')}</h2>
          <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: '10px', fontSize: '0.9em' }}>
            <dt style={{ color: '#9ca3af', fontWeight: 600 }}>{t('form.request_type')}</dt><dd style={{ color: '#111' }}>{t(`request_type.${form.requestType}`)}</dd>
            <dt style={{ color: '#9ca3af', fontWeight: 600 }}>{t('form.date')}</dt><dd style={{ color: '#111' }}>{form.startDate}{form.endDate ? ` – ${form.endDate}` : ''}</dd>
            {form.reasonCategory && <><dt style={{ color: '#9ca3af', fontWeight: 600 }}>{t('form.reason')}</dt><dd style={{ color: '#111' }}>{t(`form.reasons.${form.reasonCategory}`)}</dd></>}
            {form.reasonDetail && <><dt style={{ color: '#9ca3af', fontWeight: 600 }}>{t('form.reason_detail')}</dt><dd style={{ color: '#111' }}>{form.reasonDetail}</dd></>}
            {form.trainLineName && <><dt style={{ color: '#9ca3af', fontWeight: 600 }}>{t('form.train_line')}</dt><dd style={{ color: '#111' }}>{form.trainLineName}</dd></>}
            {form.leaveType && <><dt style={{ color: '#9ca3af', fontWeight: 600 }}>{t('form.leave_type')}</dt><dd style={{ color: '#111' }}>{t(`form.leave_types.${form.leaveType}`)}</dd></>}
            {form.adminMessage && <><dt style={{ color: '#9ca3af', fontWeight: 600 }}>{t('detail_panel.admin_message')}</dt><dd style={{ color: '#111' }}>{form.adminMessage}</dd></>}
            {todoke
              ? <><dt style={{ color: '#9ca3af', fontWeight: 600 }}>File</dt><dd style={{ color: '#111' }}>📎 {todoke.filename}</dd></>
              : form.file && <><dt style={{ color: '#9ca3af', fontWeight: 600 }}>File</dt><dd style={{ color: '#111' }}>📎 {form.file.name}</dd></>
            }
          </dl>
        </section>

        <section style={{ marginBottom: '16px', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '0.95em', fontWeight: 700, color: '#374151', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('confirm.message_preview')}</h2>
          {english && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.75em', fontWeight: 700, color: '#9ca3af', marginBottom: '6px' }}>[English]</div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.88em', color: '#374151', background: '#f8fafc', padding: '12px', borderRadius: '8px', margin: 0 }}>{english}</pre>
            </div>
          )}
          <div>
            {english && <div style={{ fontSize: '0.75em', fontWeight: 700, color: '#9ca3af', marginBottom: '6px' }}>[日本語]</div>}
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.88em', color: '#374151', background: '#f8fafc', padding: '12px', borderRadius: '8px', margin: 0 }}>{japanese}</pre>
          </div>
        </section>

        {todoke === null ? (
          <section style={{ border: '2px solid #fb923c', background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '0.95em', fontWeight: 700, color: '#374151', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('todoke.section_title')}</h2>
            <p style={{ fontSize: '0.88em', color: '#6b7280', marginBottom: '14px' }}>{t('todoke.description')}</p>
            <button
              onClick={handleGenerateTodoke}
              disabled={todokeLoading}
              style={{ background: '#fb923c', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: todokeLoading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.9em' }}
            >
              {t(todokeLoading ? 'todoke.generating' : 'todoke.generate')}
            </button>
          </section>
        ) : (
          <section style={{ border: '2px solid #4ade80', background: '#f0fdf4', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '0.95em', fontWeight: 700, color: '#374151', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('todoke.attached')}</h2>
            <p style={{ fontSize: '0.88em', color: '#6b7280', marginBottom: '14px' }}>{t('todoke.attached_message')}</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowPreview(true)}
                style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}
              >
                {t('preview.button')}
              </button>
              <button
                onClick={() => {
                  const url = URL.createObjectURL(todoke.blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = todoke.filename;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}
              >
                {t('todoke.download')}
              </button>
              <button
                onClick={() => setTodoke(null)}
                style={{ background: 'white', border: '1px solid #d1d5db', color: '#374151', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9em' }}
              >
                {t('todoke.remove')}
              </button>
            </div>
            {showPreview && (
              <AttachmentPreviewModal
                blob={todoke.blob}
                mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                filename={todoke.filename}
                onClose={() => setShowPreview(false)}
              />
            )}
          </section>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => navigate('/request/new', { state: { form } })}
            style={{ padding: '11px 24px', cursor: 'pointer', border: '1px solid #d1d5db', borderRadius: '8px', background: 'white', fontSize: '0.95em', color: '#374151' }}
          >
            {t('confirm.back')}
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            style={{ flex: 1, padding: '11px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: sending ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.95em' }}
          >
            {sending ? '…' : t('confirm.send')}
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
