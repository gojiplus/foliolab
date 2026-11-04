import { afterEach, expect, it, vi } from "vitest";
import { generateWithOpenAI } from "../server/lib/openai.js";

afterEach(() => vi.unstubAllGlobals());

it("sends the summary request through the real SDK and parses its response", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [{ finish_reason: "stop", message: { content: '{"summary":" A project. "}' } }],
      }),
      { headers: { "content-type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetch);

  await expect(
    generateWithOpenAI("Summarize", "Project contents", "test-key", {
      model: "test-model",
      baseURL: "https://example.test/v1",
    }),
  ).resolves.toEqual({ summary: "A project." });

  expect(fetch).toHaveBeenCalledOnce();
  const [url, init] = fetch.mock.calls[0];
  expect(String(url)).toBe("https://example.test/v1/chat/completions");
  expect(JSON.parse(String(init?.body))).toMatchObject({
    model: "test-model",
    messages: [
      { role: "system", content: "Summarize" },
      { role: "user", content: "Project contents" },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: 800,
  });
});

it("rejects a truncated response returned through the real SDK", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ finish_reason: "length", message: { content: '{"summary":"partial"}' } }],
        }),
        { headers: { "content-type": "application/json" } },
      ),
    ),
  );
  await expect(
    generateWithOpenAI("Summarize", "Project contents", "test-key", {
      model: "test-model",
      baseURL: "https://example.test/v1",
    }),
  ).rejects.toThrow("Summary response was incomplete or refused");
});
