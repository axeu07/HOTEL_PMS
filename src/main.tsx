import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/wght-italic.css';
import '@fontsource-variable/hanken-grotesk';
import './styles/global.css';
import './styles/tokens.css';
import './styles/landing-motion.css';
import './styles/door.css';
import Landing from './Landing';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
