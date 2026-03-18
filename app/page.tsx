"use client";

import { useState } from "react";

type Msg = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [history, setHistory] = useState<Msg[]>([]);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
    if (loading) return;
    if (!message.trim() && files.length === 0) return;

    const displayUserText = [
      message.trim() || "[仅上传文件]",
      ...files.map((f) => `📎 ${f.name}`),
    ].join("\n");

    const historyForApi = history.slice(-10);

    setHistory((prev) => [
      ...prev,
      { role: "user", content: displayUserText },
      { role: "assistant", content: "正在思考..." },
    ]);

    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("message", message);
      fd.append("history", JSON.stringify(historyForApi));

      for (const file of files) {
        fd.append("files", file);
      }

      const resp = await fetch("/api/chat", {
        method: "POST",
        body: fd,
      });

      if (!resp.ok || !resp.body) {
        const text = await resp.text();
        setHistory((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: text || "请求失败",
          };
          return next;
        });
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        full += decoder.decode(value, { stream: true });

        setHistory((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: full,
          };
          return next;
        });
      }

      setMessage("");
      setFiles([]);
    } catch (err: any) {
      setHistory((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: err?.message || "请求异常",
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1>聊天 Demo</h1>

      <div
        style={{
          minHeight: 420,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          background: "#fff",
        }}
      >
        {history.length === 0 ? (
          <div style={{ color: "#666" }}>开始聊天吧</div>
        ) : (
          history.map((msg, i) => (
            <div
              key={i}
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 10,
                whiteSpace: "pre-wrap",
                background: msg.role === "user" ? "#e8f3ff" : "#f4f4f4",
              }}
            >
              <strong>{msg.role === "user" ? "你" : "AI"}：</strong>
              <div>{msg.content}</div>
            </div>
          ))
        )}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="输入消息"
        style={{
          width: "100%",
          height: 120,
          padding: 12,
          marginBottom: 12,
          boxSizing: "border-box",
        }}
      />

      <input
        type="file"
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files || []))}
        style={{ marginBottom: 12 }}
      />

      <div style={{ marginBottom: 12, color: "#666" }}>
        {files.length > 0 ? `已选择：${files.map((f) => f.name).join(", ")}` : ""}
      </div>

      <button
        onClick={sendMessage}
        disabled={loading}
        style={{
          padding: "10px 18px",
          borderRadius: 8,
          border: "1px solid #ccc",
          cursor: "pointer",
        }}
      >
        {loading ? "发送中..." : "发送"}
      </button>
    </main>
  );
}