import React, { useState, useRef, useEffect } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import ReactMarkdown from "react-markdown"

// Fallback UUID generator for environments without crypto.randomUUID
function generateUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const randomPart = Math.random().toString(16).slice(2);
  const timePart = Date.now().toString(16);
  return randomPart + timePart;
}

function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // toggle to true if you ever want sources back
  const showSources = false;

  const { executeRecaptcha } = useGoogleReCaptcha();
  const BACKEND_URL = "https://sdcl-backend.onrender.com";

  // generate chatid - load stable session ID only once
  const [chatId] = useState(() => {
    const existing = localStorage.getItem("chatId");
    if (existing) return existing;
    const id = generateUUID();
    localStorage.setItem("chatId", id);
    return id;
  });

  // Detect clientId from the URL
  let clientId;
  const urlParams = new URLSearchParams(window.location.search);
  clientId = urlParams.get("client");
  if (!clientId) {
    const pathMatch = window.location.pathname.match(/^\/([^\/?#]+)/);
    clientId = pathMatch ? pathMatch[1] : "prairiepastorate";
  }

  // Client configs...
  const clientConfig = {
    maximos: {
      label: "St. Maximos the Confessor",
      backgroundImage: "url('/maximos2.jpg')",
      fontFamily: "'Lato', sans-serif",
      placeholder: "Seek counsel from St. Maximos...",
      backgroundOpacity: 3,
    },
    ordinance: {
      label: "Anytown USA Ordinance",
      backgroundImage: "url('/midwestsummer.jpg')",
      fontFamily: "'Montserrat', sans-serif",
      placeholder: "Ask about Anytown USA Ordinance...",
      backgroundOpacity: 3,
    },
    marketingasst: {
      label: "Parish Marketing Assistant",
      backgroundColor: "#f9ca24",
      fontFamily: "'Lato', sans-serif",
      placeholder: "How can we help you today?",
      backgroundOpacity: 1,
    },
    samuel: {
      label: "Samuel Kelly - A Real 18th Century Sailor",
      backgroundImage: "url('/samuel2.jpg')",
      fontFamily: "'Montserrat', sans-serif",
      placeholder: "Ask Samuel Kelly anything...",
      backgroundOpacity: 1,
    },
    prairiepastorate: {
      label: "Prairie Catholic Pastorate Assistant",
      backgroundImage: "url('/church.jpg')",
      fontFamily: "'Lato', sans-serif",
      placeholder: "How can I help you?",
      backgroundOpacity: 1,
    },
  };
  const client = clientConfig[clientId] || clientConfig.prairiepastorate;

   // === NEW: Hydrate history from backend on load ===
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(
          `${BACKEND_URL}/history?client_id=${clientId}&chat_id=${chatId}`
        );
        if (res.ok) {
          const { history } = await res.json();
          // history is an array of { role: "user"|"assistant", text: "…" }
          setMessages(history.map(m => ({
            sender: m.role === "assistant" ? "bot" : "user",
            text: m.text
          })));
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    }
    loadHistory();
  }, [clientId, chatId]);

  // **NEW**: ref to the scrollable container
  const messagesContainerRef = useRef(null);

  // Scroll *that* container to bottom on every messages change
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

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
    if (showSources) setSources([]);
    setMessages((ms) => [...ms, { sender: "user", text: question }]);
    setQuestion("");

    try {
      let token = "";
      if (executeRecaptcha) {
        token = await executeRecaptcha("chat");
      }

      const res = await fetch(`${BACKEND_URL}/proxy-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          client_id: clientId,
          question,
          recaptcha_token: token,
        }),
      });
      if (!res.ok) throw new Error(res.statusText);

      const data = await res.json();
      setMessages((ms) => [...ms, { sender: "bot", text: data.answer }]);
      if (showSources) setSources(data.source_documents || []);
    } catch (err) {
      console.error(err);
      setError("Error connecting to server.");
    } finally {
      setLoading(false);
    }
  };

  const containerStyle = {
    display: "flex",
    flexDirection: "column",
    height: "80vh",
    padding: "2rem",
    fontFamily: client.fontFamily,
    maxWidth: 700,
    margin: "auto",
    opacity: client.backgroundOpacity,
    ...(client.backgroundImage
      ? {
          backgroundImage: client.backgroundImage,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }
      : client.backgroundColor && { backgroundColor: client.backgroundColor }),
  };

  return (
    <div style={containerStyle}>
      <h2>{client.label}</h2>

      {/* Conversation (scrollable) */}
      
      <div ref={messagesContainerRef} style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem",
          backgroundColor: "rgba(244, 244, 249, 0.8)",
          borderRadius: "8px",
          marginBottom: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {messages.map((msg, i) => (
          <div
             key={i}
            style={{
              display: "flex",
              justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div style={{
              maxWidth: "80%",
              padding: "0.5rem 1rem",
              borderRadius: "20px",
              backgroundColor: msg.sender === "user" ? "#007BFF" : "#ffffff",
              color: msg.sender === "user" ? "#ffffff" : "#000000",
            }}>
              {msg.sender === "bot" && clientId === "prairiepastorate" ? (
                <ReactMarkdown
                  components={{
                    a: ({node, ...props}) => (
                      <a
                        {...props}
                        target="_blank"
                        rel="noopener noreferrer"  // prevents tab‑napping
                      />
                    )
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              ) : (
                <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
              )}
            </div>
          </div>
        ))}

        {loading && <div style={{ fontStyle: "italic" }}>Thinking...</div>}
      </div>

      {/* Input */}
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
            backgroundColor: "rgba(255,255,255,0.8)",
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
          {/* svg arrow */}
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

      {/* Error */}
      {error && (
        <p style={{ color: "red", marginTop: "1rem" }}>
          <strong>{error}</strong>
        </p>
      )}

      {/* Sources */}
      {showSources && sources.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <strong>Sources:</strong>
          <ul>
            {sources.map((doc, i) => (
              <li key={i} style={{ marginBottom: "0.5rem" }}>
                <em>{doc.source}</em>: {doc.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      <footer
        style={{
          marginTop: "2rem",
          fontSize: "0.8rem",
          textAlign: "center",
          opacity: 0.8,
        }}
      >
        © 2025 Axiostrat Intelligence LLC. All rights reserved.<br></br>
        This site is protected by reCAPTCHA and the Google{" "}
        <a href="https://policies.google.com/privacy">Privacy Policy</a>{" "}and{" "}
        <a href="https://policies.google.com/terms">Terms of Service</a> apply.
      </footer>
    </div>
  );
}

export default App;
