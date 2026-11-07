import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/wght-italic.css';
import '@fontsource-variable/hanken-grotesk';
import './styles/global.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/interaction.css';
import './styles/quick-actions.css';
import './styles/reviews.css';
import './styles/ai-insights.css';
import './styles/guest-desk.css';
import './styles/customers.css';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
