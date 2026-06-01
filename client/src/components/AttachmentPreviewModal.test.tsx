import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';

vi.mock('xlsx', () => ({
  read: vi.fn(() => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } })),
  utils: { sheet_to_html: vi.fn(() => '<table><tr><td>preview cell</td></tr></table>') },
}));

vi.mock('dompurify', () => ({
  default: { sanitize: (s: string) => s },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();
Object.defineProperty(globalThis, 'URL', {
  value: { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL },
  writable: true,
});

const PDF_MIME = 'application/pdf';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('AttachmentPreviewModal', () => {
  const onClose = vi.fn();

  beforeEach(() => { vi.clearAllMocks(); });

  it('shows filename in header', () => {
    const blob = new Blob(['%PDF'], { type: PDF_MIME });
    render(<AttachmentPreviewModal blob={blob} mimeType={PDF_MIME} filename="report.pdf" onClose={onClose} />);
    expect(screen.getByText(/report\.pdf/)).toBeInTheDocument();
  });

  it('calls onClose when ✕ button clicked', () => {
    const blob = new Blob(['%PDF'], { type: PDF_MIME });
    render(<AttachmentPreviewModal blob={blob} mimeType={PDF_MIME} filename="report.pdf" onClose={onClose} />);
    fireEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders iframe for PDF using blob URL', () => {
    const blob = new Blob(['%PDF'], { type: PDF_MIME });
    render(<AttachmentPreviewModal blob={blob} mimeType={PDF_MIME} filename="report.pdf" onClose={onClose} />);
    const iframe = document.querySelector('iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe?.src).toContain('blob:mock-url');
  });

  it('renders XLSX table content after async parse', async () => {
    const blob = new Blob(['xlsx'], { type: XLSX_MIME });
    Object.defineProperty(blob, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });
    render(<AttachmentPreviewModal blob={blob} mimeType={XLSX_MIME} filename="data.xlsx" onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText('preview cell')).toBeInTheDocument();
    });
  });

  it('shows loading state before XLSX is parsed', () => {
    const blob = new Blob(['xlsx'], { type: XLSX_MIME });
    Object.defineProperty(blob, 'arrayBuffer', {
      value: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    render(<AttachmentPreviewModal blob={blob} mimeType={XLSX_MIME} filename="data.xlsx" onClose={onClose} />);
    expect(screen.getByText('preview.loading')).toBeInTheDocument();
  });
});
