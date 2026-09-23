import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { ToastProvider } from './components/Toast';
import { useAppState } from './lib/store';

const Landing = lazy(() => import('./landing/Landing').then((m) => ({ default: m.Landing })));
const AppPage = lazy(() => import('./app/AppPage').then((m) => ({ default: m.AppPage })));
const ClientPage = lazy(() => import('./client/ClientPage').then((m) => ({ default: m.ClientPage })));
const Legal = lazy(() => import('./legal/Legal').then((m) => ({ default: m.Legal })));

/** The app honours the theme setting; the landing page and client pages are always paper. */
function ThemeSync() {
  const theme = useAppState().settings.theme;
  const { pathname } = useLocation();
  useEffect(() => {
    const root = document.documentElement;
    const inApp = pathname.startsWith('/app');
    if (!inApp || theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    const dark = inApp && (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#12110e' : '#f4f1ea');
  }, [theme, pathname]);
  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function CanonicalSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!el) {
      el = document.createElement('link');
      el.rel = 'canonical';
      document.head.appendChild(el);
    }
    const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
    el.href = `https://www.optileno.com${cleanPath}`;
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ThemeSync />
        <ScrollToTop />
        <CanonicalSync />
        <Suspense fallback={<div className="route-loading" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app/*" element={<AppPage />} />
            <Route path="/s" element={<ClientPage />} />
            <Route path="/privacy" element={<Legal page="privacy" />} />
            <Route path="/terms" element={<Legal page="terms" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Analytics
          beforeSend={(event) => {
            const url = new URL(event.url);
            url.hash = '';
            for (const key of ['text', 'title']) url.searchParams.delete(key);
            return { ...event, url: url.toString() };
          }}
        />
      </ToastProvider>
    </BrowserRouter>
  );
}
