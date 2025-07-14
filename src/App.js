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

  // Detect clientId from the URL
  let clientId;
  const urlParams = new URLSearchParams(window.location.search);
  clientId = urlParams.get("client");
  if (!clientId) {
    const pathMatch = window.location.pathname.match(/^\/([^\/?#]+)/);
    clientId = pathMatch ? pathMatch[1] : "maximos"; // Default to 'maximos' if no match
  }

  // Client-specific configurations
  const clientConfig = {
    maximos: {
      label: "St. Maximos",
      backgroundColor: "#dfe6e9",
      fontFamily: "'Poppins', sans-serif",
      logo: "/images/maximos-logo.png",
      placeholder: "Ask a question to St. Maximos...",
    },
    ordinance: {
      label: "Brandon Ordinance",
      backgroundColor: "#ffeaa7",
      fontFamily: "'Roboto', sans-serif",
      logo: "/images/ordinance-logo.png",
      placeholder: "Ask about Brandon Ordinance...",
    },
    marketingasst: {
      label: "Parish Marketing Assistant",
      backgroundColor: "#f9ca24",
      fontFamily: "'Lato', sans-serif",
      logo: "/images/marketingasst-logo.png",
      placeholder: "How can we help you today?",
    },
    samuel: {
      label: "Samuel Kelly",
      backgroundColor: "#a29bfe",
      fontFamily: "'Montserrat', sans-serif",
      logo: "/images/samuel-logo.png",
      placeholder: "Ask Samuel Kelly anything...",
    },
  };

  const client = clientConfig[clientId] || clientConfig.maximos; // Default to 'maximos' if no match

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
      // Get new token for each request
      const recaptchaToken = await recaptchaRef.current.executeAsync();
      console.log("🔐 reCAPTCHA token:", recaptchaToken);

      // Immediately reset for the next attempt
      recaptchaRef.current.reset();

      // Now send to backend right away
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
      console.error("❌ Fetch error:", err);
      setError("Error connecting to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: "2rem",
        fontFamily: client.fontFamily,
        backgroundColor: client.backgroundColor,
        maxWidth: 700,
        margin: "auto",
      }}
    >
      <h2>Ask {client.label}</h2>
      
      {/* Display custom logo */}
      <img
        src={client.logo}
        alt={`${client.label} Logo`}
        style={{
          width: "150px",
          marginBottom: "1rem",
          display: "block",
          margin: "auto",
        }}
      />

      {/* Display response above input */}
      {!!response && (
        <div
          style={{
            marginBottom: "2rem",
            whiteSpace: "pre-wrap",
            padding: "1rem",
            backgroundColor: "#f4f4f9",
            borderRadius: "8px",
            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
          }}
        >
          <strong>Response:</strong>
          <p>{response}</p>
        </div>
      )}

      {/* Input area */}
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={4}
        cols={60}
        placeholder={client.placeholder} // Dynamic placeholder per client
        style={{
          width: "100%",
          fontSize: "1rem",
          padding: "0.5rem",
          fontFamily: client.fontFamily, // Apply client-specific font
        }}
        disabled={loading}
      />
      <br />
      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          marginTop: "1rem",
          padding: "0.8rem 1.5rem",
          fontSize: "1rem",
          backgroundColor: "#007BFF",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: loading ? "not-allowed" : "pointer",
          boxShadow: loading ? "none" : "0 2px 8px rgba(0, 0, 0, 0.1)",
          transition: "all 0.3s ease",
        }}
      >
        {loading ? "Thinking..." : "Send"}
      </button>

      {/* Invisible reCAPTCHA */}
      <ReCAPTCHA
        ref={recaptchaRef}
        size="invisible"
        sitekey={SITE_KEY}
        badge="bottomright"
      />

      {/* Display error if any */}
      {error && (
        <p style={{ color: "red", marginTop: "1rem" }}>
          <strong>{error}</strong>
        </p>
      )}

      {/* Display source documents */}
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
