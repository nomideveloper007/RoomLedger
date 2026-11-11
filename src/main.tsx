import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './lib/pwa';

// Register Service Worker for PWA installability & offline support
registerServiceWorker();

createRoot(document.getElementById('root')!).render(<App />);
