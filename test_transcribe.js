import Groq from 'groq-sdk';
import { createReadStream, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
async function test() {
    console.log("Testing transcription...");
    try {
        writeFileSync('test.txt', 'dummy'); 
    } catch(e){}
}
test();
