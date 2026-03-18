import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: any;
};

function isTextLikeFile(file: File) {
  const name = file.name.toLowerCase();
  return [
    ".txt",
    ".md",
    ".csv",
    ".json",
    ".js",
    ".ts",
    ".py",
    ".java",
    ".c",
    ".cpp",
    ".html",
    ".css",
  ].some((ext) => name.endsWith(ext));
}

async function fileToDataUrl(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const message = String(form.get("message") || "").trim();
    const historyRaw = String(form.get("history") || "[]");
    const files = form
      .getAll("files")
      .filter((item): item is File => item instanceof File);

    let history: ChatMessage[] = [];
    try {
      history = JSON.parse(historyRaw);
      if (!Array.isArray(history)) history = [];
    } catch {
      history = [];
    }

    const userContent: any[] = [
      {
        type: "text",
        text: message || "请分析我上传的内容，并用中文回答。",
      },
    ];

    for (const file of files) {
      if (file.type.startsWith("image/")) {
        const dataUrl = await fileToDataUrl(file);
        userContent.push({
          type: "image_url",
          image_url: { url: dataUrl },
        });
        userContent[0].text += `\n\n[已上传图片] ${file.name}`;
      } else if (isTextLikeFile(file)) {
        const text = await file.text();
        userContent[0].text += `\n\n[文件: ${file.name}]\n${text.slice(0, 20000)}`;
      } else {
        userContent[0].text += `\n\n[文件: ${file.name}] 当前版本暂未自动解析该类型，请结合文件名和上下文回答。`;
      }
    }

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: "你是一个有帮助的中文助手。回答清晰、直接、结构化。",
      },
      ...history,
      {
        role: "user",
        content: userContent,
      },
    ];

    const upstream = await fetch(
      `${process.env.BLUESHIFT_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.BLUESHIFT_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.BLUESHIFT_MODEL,
          stream: true,
          messages,
          temperature: 0.7,
        }),
      }
    );

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text();
      return new Response(errText || "上游接口调用失败", { status: 500 });
    }

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line.startsWith("data:")) continue;

              const data = line.slice(5).trim();
              if (!data || data === "[DONE]") continue;

              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content ?? "";
                if (delta) {
                  controller.enqueue(encoder.encode(delta));
                }
              } catch {}
            }
          }

          controller.close();
        } catch (err) {
          controller.error(err);
        } finally {
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: any) {
    return new Response(err?.message || "服务端异常", { status: 500 });
  }
}
