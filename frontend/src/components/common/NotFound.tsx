import { Link, useLocation } from 'react-router-dom';

export default function NotFound() {
  const location = useLocation();

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        background: 'rgb(var(--color-bg-primary))',
        color: 'rgb(var(--color-text-primary))',
      }}
    >
      <section style={{ maxWidth: '34rem', textAlign: 'center' }}>
        <p style={{ color: 'rgb(var(--color-text-tertiary))', marginBottom: '0.5rem' }}>404</p>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>Page not found</h1>
        <p style={{ color: 'rgb(var(--color-text-secondary))', marginBottom: '1.5rem' }}>
          Nothing is available at <code>{location.pathname}</code>.
        </p>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            padding: '0.7rem 1rem',
            borderRadius: '0.5rem',
            background: 'rgb(var(--color-primary))',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Return home
        </Link>
      </section>
    </main>
  );
}
