import { useToast } from '../context/ToastContext';

export function Toast() {
  const { message } = useToast();
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
      background: '#2d6a4f', color: 'white', padding: '12px 24px', borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 9999, maxWidth: '480px', textAlign: 'center',
    }}>
      {message}
    </div>
  );
}
