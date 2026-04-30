import axios from 'axios';
import * as cheerio from 'cheerio';

export const financeTools = [
    {
        type: 'function',
        function: {
            name: 'get_financial_data',
            description: 'Obtiene precios en tiempo real de criptomonedas (Bitcoin, Ethereum, etc.) y acciones del mercado financiero (Tesla, Apple, Google, divisas).',
            parameters: {
                type: 'object',
                properties: {
                    symbol: { 
                        type: 'string', 
                        description: 'El nombre o símbolo del activo (ej: bitcoin, ethereum, TSLA, AAPL, USD/COP, Euro).' 
                    }
                },
                required: ['symbol']
            }
        }
    }
];

export async function handleFinancialData(symbol: string): Promise<string> {
    const cleanSymbol = symbol.toLowerCase().trim();
    console.log(`Obteniendo datos financieros para: ${cleanSymbol}`);

    try {
        // --- Caso 1: Criptomonedas (CoinGecko) ---
        const cryptoKeywords = ['bitcoin', 'ethereum', 'solana', 'cardano', 'bnb', 'dogecoin', 'ripple', 'xrp', 'crypto'];
        if (cryptoKeywords.some(k => cleanSymbol.includes(k))) {
            const coinId = cleanSymbol === 'xrp' ? 'ripple' : cleanSymbol;
            const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd,eur,cop&include_24hr_change=true`);
            
            if (res.data[coinId]) {
                const p = res.data[coinId];
                return `💰 [${symbol.toUpperCase()}] Actual:\n- USD: $${p.usd}\n- EUR: €${p.eur}\n- COP: $${p.cop}\n- Cambio 24h: ${p.usd_24h_change?.toFixed(2)}%`;
            }
        }

        // --- Caso 2: Mercado General / Divisas (Google Finance Scrape) ---
        const url = `https://www.google.com/search?q=precio+de+${encodeURIComponent(symbol)}&hl=es`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' }
        });
        
        const $ = cheerio.load(data);
        const price = $('div.BNeawe.iBp4i.AP7Wnd').first().text();
        
        if (price) {
            return `💹 [${symbol.toUpperCase()}]: ${price} (Fuente: Google Finance en tiempo real)`;
        }

        return `No pude encontrar un precio exacto para "${symbol}". Por favor, usa el nombre completo o el símbolo de bolsa.`;
    } catch (error: any) {
        return `Error al obtener datos financieros: ${error.message}`;
    }
}
