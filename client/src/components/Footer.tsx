export function Footer() {
  return (
    <footer style={{
      textAlign: 'center',
      padding: '18px 20px',
      fontSize: '0.78em',
      color: '#9ca3af',
      borderTop: '1px solid #f0f0f0',
      background: 'white',
      marginTop: 'auto',
    }}>
      © {new Date().getFullYear()} All rights reserved by MORABU HANSHIN Industry Co., Ltd.
    </footer>
  );
}
