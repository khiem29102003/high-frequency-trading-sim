'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('trader@example.com');
  const [password, setPassword] = useState('password123');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    try {
      const path = isRegister ? '/auth/register' : '/auth/login';
      const res = await apiFetch<{ accessToken: string }>(path, undefined, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('token', res.accessToken);
      router.push('/dashboard');
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <div className="w-full space-y-3 rounded-xl border border-slate-700 p-6">
        <h1 className="text-xl font-semibold">{isRegister ? 'Create account' : 'Sign in'}</h1>
        <input className="w-full rounded bg-slate-900 p-2" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
        <input className="w-full rounded bg-slate-900 p-2" type="password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button className="w-full rounded bg-indigo-600 p-2" onClick={submit}>
          {isRegister ? 'Register' : 'Login'}
        </button>
        <button className="w-full text-sm text-slate-400" onClick={() => setIsRegister((v) => !v)}>
          {isRegister ? 'Have an account? Login' : 'No account? Register'}
        </button>
      </div>
    </main>
  );
}
