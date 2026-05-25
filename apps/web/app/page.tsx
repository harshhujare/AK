"use client";

import { useState } from "react";
import Link from "next/link";

const subjects = [
  "All subjects",
  "Child development",
  "Language 1 (Marathi)",
  "Language 2 (English)",
  "Mathematics",
  "EVS / Science",
];

const tests = [
  {
    id: 1,
    title: "Child Development & Pedagogy — Full Paper",
    questions: 30,
    minutes: 30,
    attempts: "2.4k",
    isPaid: false,
    tags: ["Paper 1", "Most popular"],
  },
  {
    id: 2,
    title: "Mathematics & Pedagogy — Practice Set 3",
    questions: 30,
    minutes: 30,
    attempts: "1.1k",
    isPaid: true,
    tags: ["Paper 1 & 2"],
  },
  {
    id: 3,
    title: "Language Skills (Marathi) — Full Mock",
    questions: 30,
    minutes: 30,
    attempts: "876",
    isPaid: false,
    tags: ["Paper 1"],
  },
];

const features = [
  {
    num: "01",
    title: "Real question papers",
    desc: "Past TET papers with auto-scoring, timed mode, and detailed answer explanations.",
  },
  {
    num: "02",
    title: "Chapter-wise notes",
    desc: "Curated PDFs organised by subject and chapter. Study offline, anytime.",
  },
  {
    num: "03",
    title: "Track your progress",
    desc: "See where you stand. Identify weak topics and focus your preparation where it counts.",
  },
];

