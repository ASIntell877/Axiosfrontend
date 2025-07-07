import React, { useState } from "react";

function App() {
  // State hooks for user question, response, sources, loading & error
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get client ID from URL param (default to 'maximos')
  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get("client") || "maximos";
  const chatId = "demo-session-1"; // Could randomize or persist later

  // Client labels to display user-friendly names
  const clientConfig = {
    maximos: { label: "St. Maximos" },
    ordinance: { label: "Brandon Ordinance" },
  };
  const clientLabel = clientConfig[clientId]?.label || "Your Assistant";

  // Add this handler for key presses inside the textarea:
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // Prevents newline on Enter without Shift
      handleSubmit();
    }
  };

  // Handle submit - send question to backend API
  const handleSubmit = async () => {
    setError(null);
    if (!question.trim()) {
      setError("Please enter a question.");
      return;
    }
    setLoading(true);
    setResponse("");
    setSources([]);
    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          client_id: clientId,
          question,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.statusText}`);
      }

      const data = await res.json();
      setResponse(data.answer);
      setSources(data.source_documents || []);
    } catch (err) {
      setError("Error connecting to server.");
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif", maxWidth: 700, margin: "auto" }}>
      <h2>Ask {clientLabel}</h2>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}  // <<< HERE
        rows={4}
        cols={60}
        placeholder={`Ask your question to ${clientLabel}...`}
        style={{ width: "100%", fontSize: "1rem", padding: "0.5rem" }}
        disabled={loading}
      />
      <br />
      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          marginTop: "1rem",
          padding: "0.5rem 1rem",
          fontSize: "1rem",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Thinking..." : "Send"}
      </button>

      {error && (
        <p style={{ color: "red", marginTop: "1rem" }}>
          <strong>{error}</strong>
        </p>
      )}

      {!!response && (
        <div style={{ marginTop: "2rem", whiteSpace: "pre-wrap" }}>
          <strong>Response:</strong>
          <p>{response}</p>
        </div>
      )}

      {sources.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <strong>Sources:</strong>
          <ul>
            {sources.map((doc, index) => (
              <li key={index} style={{ marginBottom: "0.5rem" }}>
                <em>{doc.source}</em>: {doc.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
