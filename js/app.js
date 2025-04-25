/**
 * Main application entry point
 */
import UI from './ui.js';
import { API, APIError } from './api.js';
import { Parser } from './parser.js';
import { Ranker } from './ranker.js';

// Initialize modules when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI
    UI.init();
    
    // Initialize API error handling
    window.addEventListener('unhandledrejection', event => {
        if (event.reason && typeof event.reason === 'object' && event.reason.name === 'APIError') {
            UI.showError(`API Error: ${event.reason.message}`);
        }
    });
    
    console.log('MLB Great Games application initialized');
});