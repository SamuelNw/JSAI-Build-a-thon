import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { createSseStream } from "@azure/core-sse";

const token = process.env["GITHUB_TOKEN"];
const endpoint = "https://models.github.ai/inference";
const modelName = "meta/Llama-3.2-11B-Vision-Instruct";

export async function main() {
    const client = ModelClient(endpoint, new AzureKeyCredential(token));

    const response = await client
        .path("/chat/completions")
        .post({
            body: {
                messages: [
                    { role: "system", content: "You are a helpful assistant." },
                    {
                        role: "user",
                        content:
                            "Give me 5 good reasons why I should exercise every day.",
                    },
                ],
                model: modelName,
                stream: true,
                model_extras: { stream_options: { include_usage: true } },
            },
        })
        .asNodeStream();

    if (!response.body) {
        throw new Error("The response is undefined");
    }

    const sseStream = createSseStream(response.body);

    var usage = null;
    for await (const event of sseStream) {
        if (event.data === "[DONE]") {
            break;
        }
        var parsedData = JSON.parse(event.data);
        for (const choice of parsedData.choices) {
            process.stdout.write(choice.delta?.content ?? ``);
        }
        if (parsedData.usage) {
            usage = parsedData.usage;
        }
    }
    if (usage) {
        process.stdout.write("\n");
        for (var k in usage) {
            process.stdout.write(`${k} = ${usage[k]}\n`);
        }
    }
}

main().catch((err) => {
    console.error("The sample encountered an error:", err);
});
