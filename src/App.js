import React, { useState, useRef, useEffect } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import clientConfig from "./client_config";
import ReactMarkdown from "react-markdown"

const envBackendUrl = process.env.REACT_APP_BACKEND_URL;
// Default to current origin if no environment variable is provided
const BACKEND_URL = envBackendUrl || window.location.origin;
const REACT_API_KEY = process.env.REACT_APP_API_KEY;

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
  const [votes, setVotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [configWarning, setConfigWarning] = useState(null)


  useEffect(() => {
    if (!envBackendUrl) {
      setConfigWarning(
        "REACT_APP_BACKEND_URL is not set. Using current origin."
      );
    }
  }, []);


  const { executeRecaptcha } = useGoogleReCaptcha();

  // generate chatid - load stable session ID - clear chat on tab close
  const [chatId, setChatId] = useState(() => {
  const existing = sessionStorage.getItem("chatId");
  if (existing) return existing;
  const id = generateUUID();
  sessionStorage.setItem("chatId", id);
  return id;
});

  // Persistent user identifier stored in localStorage
  const [userId] = useState(() => {
    const existing = localStorage.getItem("userId");
    if (existing) return existing;
    const id = generateUUID();
    localStorage.setItem("userId", id);
    return id;
  });

  const clearChat = () => {
    sessionStorage.removeItem("chatId");
    const newId = generateUUID();
    sessionStorage.setItem("chatId", newId);
    setChatId(newId);
    setMessages([]);
    setVotes({});
  }

// Detect clientId from query param, URL path, or subdomain
let clientId;

// 1. Try URL param (?client=samuel)
const urlParams = new URLSearchParams(window.location.search);
clientId = urlParams.get("client");

// 2. Try first path segment (e.g., /samuel)
if (!clientId) {
  const pathMatch = window.location.pathname.match(/^\/([^\/?#]+)/);
  clientId = pathMatch ? pathMatch[1] : null;
}

// 3. Try subdomain (e.g., samuel.axiostratintelligence.com)
if (!clientId) {
  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  if (parts.length > 2) {
    clientId = parts[0].toLowerCase() === "www" ? parts[1] : parts[0];
  }
}

// 4. Fallback default
if (!clientId) {
  clientId = "prairiepastorate";
}
  // Set constant for client configurations as client
  const client = clientConfig[clientId] || clientConfig.prairiepastorate;

  // Show sources for client- get from client_config settings
  const showSources = Boolean(client.showSources);

   // === Hydrate history from backend on load ===
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(
          `${BACKEND_URL}/history?client_id=${clientId}&chat_id=${chatId}`,
          { headers: { 'x-api-key': REACT_API_KEY } }
        );
        if (res.ok) {
          const { history } = await res.json();
          // history is an array of { role: "user"|"assistant", text: "…", message_id: "..." }
          setMessages(
            history.map((m) => ({
              sender: m.role === "assistant" ? "bot" : "user",
              text: m.text,
              message_id: m.message_id,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    }
    loadHistory();
  }, [clientId, chatId]);


  
  // **NEW**: ref to the scrollable container
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Keep focus on the textarea once loading finishes
  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading]);

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
    // Add user's message with placeholder for message_id
    setMessages((ms) => [
      ...ms,
      { sender: "user", text: question, message_id: null },
    ]);
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
          user_id: userId,
        }),
      });
      if (!res.ok) throw new Error(res.statusText);

      const data = await res.json();

      setMessages((ms) => {
        const updated = [...ms];
        const lastIdx = updated.length - 1;
        // Update the last user message with its message_id if provided
        if (
          lastIdx >= 0 &&
          updated[lastIdx].sender === "user" &&
          data.user_message_id
        ) {
          updated[lastIdx] = {
            ...updated[lastIdx],
            message_id: data.user_message_id,
          };
        }
        // Append assistant response with message_id
        updated.push({
          sender: "bot",
          text: data.answer,
          message_id: data.message_id,
        });
        return updated;
      });
      if (showSources) setSources(data.source_documents || []);
    } catch (err) {
      console.error(err);
      setError("Error connecting to server.");
    } finally {
      setLoading(false);
       if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

    const handleVote = (index, value) => {
    setVotes((prev) => ({ ...prev, [index]: value }));
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

  // ──────────────── 1. Helper functions ────────────────
  // Call isImageUrl(msg.text) or isVideoUrl(msg.text) to detect media
  const isImageUrl = (url) =>
    /\.(jpe?g|png|gif|webp)$/i.test(url.trim());

  const isVideoUrl = (url) =>
    /\.(mp4|webm|ogg)$/i.test(url.trim());

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ color: client.labelColor || "inherit" }}>{client.label}</h2>
        <button onClick={clearChat} style={{ background: "none", border: "none", color: "#007BFF", cursor: "pointer" }}>
        Clear Chat
      </button>
      </div>

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
        
        {messages.map((msg, i) => {
          const content = msg.text.trim();
          const isImage = isImageUrl(content);
          const isVideo = isVideoUrl(content);

          return (
            <div
              key={msg.message_id || i}
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
                  backgroundColor: msg.sender === "user" ? "#007BFF" : "#ffffff",
                  color: msg.sender === "user" ? "#ffffff" : "#000000",
                }}
              >
                {msg.sender === "bot" ? (
                  // ───────── Media rendering branch ─────────
                  isImage ? (
                    <img
                      src={content}
                      alt=""
                      style={{ maxWidth: "100%", borderRadius: "8px" }}
                    />
                  ) : isVideo ? (
                    <video
                      controls
                      src={content}
                      style={{
                        width: "100%",
                        maxWidth: "600px",
                        borderRadius: "8px",
                      }}
                    />
                  ) : (
                    <ReactMarkdown
                      components={{
                        a: ({ node, ...props }) => (
                          <a {...props} target="_blank" rel="noopener noreferrer" />
                        ),
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                  )
                ) : (
                  <div style={{ whiteSpace: "pre-wrap" }}>{content}</div>
                )}
                
                {msg.sender === "bot" && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "0.25rem",
                      marginTop: "0.25rem",
                    }}
                  >
                    <button
                      onClick={() => handleVote(i, "up")}
                      disabled={Boolean(votes[i])}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: votes[i] ? "not-allowed" : "pointer",
                        color: votes[i] === "up" ? "#007BFF" : "#888",
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 320 512"
                        height="16"
                        width="16"
                        fill="currentColor"
                      >
                        <path d="M104 0H24C10.7 0 0 10.7 0 24V312c0 13.3 10.7 24 24 24h80c13.3 0 24-10.7 24-24V24c0-13.3-10.7-24-24-24zm216 240c0-17.7-14.3-32-32-32H202.6l9.7-44.3 1-5.2c0-5.9-2.3-11.6-6.6-15.8L186.3 96 96 186.3c-6.3 6.3-9.7 14.4-9.7 23.1V384c0 17.7 14.3 32 32 32h160c13.2 0 24.6-8.1 29.5-20.6l40-104c1-2.6 1.5-5.3 1.5-8.1V240z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleVote(i, "down")}
                      disabled={Boolean(votes[i])}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: votes[i] ? "not-allowed" : "pointer",
                        color: votes[i] === "down" ? "#007BFF" : "#888",
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 320 512"
                        height="16"
                        width="16"
                        fill="currentColor"
                      >
                        <path d="M216 512h80c13.3 0 24-10.7 24-24V200c0-13.3-10.7-24-24-24h-80c-13.3 0-24 10.7-24 24v288c0 13.3 10.7 24 24 24zM16 272c0 17.7 14.3 32 32 32h85.4l-9.7 44.3-1 5.2c0 5.9 2.3 11.6 6.6 15.8l20.4 20.7L224 325.7c6.3-6.3 9.7-14.4 9.7-23.1V128c0-17.7-14.3-32-32-32H41.7C28.5 96 17.1 104.1 12.2 116.6l-40 104c-1 2.6-1.5 5.3-1.5 8.1V272z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
          ref={inputRef}
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

      {/* Configuration warning */}
      {configWarning && (
        <p style={{ color: "orange", marginTop: "1rem" }}>
          <strong>{configWarning}</strong>
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
