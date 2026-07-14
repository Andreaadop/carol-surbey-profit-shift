import Anthropic from "@anthropic-ai/sdk";

export const REPORT_MODEL = "claude-sonnet-5";
export const FOLLOWUP_MODEL = "claude-haiku-4-5";

let client = null;
function getClient() {
  if (!client) client = new Anthropic(); // reads ANTHROPIC_API_KEY
  return client;
}

export function firstText(msg) {
  if (msg.stop_reason === "refusal") throw new Error("model_refusal");
  if (msg.stop_reason === "max_tokens") throw new Error("output_truncated");
  const block = msg.content.find((b) => b.type === "text");
  if (!block) throw new Error("no_text_block");
  return block.text;
}

// One structured-output call. Sonnet 5 runs adaptive thinking when `thinking`
// is omitted — disabled explicitly for cost predictability on this short task.
export async function generateStructured({ system, user, schema, maxTokens }) {
  const msg = await getClient().messages.create({
    model: REPORT_MODEL,
    max_tokens: maxTokens,
    thinking: { type: "disabled" },
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: { type: "json_schema", schema } },
  });
  return JSON.parse(firstText(msg));
}

export async function answerFollowup({ system, question }) {
  const msg = await getClient().messages.create({
    model: FOLLOWUP_MODEL,
    max_tokens: 600,
    system,
    messages: [{ role: "user", content: question }],
  });
  return firstText(msg);
}
