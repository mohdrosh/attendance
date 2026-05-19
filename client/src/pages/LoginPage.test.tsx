import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LoginPage } from './LoginPage';
import { vi } from 'vitest';
import '../i18n';

function renderLoginPage(login = vi.fn()) {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={{ user: null, loading: false, login, logout: vi.fn() }}>
        <LoginPage />
      </AuthContext.Provider>
    </BrowserRouter>
  );
}

describe('LoginPage', () => {
  it('renders employee number and password fields', () => {
    renderLoginPage();
    expect(screen.getByLabelText(/社員番号|Employee Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/パスワード|Password/i)).toBeInTheDocument();
  });

  it('calls login with entered credentials on submit', async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    renderLoginPage(login);
    fireEvent.change(screen.getByLabelText(/社員番号|Employee Number/i), { target: { value: 'EMP-001' } });
    fireEvent.change(screen.getByLabelText(/パスワード|Password/i), { target: { value: 'Test1234!' } });
    fireEvent.click(screen.getByRole('button', { name: /ログイン|Login/i }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('EMP-001', 'Test1234!'));
  });

  it('shows error message on failed login', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    renderLoginPage(login);
    fireEvent.change(screen.getByLabelText(/社員番号|Employee Number/i), { target: { value: 'BAD' } });
    fireEvent.change(screen.getByLabelText(/パスワード|Password/i), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /ログイン|Login/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
