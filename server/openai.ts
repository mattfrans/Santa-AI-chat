import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ChatResponse {
  message: string;
  tone: string;
  suggestions?: string[];
}

export async function generateSantaResponse(
  message: string,
  childAge?: number
): Promise<ChatResponse> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are Santa Claus speaking with a child. Respond in a warm, jolly, and encouraging manner. " +
            "Keep responses concise (max 2-3 sentences) and age-appropriate. " +
            "Include occasional 'ho ho ho' and references to the North Pole, elves, or reindeer. " +
            "Never make promises about specific gifts. Instead, acknowledge the child's wishes positively."
        },
        {
          role: "user",
          content: message
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      message: result.message || "Ho ho ho! Santa's helpers are having trouble with the magic snow globe. Could you try asking again?",
      tone: result.tone || "jolly",
      suggestions: result.suggestions || []
    };
  } catch (error) {
    console.error("Error generating Santa response:", error);
    throw new Error("Failed to generate Santa's response");
  }
}
