import React, { useState, useRef } from "react";
import ReCAPTCHA from "react-google-recaptcha";

function App() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const recaptchaRef = useRef();
  const BACKEND_URL = "https://sdcl-backend.onrender.com";
  const SITE_KEY = "6Ldn_H4rAAAAAMTuKBGKbUyOfq9EOBdLWMqJ4gh4"; // 🔁 Replace with your real site key

  // Detect clientId
  let clientId;
  const urlParams = new URLSearchParams(window.location.search);
  clientId = urlParams.get("client");
  if (!clientId) {
    const pathMatch = window.location.pathname.match(/^\/([^\/?#]+)/);
    clientId = pathMatch ? pathMatch[1] : "maximos";
  }

  const clientConfig = {
    maximos: { label: "St. Maximos" },
    ordinance: { label: "Brandon Ordinance" },
    marketingasst: { label: "Parish Marketing Assistant" },
    samuel: { label: "Samuel Kelly" },
  };

  if (!clientConfig[clientId]) clientId = "maximos";
  const clientLabel = clientConfig[clientId].label;
  const chatId = "demo-session-1";

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

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
      const recaptchaToken = await recaptchaRef.current.executeAsync();
      recaptchaRef.current.reset();

      const res = await fetch(`${BACKEND_URL}/proxy-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          client_id: clientId,
          question,
          recaptcha_token: recaptchaToken,
        }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.statusText}`);

      const data = await res.json();
      setResponse(data.answer);
      setSources(data.source_documents || []);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Error connecting to server.");
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

      {/* Invisible reCAPTCHA */}
      <ReCAPTCHA ref={recaptchaRef} size="invisible" sitekey={SITE_KEY} />

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
