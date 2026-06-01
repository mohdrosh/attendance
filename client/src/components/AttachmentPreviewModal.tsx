import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import DOMPurify from 'dompurify';
import { useTranslation } from 'react-i18next';

interface Props {
  blob: Blob;
  mimeType: string;
  filename: string;
  onClose: () => void;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function AttachmentPreviewModal({ blob, mimeType, filename, onClose }: Props) {
  const { t } = useTranslation();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [xlsxHtml, setXlsxHtml] = useState<string | null>(null);
  const [xlsxError, setXlsxError] = useState(false);

  useEffect(() => {
    if (mimeType === 'application/pdf') {
      const url = URL.createObjectURL(blob);
      setObjectUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    if (mimeType === XLSX_MIME) {
      blob.arrayBuffer().then(buf => {
        try {
          const wb = XLSX.read(buf);
          const ws = wb.Sheets[wb.SheetNames[0]];
          const raw = XLSX.utils.sheet_to_html(ws);
          setXlsxHtml(DOMPurify.sanitize(raw));
        } catch {
          setXlsxError(true);
        }
      });
    }
  }, [blob, mimeType]);

  const isLoading = mimeType === XLSX_MIME && !xlsxHtml && !xlsxError;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200 }}
      />
      <div style={{
        position: 'fixed', inset: '40px', zIndex: 201,
        background: 'white', borderRadius: '12px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'white', flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.9em', fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📎 {filename}
          </span>
          <button
            onClick={onClose}
            style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer', width: '28px', height: '28px', borderRadius: '50%', fontSize: '0.9em', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', flexShrink: 0, marginLeft: '12px' }}
          >✕</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {mimeType === 'application/pdf' && objectUrl && (
            <iframe src={objectUrl} style={{ width: '100%', height: '100%', border: 'none' }} title={filename} />
          )}
          {mimeType === XLSX_MIME && xlsxHtml && (
            <div
              style={{ padding: '16px', fontSize: '0.82em' }}
              dangerouslySetInnerHTML={{ __html: xlsxHtml }}
            />
          )}
          {mimeType === XLSX_MIME && xlsxError && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              {t('preview.unavailable')}
            </div>
          )}
          {isLoading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
              {t('preview.loading')}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
