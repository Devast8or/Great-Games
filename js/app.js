/**
 * Main application entry point
 */
import UI from './ui.js';
import { API } from './api.js';
import { Parser } from './parser.js';
import { Ranker } from './ranker.js';

// Initialize modules when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI
    UI.init();
    
    // Initialize API error handling
    window.addEventListener('unhandledrejection', event => {
        if (event.reason instanceof API.APIError) {
            UI.showError(`API Error: ${event.reason.message}`);
        }
    });
    
    console.log('MLB Great Games application initialized');
});