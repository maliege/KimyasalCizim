import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// Service worker'i kaydet: uygulamayi telefona kurulabilir yapar ve ilk
// ziyaretten sonra cevrimdisi calistirir. `autoUpdate` ayari sayesinde yeni
// surum bulununca sessizce devralinir; kullaniciya soru sorulmaz.
// Gelistirme sunucusunda devre disi (vite.config.ts > devOptions).
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
