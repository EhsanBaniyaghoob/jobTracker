"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 12 }}>Something went wrong</h1>
      <p style={{ opacity: 0.8, marginBottom: 12 }}>
        Open DevTools Console to see the error details.
      </p>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          background: "#111",
          color: "#fff",
          padding: 12,
          borderRadius: 8,
          fontSize: 12,
        }}
      >
        {error.message}
      </pre>
      <button
        onClick={() => reset()}
        style={{
          marginTop: 12,
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid #ccc",
          cursor: "pointer",
        }}
      >
        Try again
      </button>
    </div>
  );
}