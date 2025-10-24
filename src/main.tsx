// Trusted Types (no-op in unsupported browsers)
try {
  // @ts-expect-error - trustedTypes is not available in all browsers
  if (window.trustedTypes && !window.trustedTypes.getPolicy('default')) {
    // @ts-expect-error - trustedTypes API is browser-specific
    window.trustedTypes.createPolicy('default', {
      createHTML: (s: string) => s,
      createScript: (s: string) => s,
      createScriptURL: (s: string) => s,
    });
  }
} catch (error) {
  // Trusted Types not supported in this browser, silently ignore
}

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './styles/global.css'

// Initialisation automatique du système Algolia optimisé
import './lib/algolia/autoInit.ts'

// Suppression temporaire des erreurs répétitives en développement
import { initErrorSuppression } from './lib/errorSupression'
initErrorSuppression()

createRoot(document.getElementById("root")!).render(<App />);
