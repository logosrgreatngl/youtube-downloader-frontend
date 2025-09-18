// config.js - Smart configuration with auto-detection
(function() {
    const hostname = window.location.hostname;
    let apiUrl = 'http://localhost:5000'; // Default for local development
    
    // TODO: UPDATE THESE WITH YOUR ACTUAL URLS AFTER DEPLOYING
    const productionDomains = {
        'your-app-name.netlify.app': 'https://your-replit-name.repl.co',
        // Example: 'awesome-youtube-dl.netlify.app': 'https://youtube-backend-johndoe.repl.co',
    };
    
    // Check if we're on a production domain
    if (productionDomains[hostname]) {
        apiUrl = productionDomains[hostname];
    } else if (hostname.includes('netlify.app') || hostname.includes('netlify.live')) {
        // Fallback for any Netlify deploy
        apiUrl = 'https://your-replit-name.repl.co'; // TODO: UPDATE THIS
    }
    
    window.CONFIG = {
        API_URL: apiUrl,
        IS_PRODUCTION: hostname !== 'localhost' && hostname !== '127.0.0.1',
        VERSION: '1.0.0',
        DEBUG: hostname === 'localhost' || hostname === '127.0.0.1'
    };
    
    if (window.CONFIG.DEBUG) {
        console.log('🚀 App Configuration:', window.CONFIG);
        console.log('📍 Current hostname:', hostname);
        console.log('🔗 API URL:', window.CONFIG.API_URL);
    }
})();