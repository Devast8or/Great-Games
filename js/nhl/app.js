/**
 * Main NHL application entry point.
 */
import UI from './ui.js';

let isInitialized = false;

/**
 * Initialize NHL mode.
 */
export function initNhlApp() {
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

    console.log('NHL Great Games application initialized');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initNhlApp();
    });
} else {
    initNhlApp();
}

