import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './components/Auth/Login';

test('renders login form', () => {
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );

  expect(screen.getByRole('heading', { name: '로그인' })).toBeInTheDocument();
  expect(screen.getByLabelText(/이메일/)).toBeInTheDocument();
  expect(screen.getByLabelText(/비밀번호/)).toBeInTheDocument();
});
