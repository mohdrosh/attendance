import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { generateTimeOptions } from '../utils/timeOptions';
import { RequestType, ReasonCategory, LeaveType } from '@attendance/shared';

const REASONS_BY_TYPE: Record<RequestType, ReasonCategory[]> = {
  late: ['train_delay', 'oversleeping', 'child_dropoff', 'other'],
  early_departure: ['illness', 'work_appointment', 'other_appointment', 'other'],
  absence: ['illness', 'personal', 'other'],
  other_request: ['direct_home', 'other'],
};

const NEEDS_DETAIL: ReasonCategory[] = ['illness', 'other_appointment', 'other'];
const TIME_TYPES: RequestType[] = ['late', 'early_departure'];
const LEAVE_TYPES: LeaveType[] = ['paid', 'unpaid', 'substitute', 'other'];
const TIME_OPTIONS = generateTimeOptions();
const today = new Date().toISOString().split('T')[0];

interface FormState {
  requestType: RequestType;
  startDate: string;
  endDate: string;
  timeFrom: string;
  timeTo: string;
  reasonCategory: ReasonCategory | '';
  reasonDetail: string;
  trainLineId: string;
  leaveType: LeaveType | '';
  adminMessage: string;
  file: File | null;
  fileError: string;
}

export function RequestFormPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const initialForm = location.state?.form ?? null;

  const [form, setForm] = useState<FormState>(initialForm ?? {
    requestType: 'late',
    startDate: today,
    endDate: '',
    timeFrom: '09:00',
    timeTo: '10:00',
    reasonCategory: '',
    reasonDetail: '',
    trainLineId: '',
    leaveType: '',
    adminMessage: '',
    file: null,
    fileError: '',
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleTypeChange(type: RequestType) {
    setForm(prev => ({ ...prev, requestType: type, reasonCategory: '', reasonDetail: '', trainLineId: '', leaveType: '' }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (!allowed.includes(file.type)) return set('fileError', 'Only PDF or XLSX files are allowed');
      if (file.size > 3 * 1024 * 1024) return set('fileError', 'File must be under 3 MB');
    }
    setForm(prev => ({ ...prev, file, fileError: '' }));
  }

  const reasons = REASONS_BY_TYPE[form.requestType];
  const showTime = TIME_TYPES.includes(form.requestType);
  const showDetail = form.reasonCategory !== '' && NEEDS_DETAIL.includes(form.reasonCategory as ReasonCategory);
  const showTrainLine = form.reasonCategory === 'train_delay';
  const showLeaveType = form.requestType === 'absence';
  const showEndDate = form.requestType === 'absence';

  const isValid = form.reasonCategory !== '' &&
    (!showLeaveType || form.leaveType !== '') &&
    (!showDetail || form.reasonDetail.trim() !== '');

  function handleNext() {
    if (!isValid || !user) return;
    navigate('/request/confirm', {
      state: {
        form: { ...form, inputLanguage: i18n.language as 'ja' | 'en' },
        user,
      },
    });
  }

  return (
    <div>
      <Navbar />
      <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
        <h1>{t('form.title')}</h1>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>{t('form.request_type')}</label>
          {(['late', 'early_departure', 'absence', 'other_request'] as RequestType[]).map(type => (
            <label key={type} style={{ marginRight: '16px', cursor: 'pointer' }}>
              <input type="radio" name="requestType" value={type} checked={form.requestType === type} onChange={() => handleTypeChange(type)} />
              {' '}{t(`request_type.${type}`)}
            </label>
          ))}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="startDate" style={{ display: 'block', marginBottom: '4px' }}>{showEndDate ? t('form.start_date') : t('form.date')}</label>
          <input id="startDate" type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} required />
        </div>

        {showEndDate && (
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="endDate" style={{ display: 'block', marginBottom: '4px' }}>{t('form.end_date')}</label>
            <input id="endDate" type="date" value={form.endDate} min={form.startDate} onChange={e => set('endDate', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }} />
          </div>
        )}

        {showTime && (
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label htmlFor="timeFrom" style={{ display: 'block', marginBottom: '4px' }}>{t('form.time_from')}</label>
              <select id="timeFrom" value={form.timeFrom} onChange={e => set('timeFrom', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                {TIME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="timeTo" style={{ display: 'block', marginBottom: '4px' }}>{t('form.time_to')}</label>
              <select id="timeTo" value={form.timeTo} onChange={e => set('timeTo', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}>
                {TIME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>{t('form.reason')}</label>
          {reasons.map(r => (
            <label key={r} style={{ display: 'block', cursor: 'pointer', marginBottom: '4px' }}>
              <input type="radio" name="reason" value={r} checked={form.reasonCategory === r} onChange={() => set('reasonCategory', r)} />
              {' '}{t(`form.reasons.${r}`)}
            </label>
          ))}
        </div>

        {showTrainLine && (
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="trainLine" style={{ display: 'block', marginBottom: '4px' }}>{t('form.train_line')}</label>
            <select id="trainLine" value={form.trainLineId} onChange={e => set('trainLineId', e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}>
              <option value="">--</option>
              {user?.trainLines.map(l => (
                <option key={l.id} value={l.id}>{i18n.language === 'ja' ? l.line_name_ja : l.line_name_en}</option>
              ))}
            </select>
          </div>
        )}

        {showDetail && (
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="reasonDetail" style={{ display: 'block', marginBottom: '4px' }}>{t('form.reason_detail')}</label>
            <textarea id="reasonDetail" value={form.reasonDetail} onChange={e => set('reasonDetail', e.target.value)} rows={3} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }} />
          </div>
        )}

        {showLeaveType && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px' }}>{t('form.leave_type')}</label>
            {LEAVE_TYPES.map(lt => (
              <label key={lt} style={{ marginRight: '16px', cursor: 'pointer' }}>
                <input type="radio" name="leaveType" value={lt} checked={form.leaveType === lt} onChange={() => set('leaveType', lt)} />
                {' '}{t(`form.leave_types.${lt}`)}
              </label>
            ))}
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="adminMessage" style={{ display: 'block', marginBottom: '4px' }}>{t('form.admin_message')}</label>
          <textarea id="adminMessage" value={form.adminMessage} onChange={e => set('adminMessage', e.target.value)} rows={2} style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }} />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '4px' }}>{t('form.attach_file')}</label>
          <input type="file" accept=".pdf,.xlsx" onChange={handleFileChange} />
          {form.fileError && <p style={{ color: 'red', fontSize: '0.85em', marginTop: '4px' }}>{form.fileError}</p>}
          {form.file && !form.fileError && <p style={{ color: 'green', fontSize: '0.85em', marginTop: '4px' }}>✓ {form.file.name}</p>}
        </div>

        <button onClick={handleNext} disabled={!isValid} style={{ padding: '10px 24px', background: isValid ? '#2563eb' : '#ccc', color: 'white', border: 'none', borderRadius: '4px', cursor: isValid ? 'pointer' : 'not-allowed', fontSize: '1em' }}>
          {t('form.next')}
        </button>
      </div>
    </div>
  );
}
