const axios = require('axios');
axios.get('https://lite.duckduckgo.com/lite/', {
    params: { q: 'dolar hoy' },
    headers: { 'User-Agent': 'Mozilla/5.0' }
}).then(r => console.log(r.data.substring(0, 300))).catch(e => console.error(e.message));
