import React, { useState } from "react";

function App() {
  // 🔄 State hooks
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 🌐 Determine clientId
  let clientId;

  // 1. Try to get from query string
  const urlParams = new URLSearchParams(window.location.search);
  clientId = urlParams.get("client");

  // 2. If not in query, try to extract from pathname
  if (!clientId) {
    const pathMatch = window.location.pathname.match(/^\/([^\/?#]+)/);
    clientId = pathMatch ? pathMatch[1] : "maximos";
  }

  // 🧠 Optional: Fallback if unknown client
  const clientConfig = {
    maximos: { label: "St. Maximos" },
    ordinance: { label: "Brandon Ordinance" },
    marketingasst: { label: "Parish Marketing Assistant" },
  };

  if (!clientConfig[clientId]) {
    clientId = "maximos";
  }

  const clientLabel = clientConfig[clientId].label;
  const chatId = "demo-session-1";

  // Handler for enter key press
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Backend URL
  const BACKEND_URL = "https://sdcl-backend.onrender.com";

  // Submit handler
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
      const res = await fetch(`${BACKEND_URL}/chat`, {
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

  // Component JSX
  return (
    <div style={{ padding: "2rem", fontFamily: "Arial, sans-serif", maxWidth: 700, margin: "auto" }}>
      <h2>Ask {clientLabel}</h2>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
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
