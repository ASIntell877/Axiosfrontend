import React, { useState, useRef, useEffect } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import clientConfig from "./client_config";
import ReactMarkdown from "react-markdown"
import { ThumbsUp, ThumbsDown } from "lucide-react";

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
  const [votes, setVotes] = useState({}); // keys: message_id -> "up"|"down"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [configWarning, setConfigWarning] = useState(null)
  // which message_id currently has the "why?" input open
  const [reasonOpenFor, setReasonOpenFor] = useState(null);
  // free-text drafts keyed by message_id
  const [reasonDrafts, setReasonDrafts] = useState({});
  const REASONS = [
    "Irrelevant / off-topic",
    "Incorrect / factually wrong",
    "Unclear / hard to understand",
    "Missing sources / citations",
  ];

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
  const showFeedback = client.showFeedback ?? false;

  // === Hydrate history from backend on load (proxy-style) ===
  useEffect(() => {
    async function loadHistory() {
      try {
        const token = executeRecaptcha ? await executeRecaptcha("history") : "";
        const res = await fetch(`${BACKEND_URL}/proxy-history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            chat_id: chatId,
            recaptcha_token: token,
          }),
        });
        if (res.ok) {
          const { history } = await res.json();
          setMessages(
            (history || []).map((m) => ({
              sender: m.role === "assistant" ? "bot" : "user",
              text: m.text,
              message_id: m.message_id,
            }))
          );
        } else {
          console.warn("proxy-history failed:", res.status, await res.text());
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    }
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        const botMessageId = generateUUID();
        updated.push({
          sender: "bot",
          text: data.answer,
          message_id: botMessageId,
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

  async function handleVote(messageId, value, reason) {
    if (!messageId) return;

    // optimistic UI (lock the buttons)
    setVotes(prev => ({ ...prev, [messageId]: value }));

    try {
      const token = executeRecaptcha ? await executeRecaptcha("feedback") : "";
      const res = await fetch(`${BACKEND_URL}/proxy-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          message_id: messageId,
          user_id: userId,
          vote: value,               // "up" | "down"
          reason: reason || null,    // <-- optional
          recaptcha_token: token,
        }),
      });

      if (!res.ok) {
        console.warn("Feedback rejected:", res.status, await res.text());
        setVotes(prev => {
          const copy = { ...prev };
          delete copy[messageId];
          return copy;
        });
      }
    } catch (e) {
      console.error("Feedback error:", e);
      setVotes(prev => {
        const copy = { ...prev };
        delete copy[messageId];
        return copy;
      });
    } finally {
      // close the reason UI & clear draft for this message
      setReasonOpenFor(curr => (curr === messageId ? null : curr));
      setReasonDrafts(prev => {
        const copy = { ...prev };
        delete copy[messageId];
        return copy;
      });
    }
  }

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
                  isImage ? (
                    <img src={content} alt="" style={{ maxWidth: "100%", borderRadius: "8px" }} />
                  ) : isVideo ? (
                    <video controls src={content} style={{ width: "100%", maxWidth: "600px", borderRadius: "8px" }} />
                  ) : (
                    <ReactMarkdown
                      components={{
                        a: ({ node, ...props }) => (
                          <a {...props} target="_blank" rel="noopener noreferrer" />
                        )
                      }}
                    >
                      {content.replace(/^\+\s*/gm, "").trim()}
                    </ReactMarkdown>
                  )
                ) : (
                  <div style={{ whiteSpace: "pre-wrap" }}>{content}</div>
                )}

                {msg.sender === "bot" && showFeedback && msg.message_id && (
                  <div style={{ marginTop: "0.25rem" }}>
                    <small style={{ display: "block", marginBottom: "0.25rem", color: "#555" }}>
                      Did this chat resolve your issue?
                    </small>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "0.25rem",
                      }}
                    >
                      <button
                        onClick={() => handleVote(msg.message_id, "up")}
                        disabled={!msg.message_id || Boolean(votes[msg.message_id])}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: !msg.message_id || votes[msg.message_id] ? "not-allowed" : "pointer",
                          color: votes[msg.message_id] === "up" ? "#007BFF" : "#888",
                        }}
                        aria-label="Mark helpful"
                        title="Resolved my issue"
                      >
                        <ThumbsUp size={20} />
                      </button>

                      <button
                        onClick={() => {
                          if (!msg.message_id || votes[msg.message_id]) return;
                          setReasonOpenFor(prev => (prev === msg.message_id ? null : msg.message_id));
                        }}
                        disabled={!msg.message_id || Boolean(votes[msg.message_id])}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: !msg.message_id || votes[msg.message_id] ? "not-allowed" : "pointer",
                          color: votes[msg.message_id] === "down" ? "#007BFF" : "#888",
                        }}
                        aria-label="Mark unhelpful"
                        title="Didn't resolve"
                      >
                        <ThumbsDown size={20} />
                      </button>
                    </div>

                    {reasonOpenFor === msg.message_id && !votes[msg.message_id] && (
                      <div style={{ marginTop: "0.5rem" }}>
                        <label style={{ display: "block", marginBottom: 6, color: "#555" }}>
                          Why was this unhelpful?
                        </label>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: "0.5rem" }}>
                          {REASONS.map((r) => {
                            const selected = reasonDrafts[msg.message_id] === r;
                            return (
                              <button
                                key={r}
                                onClick={() =>
                                  setReasonDrafts((prev) => ({ ...prev, [msg.message_id]: r }))
                                }
                                style={{
                                  border: selected ? "1px solid #007BFF" : "1px solid #ccc",
                                  background: selected ? "rgba(0,123,255,0.1)" : "white",
                                  borderRadius: 999,
                                  padding: "6px 10px",
                                  cursor: "pointer",
                                  fontFamily: client.fontFamily,
                                  fontSize: "0.85rem",
                                  transition: "all 0.2s ease-in-out",
                                }}
                              >
                                {r}
                              </button>
                            );
                          })}
                        </div>

                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => setReasonOpenFor(null)}
                            style={{
                              background: "none",
                              border: "1px solid #ccc",
                              borderRadius: 8,
                              padding: "0.25rem 0.5rem",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() =>
                              handleVote(
                                msg.message_id,
                                "down",
                                reasonDrafts[msg.message_id]
                              )
                            }
                            disabled={!reasonDrafts[msg.message_id]}
                            style={{
                              background: "#007BFF",
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              padding: "0.25rem 0.75rem",
                              cursor: "pointer",
                              opacity: reasonDrafts[msg.message_id] ? 1 : 0.6,
                            }}
                          >
                            Submit
                          </button>
                        </div>
                      </div>
                    )}
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
