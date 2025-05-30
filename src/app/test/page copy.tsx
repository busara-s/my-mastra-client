'use client';

import React from "react";
import { MastraClient } from "@mastra/client-js";
import { useState } from "react";
import { Send } from "lucide-react";


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


export default function Home() {
    const [userInput, setUserInput] = useState("");
    const [response, setResponse] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const agent = client.getAgent("weatherAgent");
            const result = await agent.generate({
                messages: [{ role: "user", content: userInput }],
            });
            setResponse(result.text);
            setUserInput(""); // Clear input after successful response

        } catch (error) {
            console.error("Error:", error);
            if (error instanceof Error) {
                if ('message' in error && error.message.includes('Failed to fetch')) {
                    setError('Cannot connect to the AI service. Please check if the server is running at http://localhost:4111');
                } else {
                    setError(error.message);
                }
            } else {
                setError('An unexpected error occurred');
            }
        } finally {
            setLoading(false);
        }
    };
    return (
        <div className="container mx-auto p-4 max-w-3xl">
            <h1 className="text-2xl font-bold mb-6">AI Chat Interface</h1>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                    {error}
                </div>
            )}

            {/* Response Display */}
            <div className="mb-4">
                <textarea
                    className="w-full h-48 p-4 border rounded-lg bg-gray-50"
                    value={response}
                    readOnly
                    placeholder="AI response will appear here..."
                />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    className="flex-1 p-2 border rounded-lg"
                    placeholder="Type your message here..."
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 flex items-center gap-2"
                >
                    {loading ? "Sending..." : <Send size={20} />}
                </button>
            </form>
        </div>
    );
}
