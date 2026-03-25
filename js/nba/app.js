/**
 * Main NBA application entry point.
 */
import UI from './ui.js';

let isInitialized = false;

/**
 * Initialize NBA mode.
 */
export function initNbaApp() {
    if (isInitialized) {
        return;
    }

    isInitialized = true;

    UI.init();

    window.addEventListener('unhandledrejection', (event) => {
        if (event.reason && typeof event.reason === 'object' && event.reason.name === 'APIError') {
            UI.showError(`API Error: ${event.reason.message}`);
        }
    });

    console.log('NBA Great Games application initialized');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initNbaApp();
    });
} else {
    initNbaApp();
}
