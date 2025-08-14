interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface StreamChatCompletionParams {
    messages: Message[];
    apiKey: string;
    baseUrl: string;
    modelName: string;
    onUpdate: (chunk: string) => void;
    onFinish: () => void;
    onError: (error: Error) => void;
}

export const streamChatCompletion = async ({
    messages,
    apiKey,
    baseUrl,
    modelName,
    onUpdate,
    onFinish,
    onError,
}: StreamChatCompletionParams) => {
    try {
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: modelName,
                messages,
                stream: true,
            }),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorBody)}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Failed to get response reader');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6);
                    if (jsonStr === '[DONE]') {
                        break;
                    }
                    try {
                        const chunk = JSON.parse(jsonStr);
                        const content = chunk.choices[0]?.delta?.content || '';
                        if (content) {
                            onUpdate(content);
                        }
                    } catch (e) {
                        console.error('Failed to parse stream chunk:', e);
                    }
                }
            }
        }
    } catch (error) {
        if (error instanceof Error) {
            onError(error);
        } else {
            onError(new Error('An unknown error occurred'));
        }
    } finally {
        onFinish();
    }
};
