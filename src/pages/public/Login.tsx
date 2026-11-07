import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useApp, useAuth } from '@/app/providers';
import { Art } from '@/components/art';
import { BrandMark, Icon } from '@/components/icons';
import { Button, TextField, useFeedback } from '@/components/ui';
import { useResource } from '@/hooks/useResource';
import { errorMessage, hasErrors, required, validEmail } from '@/lib/validation';
import { authService } from '@/services';

export default function Login() {
  const { hotel } = useApp();
  const { user, signIn, signInAs } = useAuth();
  const { run } = useFeedback();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');

  const { data: accounts } = useResource(async () => {
    const [users, roles] = await Promise.all([authService.demoAccounts(), authService.roles()]);
    return users.map((u) => ({ user: u, role: roles.find((r) => r.id === u.roleId)! }));
  });

  const destination = (location.state as { from?: string } | null)?.from ?? '/app/dashboard';
  if (user) return <Navigate to={destination} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      email: required(email, 'Email') || validEmail(email),
      password: required(password, 'Password'),
    };
    setErrors(next);
    if (hasErrors(next)) return;
    try {
      setFailure('');
      await signIn(email, password);
      navigate(destination, { replace: true });
    } catch (error) {
      setFailure(errorMessage(error));
    }
  };

  return (
    <div className="login-page">
      <div className="login-art" aria-hidden="true">
        <Art name="terrace" title="" />
        <div className="login-art-text">
          <h2>Every room, every guest, every bill, in one calm place.</h2>
          <p style={{ marginTop: 8, opacity: 0.85 }}>Folio hotel suite, shown here running the fictional {hotel.name}.</p>
        </div>
      </div>
      <div className="login-form-wrap">
        <div className="login-box">
          <Link to="/" className="site-logo" style={{ marginBottom: 22 }}>
            <span style={{ color: '#8d6216' }}><BrandMark size={24} /></span>{hotel.name}
          </Link>
          <h1 style={{ fontSize: 34, fontWeight: 400 }}>Sign in to the demo</h1>
          <p style={{ color: '#5a635d', margin: '4px 0 18px' }}>Mock sign-in for demonstration. No real accounts exist.</p>

          <form className="stack" onSubmit={submit} noValidate>
            <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="off" />
            <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} autoComplete="off" />
            {failure && <div className="alert alert-bad"><Icon name="alert" /><span>{failure}</span></div>}
            <Button variant="primary" type="submit" block>Sign in</Button>
          </form>

          <h2 style={{ fontSize: 20, fontWeight: 450, marginTop: 28 }}>Sample logins</h2>
          <div style={{ marginTop: 8 }}>
            {accounts?.map(({ user: account, role }) => (
              <div key={account.id} className="sample-row">
                <div>
                  <div className="strong">{role.name}</div>
                  <code>{account.email} · {account.demoPassword}</code>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.demoPassword);
                    setErrors({});
                    setFailure('');
                  }}
                >
                  Fill in
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  aria-label={`One-click sign in as ${role.name}`}
                  onClick={() => run(async () => { await signInAs(account.id); navigate(destination, { replace: true }); })}
                >
                  Enter
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
