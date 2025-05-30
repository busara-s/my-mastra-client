import { MastraClient } from "@mastra/client-js";

const client = new MastraClient({
    baseUrl: "http://localhost:4111",
    retries: 3,
    backoffMs: 300,
    maxBackoffMs: 5000,
    headers: {
        "X-Development": "true",
    },

});

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();

        console.log('Received messages:', messages);

        const agent = client.getAgent("weatherAgent");
        const response = await agent.generate({
            messages: [{ role: "user", content: messages[0].content }],
        });
        
        
        return new Response(JSON.stringify({ 
            role: 'assistant',
            content: response.text 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in API route:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}