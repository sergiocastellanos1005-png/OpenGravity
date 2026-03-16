import axios from 'axios';
import * as cheerio from 'cheerio';

async function testYahoo() {
    const query = 'dolar hoy en colombia';
    const url = `https://es.search.yahoo.com/search?p=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });
    const $ = cheerio.load(data);
    const results = [];
    $('.compTitle, .algo-sr').each((i, el) => {
        const title = $(el).find('.title a, h3').text().trim();
        const snippet = $(el).find('.compText, .fz-ms').text().trim();
        if (title) results.push({ title, snippet });
    });
    console.log(results);
}
testYahoo().catch(console.error);
