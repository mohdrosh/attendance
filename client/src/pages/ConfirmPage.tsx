import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { generateMessage } from '@attendance/shared';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useToast } from '../context/ToastContext';
import { apiFetch } from '../api/client';
import type { Manager } from '@attendance/shared';

export function ConfirmPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast: _showToast } = useToast();
  const { form, user } = location.state ?? {};

  const [managers, setManagers] = useState<Manager[]>([]);
  const [managerId, setManagerId] = useState('');
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedManagerName, setSubmittedManagerName] = useState('');

  useEffect(() => {
    apiFetch('/api/users/me/managers')
      .then(res => res.ok ? res.json() : [])
      .then((data: Manager[]) => setManagers(data))
      .catch(() => {});
  }, []);

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
      if (form.reasonDetail) formData.append('reasonDetail', form.reasonDetail);
      if (form.trainLineId) formData.append('trainLineId', form.trainLineId);
      if (form.leaveType) formData.append('leaveType', form.leaveType);
      if (form.adminMessage) formData.append('adminMessage', form.adminMessage);
      formData.append('inputLanguage', form.inputLanguage);
      if (form.file) formData.append('file', form.file);
      formData.append('managerId', managerId);

      const res = await apiFetch('/api/requests', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Failed to submit');

      const selectedManager = managers.find(m => m.id === managerId);
      const displayName = selectedManager
        ? (i18n.language === 'ja' ? selectedManager.name_ja : selectedManager.name_en)
        : '';
      setSubmittedManagerName(displayName);
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
          <p style={{ fontSize: '1.1em', color: '#374151', marginBottom: '28px', maxWidth: '480px' }}>{t('confirm.submitted_message', { name: submittedManagerName })}</p>
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
            {form.leaveType && <><dt style={{ color: '#9ca3af', fontWeight: 600 }}>{t('form.leave_type')}</dt><dd style={{ color: '#111' }}>{t(`form.leave_types.${form.leaveType}`)}</dd></>}
            {form.adminMessage && <><dt style={{ color: '#9ca3af', fontWeight: 600 }}>{t('detail_panel.admin_message')}</dt><dd style={{ color: '#111' }}>{form.adminMessage}</dd></>}
            {form.file && <><dt style={{ color: '#9ca3af', fontWeight: 600 }}>File</dt><dd style={{ color: '#111' }}>📎 {form.file.name}</dd></>}
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

        <section style={{ marginBottom: '24px', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <label style={{ display: 'block', fontSize: '0.85em', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>{t('confirm.manager')} <span style={{ color: '#ef4444' }}>*</span></label>
          <select
            value={managerId}
            onChange={e => setManagerId(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', fontSize: '0.9em', border: '1px solid #d1d5db', borderRadius: '8px', background: 'white', color: managerId ? '#111' : '#9ca3af', cursor: 'pointer' }}
          >
            <option value="" disabled>{t('confirm.select_manager')}</option>
            {managers.map((m: Manager) => (
              <option key={m.id} value={m.id}>{m.name_ja} / {m.name_en}</option>
            ))}
          </select>
        </section>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => navigate('/request/new', { state: { form } })}
            style={{ padding: '11px 24px', cursor: 'pointer', border: '1px solid #d1d5db', borderRadius: '8px', background: 'white', fontSize: '0.95em', color: '#374151' }}
          >
            {t('confirm.back')}
          </button>
          <button
            onClick={handleSend}
            disabled={sending || managerId === ''}
            style={{ flex: 1, padding: '11px', background: managerId === '' ? '#93c5fd' : '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: managerId === '' ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.95em' }}
          >
            {sending ? '…' : t('confirm.send')}
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
