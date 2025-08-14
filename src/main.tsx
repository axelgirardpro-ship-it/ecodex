// Trusted Types (no-op in unsupported browsers)
try {
  // @ts-ignore
  if (window.trustedTypes && !window.trustedTypes.getPolicy('default')) {
    // @ts-ignore
    window.trustedTypes.createPolicy('default', {
      createHTML: (s: string) => s,
      createScript: (s: string) => s,
      createScriptURL: (s: string) => s,
    });
  }
} catch {}

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