export default function Home() {
  const [activeSubject, setActiveSubject] = useState("All subjects");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      style={{
        fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
        background: "#ffffff",
        color: "#0a0a0a",
        width: "100%",
        overflowX: "hidden",
      }}
    >
      {/* ─── Navbar ────────────────────────────────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 40px",
          borderBottom: "1px solid #efefed",
          position: "sticky",
          top: 0,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(8px)",
          zIndex: 100,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-serif, 'Playfair Display', serif)",
            fontSize: "17px",
            fontWeight: 700,
            letterSpacing: "-0.3px",
          }}
        >
          Ajit<span style={{ color: "#9a9994" }}>Sir</span> Academy
        </div>

        <div
          className="nav-links"
          style={{ display: "flex", gap: "28px", alignItems: "center" }}
        >
          {["Mock tests", "Notes", "Results", "Pricing"].map((item) => (
            <Link
              key={item}
              href={`#${item.toLowerCase().replace(" ", "-")}`}
              style={{
                fontSize: "13px",
                color: "#5a5a57",
                textDecoration: "none",
                letterSpacing: "0.01em",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "#0a0a0a")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "#5a5a57")
              }
            >
              {item}
            </Link>
          ))}
          <button
            style={{
              background: "#0a0a0a",
              color: "#ffffff",
              fontSize: "13px",
              padding: "8px 18px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              letterSpacing: "0.02em",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Start for free
          </button>
        </div>
      </nav>

      {/* ─── Hero ──────────────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 40px 72px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "64px",
          alignItems: "center",
          maxWidth: "960px",
          margin: "0 auto",
        }}
      >
        {/* Left */}
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#9a9994",
              border: "1px solid #ddddd9",
              padding: "5px 12px",
              borderRadius: "100px",
              marginBottom: "24px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                background: "#22c55e",
                borderRadius: "50%",
              }}
            />
            TET 2025 preparation
          </div>
          <h1
            style={{
              fontFamily: "var(--font-serif, 'Playfair Display', serif)",
              fontSize: "44px",
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: "-1.2px",
              marginBottom: "20px",
              color: "#0a0a0a",
            }}
          >
            Learn smarter.
            <br />
            <em style={{ fontStyle: "italic", color: "#9a9994" }}>
              Pass TET.
            </em>
          </h1>
          <p
            style={{
              fontSize: "15px",
              color: "#5a5a57",
              lineHeight: 1.65,
              marginBottom: "36px",
              fontWeight: 300,
              maxWidth: "380px",
            }}
          >
            Practice with real question papers, download expert notes, and track
            your progress — all in one place built for Maharashtra TET
            aspirants.
          </p>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button
              style={{
                background: "#0a0a0a",
                color: "#ffffff",
                fontSize: "14px",
                padding: "12px 24px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Start for free →
            </button>
            <button
              style={{
                background: "transparent",
                color: "#5a5a57",
                fontSize: "14px",
                padding: "12px 20px",
                borderRadius: "8px",
                border: "1px solid #ddddd9",
                cursor: "pointer",
                fontWeight: 400,
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#9a9994";
                e.currentTarget.style.color = "#0a0a0a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#ddddd9";
                e.currentTarget.style.color = "#5a5a57";
              }}
            >
              Watch demo
            </button>
          </div>
        </div>

        {/* Right — visual cards */}
        <div>
          {/* Score card */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #efefed",
              borderRadius: "12px",
              padding: "20px 24px",
              marginBottom: "12px",
              boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "16px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#9a9994",
                }}
              >
                Your score
              </span>
              <span
                style={{
                  fontSize: "11px",
                  background: "#f8f8f7",
                  border: "1px solid #efefed",
                  padding: "3px 8px",
                  borderRadius: "100px",
                  color: "#5a5a57",
                }}
              >
                Child Dev. — Paper 1
              </span>
            </div>
            <div
              style={{
                fontFamily: "var(--font-serif, 'Playfair Display', serif)",
                fontSize: "36px",
                fontWeight: 700,
                letterSpacing: "-1px",
                marginBottom: "4px",
              }}
            >
              74
              <span style={{ fontSize: "18px", color: "#9a9994" }}>/100</span>
            </div>
            <div style={{ fontSize: "12px", color: "#9a9994" }}>
              Top 12% this week
            </div>
            <div
              style={{ display: "flex", gap: "4px", marginTop: "14px" }}
            >
              <div
                style={{
                  height: "4px",
                  borderRadius: "2px",
                  flex: 3.2,
                  background: "#0a0a0a",
                }}
              />
              <div
                style={{
                  height: "4px",
                  borderRadius: "2px",
                  flex: 0.8,
                  background: "#efefed",
                }}
              />
            </div>
          </div>

          {/* Mini card 1 */}
          <div
            style={{
              background: "#f8f8f7",
              border: "1px solid #efefed",
              borderRadius: "10px",
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                background: "#0a0a0a",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                fontSize: "16px",
                flexShrink: 0,
              }}
            >
              ↓
            </div>
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  marginBottom: "2px",
                }}
              >
                Child Development — Ch. 4
              </div>
              <div style={{ fontSize: "11px", color: "#9a9994" }}>
                PDF · 18 pages · Free
              </div>
            </div>
          </div>

          {/* Mini card 2 */}
          <div
            style={{
              background: "#f8f8f7",
              border: "1px solid #efefed",
              borderRadius: "10px",
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                background: "#f8f8f7",
                borderRadius: "8px",
                border: "1px solid #efefed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0a0a0a",
                fontSize: "14px",
                flexShrink: 0,
              }}
            >
              ⏱
            </div>
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  marginBottom: "2px",
                }}
              >
                Next test: Language Skills
              </div>
              <div style={{ fontSize: "11px", color: "#9a9994" }}>
                40 questions · 45 mins
              </div>
            </div>
          </div>
        </div>
      </section>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid #efefed",
          margin: "0 40px",
        }}
      />

      {/* ─── Features ──────────────────────────────────────────────────────────── */}
      <section
        id="features"
        style={{
          padding: "48px 40px 64px",
          maxWidth: "960px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#9a9994",
            marginBottom: "40px",
          }}
        >
          Why students choose this
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "1px",
            background: "#efefed",
            border: "1px solid #efefed",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          {features.map((f) => (
            <div
              key={f.num}
              style={{ background: "#ffffff", padding: "28px 24px" }}
            >
              <div
                style={{
                  fontFamily:
                    "var(--font-serif, 'Playfair Display', serif)",
                  fontSize: "11px",
                  color: "#ddddd9",
                  marginBottom: "20px",
                }}
              >
                {f.num}
              </div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 500,
                  marginBottom: "8px",
                  letterSpacing: "-0.2px",
                }}
              >
                {f.title}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: "#5a5a57",
                  lineHeight: 1.6,
                  fontWeight: 300,
                }}
              >
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Subjects ──────────────────────────────────────────────────────────── */}
      <section
        id="mock-tests"
        style={{
          padding: "0 40px 32px",
          maxWidth: "960px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#9a9994",
            marginBottom: "20px",
          }}
        >
          Subjects covered
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSubject(s)}
              style={{
                padding: "10px 20px",
                border: `1px solid ${activeSubject === s ? "#0a0a0a" : "#ddddd9"}`,
                borderRadius: "100px",
                fontSize: "13px",
                color: activeSubject === s ? "#ffffff" : "#5a5a57",
                background: activeSubject === s ? "#0a0a0a" : "transparent",
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* ─── Tests ─────────────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "0 40px 64px",
          maxWidth: "960px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#9a9994",
            marginBottom: "20px",
          }}
        >
          Practice tests
        </div>
        {tests.map((test) => (
          <div
            key={test.id}
            style={{
              border: "1px solid #efefed",
              borderRadius: "12px",
              overflow: "hidden",
              marginBottom: "8px",
              transition: "box-shadow 0.15s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLDivElement).style.boxShadow =
                "0 4px 16px rgba(0,0,0,0.06)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLDivElement).style.boxShadow = "none")
            }
          >
            <div
              style={{
                padding: "18px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #efefed",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 500 }}>
                {test.title}
              </div>
              <div style={{ display: "flex", gap: "16px" }}>
                {[
                  { icon: "📝", val: `${test.questions} Qs` },
                  { icon: "⏱", val: `${test.minutes} min` },
                  { icon: "👥", val: `${test.attempts} attempts` },
                ].map((m) => (
                  <span
                    key={m.val}
                    style={{
                      fontSize: "12px",
                      color: "#9a9994",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    {m.icon} {m.val}
                  </span>
                ))}
              </div>
            </div>
            <div
              style={{
                padding: "14px 24px",
                background: "#f8f8f7",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", gap: "6px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    padding: "3px 10px",
                    borderRadius: "100px",
                    border: "1px solid transparent",
                    background: test.isPaid ? "#fef9c3" : "#dcfce7",
                    color: test.isPaid ? "#854d0e" : "#166534",
                  }}
                >
                  {test.isPaid ? "Pro" : "Free"}
                </span>
                {test.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: "11px",
                      padding: "3px 10px",
                      borderRadius: "100px",
                      border: "1px solid #ddddd9",
                      color: "#5a5a57",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <button
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  background: "#0a0a0a",
                  color: "#ffffff",
                  border: "none",
                  padding: "7px 16px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.opacity = "0.8")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.opacity = "1")
                }
              >
                Start test
              </button>
            </div>
          </div>
        ))}
      </section>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid #efefed",
          margin: "0 40px",
        }}
      />

      {/* ─── Pricing ───────────────────────────────────────────────────────────── */}
      <section
        id="pricing"
        style={{
          padding: "64px 40px",
          maxWidth: "960px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#9a9994",
            marginBottom: "40px",
          }}
        >
          Simple pricing
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          {/* Free plan */}
          <div
            style={{
              border: "1px solid #ddddd9",
              borderRadius: "12px",
              padding: "28px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#9a9994",
                marginBottom: "12px",
              }}
            >
              Free
            </div>
            <div
              style={{
                fontFamily:
                  "var(--font-serif, 'Playfair Display', serif)",
                fontSize: "38px",
                fontWeight: 700,
                letterSpacing: "-1px",
                marginBottom: "4px",
              }}
            >
              ₹0
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#9a9994",
                marginBottom: "24px",
              }}
            >
              forever
            </div>
            <ul
              style={{
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginBottom: "28px",
              }}
            >
              {[
                "5 free mock tests",
                "Free notes download",
                "Basic score report",
              ].map((item) => (
                <li
                  key={item}
                  style={{
                    fontSize: "13px",
                    color: "#5a5a57",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ color: "#22c55e", fontSize: "15px" }}>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              style={{
                width: "100%",
                padding: "11px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                background: "transparent",
                border: "1px solid #ddddd9",
                color: "#0a0a0a",
                transition: "border-color 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "#9a9994")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "#ddddd9")
              }
            >
              Get started
            </button>
          </div>

          {/* Pro plan */}
          <div
            style={{
              border: "1px solid #0a0a0a",
              borderRadius: "12px",
              padding: "28px",
              background: "#0a0a0a",
              color: "#ffffff",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#9a9994",
                marginBottom: "12px",
              }}
            >
              Pro
            </div>
            <div
              style={{
                fontFamily:
                  "var(--font-serif, 'Playfair Display', serif)",
                fontSize: "38px",
                fontWeight: 700,
                letterSpacing: "-1px",
                marginBottom: "4px",
                color: "#ffffff",
              }}
            >
              ₹299
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#9a9994",
                marginBottom: "24px",
              }}
            >
              per month · cancel anytime
            </div>
            <ul
              style={{
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginBottom: "28px",
              }}
            >
              {[
                "Unlimited mock tests",
                "All notes & PDFs",
                "Detailed analytics",
                "Leaderboard access",
                "Video lectures (coming soon)",
              ].map((item) => (
                <li
                  key={item}
                  style={{
                    fontSize: "13px",
                    color: "#d1d5db",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ color: "#22c55e", fontSize: "15px" }}>
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              style={{
                width: "100%",
                padding: "11px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                background: "#ffffff",
                border: "none",
                color: "#0a0a0a",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.opacity = "0.9")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.opacity = "1")
              }
            >
              Upgrade to Pro →
            </button>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────────────────────── */}
      <footer
        style={{
          padding: "32px 40px",
          borderTop: "1px solid #efefed",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-serif, 'Playfair Display', serif)",
            fontSize: "15px",
            fontWeight: 700,
          }}
        >
          AjitSir Academy
        </div>
        <div style={{ fontSize: "12px", color: "#9a9994" }}>
          Made with ♥ for Maharashtra TET aspirants
        </div>
      </footer>
    </div>
  );
}
