import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { createSseStream } from "@azure/core-sse";
import fs from "fs";
import path from "path";

const token = process.env["GITHUB_TOKEN"];
const endpoint = "https://models.inference.ai.azure.com";
const modelName = "Llama-4-Maverick-17B-128E-Instruct-FP8";

export async function main() {
    // Read the image file and encode as base64
    const imagePath = path.join(process.cwd(), "contoso_layout_sketch.jpg");
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    const client = ModelClient(endpoint, new AzureKeyCredential(token));

    const response = await client
        .path("/chat/completions")
        .post({
            body: {
                messages: [
                    {
                        role: "system",
                        content:
                            "You are a frontend developer who likes clean, semantic HTML and CSS.",
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Write HTML and CSS code for a web page based on the following handdrawn sketch",
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`,
                                },
                            },
                        ],
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
    let usage = null;
    let htmlOutput = "";
    for await (const event of sseStream) {
        if (event.data === "[DONE]") {
            break;
        }
        const parsedData = JSON.parse(event.data);
        if (parsedData.choices) {
            for (const choice of parsedData.choices) {
                const content = choice.delta?.content ?? "";
                process.stdout.write(content);
                htmlOutput += content;
            }
        }
        if (parsedData.usage) {
            usage = parsedData.usage;
        }
    }
    if (usage) {
        process.stdout.write("\n");
        for (const k in usage) {
            process.stdout.write(`${k} = ${usage[k]}\n`);
        }
    }
    // Optionally, print the HTML code block only
    const htmlMatch = htmlOutput.match(/```html([\s\S]*?)```/);
    if (htmlMatch) {
        console.log("\nExtracted HTML code:\n" + htmlMatch[1].trim());
    }
}

main().catch((err) => {
    console.error("The sample encountered an error:", err);
});
