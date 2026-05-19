import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { generateMessage } from '@attendance/shared';
import { Navbar } from '../components/Navbar';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../api/client';
import { Manager } from '@attendance/shared';

export function ConfirmPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { form, user } = location.state ?? {};

  const [managersOpen, setManagersOpen] = useState(false);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  const [sending, setSending] = useState(false);

  if (!form || !user) {
    navigate('/request/new');
    return null;
  }

  const trainLine = user.trainLines.find((l: { id: string }) => l.id === form.trainLineId);
  const trainLineName = i18n.language === 'ja' ? trainLine?.line_name_ja : trainLine?.line_name_en;

  const { japanese, english } = generateMessage({
    requestType: form.requestType,
    reasonCategory: form.reasonCategory,
    reasonDetail: form.reasonDetail || undefined,
    trainLineName,
    startDate: form.startDate,
    endDate: form.endDate || undefined,
    timeFrom: form.timeFrom || undefined,
    timeTo: form.timeTo || undefined,
    leaveType: form.leaveType || undefined,
    adminMessage: form.adminMessage || undefined,
    employeeName: { ja: user.name_ja, en: user.name_en },
    inputLanguage: form.inputLanguage,
  });

  async function handleExpandManagers() {
    if (managersOpen) { setManagersOpen(false); return; }
    setManagersOpen(true);
    if (managers.length > 0) return;
    setLoadingManagers(true);
    try {
      const res = await apiFetch('/api/users/me/managers');
      if (res.ok) setManagers(await res.json());
    } finally {
      setLoadingManagers(false);
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
      formData.append('reasonCategory', form.reasonCategory);
      if (form.reasonDetail) formData.append('reasonDetail', form.reasonDetail);
      if (form.trainLineId) formData.append('trainLineId', form.trainLineId);
      if (form.leaveType) formData.append('leaveType', form.leaveType);
      if (form.adminMessage) formData.append('adminMessage', form.adminMessage);
      formData.append('inputLanguage', form.inputLanguage);
      if (form.file) formData.append('file', form.file);

      const res = await apiFetch('/api/requests', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Failed to submit');

      const managerNames = managers.length > 0
        ? managers.map((m: Manager) => i18n.language === 'ja' ? m.name_ja : m.name_en).join(', ')
        : '';

      showToast(managerNames
        ? (i18n.language === 'ja'
          ? `申請を ${managerNames} に送信しました。承認待ちです。`
          : `Request sent to ${managerNames} and is pending approval.`)
        : t('toast.request_sent')
      );
      navigate('/dashboard');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ padding: '24px', maxWidth: '680px', margin: '0 auto' }}>
        <h1>{t('confirm.title')}</h1>

        <section style={{ marginBottom: '24px', padding: '16px', background: '#f9f9f9', borderRadius: '8px' }}>
          <h2 style={{ marginBottom: '12px' }}>{t('confirm.summary')}</h2>
          <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: '8px' }}>
            <dt style={{ color: '#888' }}>{t('form.request_type')}</dt><dd>{t(`request_type.${form.requestType}`)}</dd>
            <dt style={{ color: '#888' }}>{t('form.date')}</dt><dd>{form.startDate}{form.endDate ? ` – ${form.endDate}` : ''}</dd>
            <dt style={{ color: '#888' }}>{t('form.reason')}</dt><dd>{t(`form.reasons.${form.reasonCategory}`)}</dd>
            {form.reasonDetail && <><dt style={{ color: '#888' }}>{t('form.reason_detail')}</dt><dd>{form.reasonDetail}</dd></>}
            {form.leaveType && <><dt style={{ color: '#888' }}>{t('form.leave_type')}</dt><dd>{t(`form.leave_types.${form.leaveType}`)}</dd></>}
            {form.adminMessage && <><dt style={{ color: '#888' }}>{t('detail_panel.admin_message')}</dt><dd>{form.adminMessage}</dd></>}
            {form.file && <><dt style={{ color: '#888' }}>File</dt><dd>📎 {form.file.name}</dd></>}
          </dl>
        </section>

        <section style={{ marginBottom: '24px', padding: '16px', background: '#f9f9f9', borderRadius: '8px' }}>
          <h2 style={{ marginBottom: '12px' }}>{t('confirm.message_preview')}</h2>
          {english && (
            <div style={{ marginBottom: '16px' }}>
              <strong>[English]</strong>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9em', marginTop: '8px' }}>{english}</pre>
            </div>
          )}
          <div>
            {english && <strong>[日本語]</strong>}
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9em', marginTop: english ? '8px' : 0 }}>{japanese}</pre>
          </div>
        </section>

        <section style={{ marginBottom: '24px' }}>
          <button onClick={handleExpandManagers} style={{ cursor: 'pointer', background: 'none', border: '1px solid #ddd', borderRadius: '4px', padding: '8px 12px', width: '100%', textAlign: 'left' }}>
            {t('confirm.recipients')} {managersOpen ? '▲' : '▼'}
          </button>
          {managersOpen && (
            <div style={{ padding: '12px', border: '1px solid #ddd', borderTop: 'none', borderRadius: '0 0 4px 4px' }}>
              {loadingManagers ? '...' : managers.length === 0
                ? <span style={{ color: '#888' }}>No managers assigned</span>
                : managers.map((m: Manager) => <div key={m.id}>{m.name_ja} / {m.name_en}</div>)
              }
            </div>
          )}
        </section>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => navigate('/request/new', { state: { form } })} style={{ padding: '10px 24px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: '4px', background: 'white' }}>
            {t('confirm.back')}
          </button>
          <button onClick={handleSend} disabled={sending} style={{ padding: '10px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {sending ? '...' : t('confirm.send')}
          </button>
        </div>
      </div>
    </div>
  );
}
