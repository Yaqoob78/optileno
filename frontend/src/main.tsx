import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { inject } from '@vercel/analytics';
import App from './App';
import './styles/base.css';

// Cookie-free, aggregate page counts. Everything after "#" is removed before
// anything is sent, because a client scope page carries its content there.
if (import.meta.env.PROD) {
  inject({
    mode: 'production',
    beforeSend: (event) => {
      const url = new URL(event.url);
      url.hash = '';
      for (const key of ['text', 'title']) url.searchParams.delete(key);
      return { ...event, url: url.toString() };
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
