import React, { useState, useRef } from "react";
import ReCAPTCHA from "react-google-recaptcha";

function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
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
      backgroundImage: "url('/maximos1.png')",
      fontFamily: "'Poppins', sans-serif",
      placeholder: "Ask a question to St. Maximos...",
    },
    ordinance: {
      label: "Brandon Ordinance",
      backgroundColor: "#003366",
      fontFamily: "'Montserrat', sans-serif",
      placeholder: "Ask about Brandon Ordinance...",
    },
    marketingasst: {
      label: "Parish Marketing Assistant",
      backgroundColor: "#f9ca24",
      fontFamily: "'Lato', sans-serif",
      placeholder: "How can we help you today?",
    },
    samuel: {
      label: "Samuel Kelly",
      backgroundImage: "url('/samuel1.jpg')",
      fontFamily: "'Montserrat', sans-serif",
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
    setSources([]);
    setMessages((msgs) => [...msgs, { sender: "user", text: question }]);
    setQuestion("");

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
      setMessages((msgs) => [...msgs, { sender: "bot", text: data.answer }]);
      setSources(data.source_documents || []);
    } catch (err) {
      console.error("❌ Fetch error:", err);
      setError("Error connecting to server.");
    } finally {
      setLoading(false);
    }
  };
    const containerStyle = {
    padding: "2rem",
    fontFamily: client.fontFamily,
    maxWidth: 700,
    margin: "auto",
  };

  if (client.backgroundImage) {
    containerStyle.backgroundImage = client.backgroundImage;
    containerStyle.backgroundSize = "cover";
  } else if (client.backgroundColor) {
    containerStyle.backgroundColor = client.backgroundColor;
  }
  return (
    <div style={containerStyle}>
      <h2>Ask {client.label}</h2>
      
      {/* Conversation */}
      <div
        style={{
            flex: 1,
            overflowY: "auto",
            padding: "1rem",
            backgroundColor: "#f4f4f9",
            borderRadius: "8px",
            marginBottom: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            flex: 1,
        }}
             >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "0.5rem 1rem",
                borderRadius: "20px",
                backgroundColor:
                  msg.sender === "user" ? "#007BFF" : "#ffffff",
                color: msg.sender === "user" ? "#ffffff" : "#000000",
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ fontStyle: "italic" }}>Thinking...</div>
        )}
      </div>

      {/* Input area */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: "auto",
          gap: "0.5rem",
        }}
      >
       <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder={client.placeholder}
          style={{
            flex: 1,
            resize: "none",
            fontSize: "1rem",
            padding: "0.5rem 1rem",
            fontFamily: client.fontFamily,
            borderRadius: "20px",
          }}
          disabled={loading}
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            backgroundColor: "transparent",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "1.5rem",
            color: "#007BFF",
            padding: 0,
          }}
        >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          height="24"
          width="24"
          fill="currentColor"
        >
          <path d="M476 3.2 12 246c-20.2 10.1-19 39.7 1.9 48.3l111.8 43.9 43.9 111.8c8.6 20.9 38.2 22.1 48.3 1.9L508.8 36c8.4-17.3-9.7-35.4-26.8-32.8z" />
        </svg>
        </button>
      </div>

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
