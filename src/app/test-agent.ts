'use client';

import { config } from "dotenv";
config({ path: ".env.development" });

import { MastraClient } from "@mastra/client-js";

const client = new MastraClient({
    // Required
    baseUrl: "http://localhost:4111",

    // Optional configurations for development
    retries: 3, // Number of retry attempts
    backoffMs: 300, // Initial retry backoff time
    maxBackoffMs: 5000, // Maximum retry backoff time
    headers: {
        // Custom headers for development
        "X-Development": "true",
    },
});

async function main() {
    try {
        const agent = client.getAgent("weatherAgent");
        const response = await agent.generate({
            messages: [{ role: "user", content: "What is the weather in London?" }],
        });
        console.log("Response:", response.text);
    } catch (error) {
        console.error("Development error:", error);
    }
}

main();