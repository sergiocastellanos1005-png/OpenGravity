import { chatCompletion } from './src/agent/llm.js';
import { executeTool } from './src/tools/index.js';

async function test() {
    try {
        const response = await chatCompletion([{ role: 'user', content: 'Cual fue el resultado de Barcelona' }]);
        console.log(response);
    } catch (e) {
        console.error(e);
    }
}
test();
