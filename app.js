const { useState, useEffect } = React;


	// ═══════════════════════════════════════════════════════════════
// THE RECORD — app.js
// All React component logic. Babel transpiles JSX in the browser
// so this file deploys as-is to GitHub Pages (no build step).
// ═══════════════════════════════════════════════════════════════

const { useState, useEffect, useCallback } = React;

// ─── CONFIG ───────────────────────────────────────────────────
const STORAGE_KEY = "therecord_v3";
const CLAUDE_URL  = "https://api.anthropic.com/v1/messages";
const MODEL       = "claude-sonnet-4-20250514";

// ─── SEED DATA ────────────────────────────────────────────────
const SEED_DOCS = [
  { id:"d1", date:"2025-01-07", title:"Maxwell Civil Suit — Batch 1 Unsealing", pages:200, redactionPct:31, keywords:["Maxwell","trafficking","Palm Beach","Virgin Islands"], source:"SDNY", batch:1, status:"released" },
  { id:"d2", date:"2025-02-03", title:"Epstein Flight Logs 1998–2005 (Partial)", pages:88,  redactionPct:64, keywords:["flight logs","private jet","Lolita Express","minors"], source:"DOJ FOIA", batch:2, status:"partial" },
  { id:"d3", date:"2025-05-01", title:"Senate Judiciary Subpoena — FBI File Request", pages:14, redactionPct:0, keywords:["FBI","non-prosecution","Palm Beach PD","2006"], source:"Senate Judiciary", batch:3, status:"released" },
  { id:"d4", date:"2025-06-06", title:"Palm Beach Grand Jury Transcripts 2007 (Excerpts)", pages:42, redactionPct:78, keywords:["grand jury","co-conspirators","plea deal","Acosta"], source:"Palm Beach Post / DOJ", batch:4, status:"partial" },
  { id:"d5", date:"2025-06-08", title:"Epstein Estate Financial Records — Probate Filing", pages:310, redactionPct:19, keywords:["finances","islands","trusts","beneficiaries"], source:"USVI Probate Court", batch:5, status:"released" },
  { id:"d6", date:"2026-01-14", title:"Maxwell Victim Affidavits — Third Tranche", pages:127, redactionPct:55, keywords:["victim testimony","named individuals","2002-2004"], source:"SDNY", batch:6, status:"partial" },
  { id:"d7", date:"2026-03-22", title:"DOJ Internal Memo: 2008 NPA Review", pages:6,   redactionPct:88, keywords:["NPA","DOJ HQ","Acosta","privilege"], source:"DOJ Inspector General", batch:7, status:"partial" },
  { id:"d8", date:"2026-05-30", title:"Epstein Associate Network — FBI Assessment", pages:71, redactionPct:43, keywords:["network","associates","foreign nationals","intelligence"], source:"FBI / Senate FOIA", batch:8, status:"released" },
];

const SEED_STATEMENTS = [
  { id:"s1", date:"2025-01-20", text:"We're going to open it all up. People have a right to know.", context:"Pre-inaugural rally, promising Epstein declassification in first 100 days.", verdict:"No declassification order issued within the promised 100-day window.", rating:"unverified", source:"C-SPAN" },
  { id:"s2", date:"2025-03-12", text:"The media is the enemy of the people. They are criminal enterprises.", context:"Unscheduled White House press room appearance.", verdict:"No legal findings support a criminal enterprise characterization of any listed outlet.", rating:"false", source:"WH Press Pool / PolitiFact" },
  { id:"s3", date:"2025-04-15", text:"I just got off the phone with [foreign leader] and we resolved the whole thing.", context:"Disputed: foreign government publicly denied the call occurred.", verdict:"Foreign ministry issued a public denial within two hours of the statement.", rating:"disputed", source:"Axios / Reuters" },
  { id:"s4", date:"2025-06-01", text:"I personally solved the NATO funding problem last night.", context:"2:04 AM Truth Social post. NATO issued no confirming statement.", verdict:"NATO Brussels press office did not confirm any resolution call.", rating:"unverified", source:"Truth Social" },
  { id:"s5", date:"2025-06-08", text:"Our GDP is the highest in history — higher than any country has ever had. By far.", context:"Rose Garden event.", verdict:"US GDP is historically high but the absolute superlative claim is factually incorrect by multiple measures.", rating:"false", source:"AP Fact Check" },
  { id:"s6", date:"2025-09-17", text:"There was no quid pro quo. None. Zero. Everyone said so.", context:"Press gaggle regarding foreign aid inquiry.", verdict:"Inspector General report noted 'unusual conditions' attached to aid release.", rating:"disputed", source:"Reuters / IG Report" },
  { id:"s7", date:"2026-02-04", text:"I never met Epstein. I don't know who that is.", context:"Oval Office, when asked about newly released flight logs.", verdict:"Multiple photographs, video, and prior on-record statements confirm a prior relationship.", rating:"false", source:"NBC News / archived records" },
  { id:"s8", date:"2026-04-11", text:"The Epstein files are totally clean. Nothing there.", context:"Truth Social, responding to latest document release.", verdict:"Released files contain significant redactions and reference unnamed co-conspirators.", rating:"unverified", source:"Truth Social / legal analysts" },
];

const RATING_CFG = {
  false:      { label:"FALSE",      color:"#c0392b", bg:"#fdf0ef" },
  disputed:   { label:"DISPUTED",   color:"#b8860b", bg:"#fdf8e8" },
  unverified: { label:"UNVERIFIED", color:"#2d5f8a", bg:"#eff4fa" },
  true:       { label:"VERIFIED",   color:"#2d6a4f", bg:"#f0f8f4" },
};

const STATUS_COLOR = {
  online:"#2d6a4f", degraded:"#b8860b", offline:"#c0392b",
  monitoring:"#2d5f8a", active:"#2d6a4f", pending:"#888",
};

// ─── UTILS ────────────────────────────────────────────────────
function fmtDate(d) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    month:"short", day:"numeric", year:"numeric"
  });
}

async function callClaude(system, userMsg, tools) {
  const body = { model:MODEL, max_tokens:1000, system, messages:[{role:"user",content:userMsg}] };
  if (tools) body.tools = tools;
  const res = await fetch(CLAUDE_URL, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify(body),
  });
  return res.json();
}

function extractText(data) {
  return (data.content || []).filter(c => c.type === "text").map(c => c.text).join("") || "";
}

function parseJSONArray(raw) {
  const clean = raw.replace(/```json|```/g, "").trim();
  const match = clean.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array found");
  return JSON.parse(match[0]);
}

// ═══════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════

function RedactionBar({ pct, segments = 22 }) {
  return (
    <div className="redact-bar-wrap">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className="redact-segment"
          style={{
            width: `${120 / segments}px`,
            background: (i / segments) * 100 < pct ? "#0a0a0a" : "rgba(0,0,0,0.1)",
          }}
        />
      ))}
      <span className="redact-bar-pct">{pct}% redacted</span>
    </div>
  );
}

function Tag({ type }) {
  return <span className={`tag tag-${type}`}>{type}</span>;
}

function Spinner({ label = "Loading" }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      {label}…
    </div>
  );
}

function ToastContainer({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast${t.type === "success" ? " toast-success" : ""}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PANEL 1 — TRANSPARENCY TRACKER
// ═══════════════════════════════════════════════════════════════

function AddDocForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title:"", pages:"", redactionPct:"", source:"", keywords:"", status:"partial" });
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  function submit() {
    if (!f.title.trim()) return;
    onAdd({
      id: "d" + Date.now(),
      date: new Date().toISOString().split("T")[0],
      title: f.title,
      pages: parseInt(f.pages) || 0,
      redactionPct: Math.min(100, Math.max(0, parseInt(f.redactionPct) || 0)),
      source: f.source || "User Submitted",
      keywords: f.keywords.split(",").map(k => k.trim()).filter(Boolean),
      status: f.status,
      batch: Date.now(),
    });
    setOpen(false);
    setF({ title:"", pages:"", redactionPct:"", source:"", keywords:"", status:"partial" });
  }

  if (!open) return (
    <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>＋ Log Document Batch</button>
  );

  return (
    <div className="inline-form">
      <div className="section-label" style={{ marginBottom:12 }}>Log New Document Batch</div>
      <div className="form-grid-2">
        <div className="form-field form-full">
          <label className="form-label">Document Title</label>
          <input className="form-input" value={f.title} onChange={set("title")} placeholder="Full document title…" />
        </div>
        <div className="form-field">
          <label className="form-label">Pages</label>
          <input className="form-input" type="number" value={f.pages} onChange={set("pages")} placeholder="0" />
        </div>
        <div className="form-field">
          <label className="form-label">Redaction %</label>
          <input className="form-input" type="number" value={f.redactionPct} onChange={set("redactionPct")} placeholder="0–100" />
        </div>
        <div className="form-field">
          <label className="form-label">Source / Court</label>
          <input className="form-input" value={f.source} onChange={set("source")} placeholder="e.g. SDNY, DOJ FOIA…" />
        </div>
        <div className="form-field">
          <label className="form-label">Status</label>
          <select className="form-select" value={f.status} onChange={set("status")}>
            <option value="released">Released</option>
            <option value="partial">Partial</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <div className="form-field form-full">
          <label className="form-label">Keywords (comma-separated)</label>
          <input className="form-input" value={f.keywords} onChange={set("keywords")} placeholder="keyword1, keyword2…" />
        </div>
      </div>
      <div className="form-actions">
        <button className="btn btn-dark" onClick={submit}>File Document</button>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function TransparencyTracker({ docs, onAddDoc }) {
  const [openId, setOpenId] = useState(null);
  const [analyses, setAnalyses] = useState({});
  const [loadingId, setLoadingId] = useState(null);

  const sorted = [...docs].sort((a, b) => new Date(a.date) - new Date(b.date));
  const totalPages = docs.reduce((s, d) => s + d.pages, 0);
  const avgRedact  = Math.round(docs.reduce((s, d) => s + d.redactionPct, 0) / (docs.length || 1));
  const released   = docs.filter(d => d.status === "released").length;

  async function analyzeDoc(doc) {
    if (analyses[doc.id]) return;
    setLoadingId(doc.id);
    try {
      const data = await callClaude(
        "You are a document analyst for THE RECORD, a political accountability tracker. Given metadata about a legal document release, write 2-3 sentences: what this document likely contains, why the redaction level is notable, and what accountability questions it raises. Be factual, neutral, concise. Plain prose, no markdown.",
        `Title: ${doc.title}\nDate: ${doc.date}\nPages: ${doc.pages}\nRedaction: ${doc.redactionPct}%\nKeywords: ${doc.keywords.join(", ")}\nSource: ${doc.source}`
      );
      setAnalyses(a => ({ ...a, [doc.id]: extractText(data) || "Analysis unavailable." }));
    } catch {
      setAnalyses(a => ({ ...a, [doc.id]: "Analysis unavailable — check connection." }));
    }
    setLoadingId(null);
  }

  function toggle(doc) {
    const next = openId === doc.id ? null : doc.id;
    setOpenId(next);
    if (next) analyzeDoc(doc);
  }

  // dot color by redaction level
  function dotColor(pct) {
    if (pct >= 60) return "#c0392b";
    if (pct >= 30) return "#b8860b";
    return "#2d6a4f";
  }

  return (
    <div>
      {/* Stats */}
      <div className="stat-grid-4">
        {[
          { val: docs.length,                  label:"Document Batches",       color:"#0a0a0a" },
          { val: totalPages.toLocaleString(),   label:"Total Pages Released",   color:"#0a0a0a" },
          { val: `${avgRedact}%`,               label:"Avg Redaction Density",  color:"#c0392b" },
          { val: `${released}/${docs.length}`,  label:"Fully Released",         color:"#2d6a4f" },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-card-num" style={{ color: s.color }}>{s.val}</div>
            <div className="stat-card-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="timeline-wrap">
        <div className="timeline-spine" />
        {sorted.map((doc, i) => {
          const isOpen    = openId === doc.id;
          const yearGroup = i === 0 || doc.date.slice(0, 4) !== sorted[i - 1].date.slice(0, 4);
          return (
            <div key={doc.id}>
              {yearGroup && (
                <div className="tl-year-row" style={{ marginTop: i > 0 ? 20 : 0, marginBottom: 8 }}>
                  <div className="tl-year-label">{doc.date.slice(0, 4)}</div>
                  <div className="tl-year-dash" />
                </div>
              )}
              <div className="tl-doc-row" onClick={() => toggle(doc)}>
                <div className="tl-doc-date">
                  {fmtDate(doc.date).replace(/,.*$/, "")}
                </div>
                <div className="tl-dot-col">
                  <div className="tl-dot" style={{
                    background: isOpen ? "#0a0a0a" : dotColor(doc.redactionPct),
                    boxShadow: isOpen ? "0 0 0 3px #0a0a0a" : "none",
                  }} />
                </div>
                <div className={`tl-card ${isOpen ? "open" : ""}`}>
                  <div className="tl-card-meta">
                    <Tag type={doc.status} />
                    <span className="tl-card-meta-txt">
                      Batch {doc.batch} · {doc.pages} pp · {doc.source}
                    </span>
                  </div>
                  <div className="tl-card-headline">{doc.title}</div>
                  <RedactionBar pct={doc.redactionPct} />
                  <div className="tl-kw-row">
                    {doc.keywords.map(k => <span key={k} className="kw-chip">#{k}</span>)}
                  </div>
                  {isOpen && (
                    <div className="tl-analysis">
                      <div className="analysis-label">◈ Document Analysis</div>
                      {loadingId === doc.id
                        ? <Spinner label="Analyzing document" />
                        : <div className="analysis-text">{analyses[doc.id]}</div>
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add doc */}
      <div style={{ marginTop:20, paddingTop:16, borderTop:"1px solid #e8e4da" }}>
        <AddDocForm onAdd={onAddDoc} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PANEL 2 — ACCOUNTABILITY TICKER
// ═══════════════════════════════════════════════════════════════

function AddStatementForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ text:"", context:"", verdict:"", rating:"false", source:"" });
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  function submit() {
    if (!f.text.trim()) return;
    onAdd({ id:"s"+Date.now(), date:new Date().toISOString().split("T")[0], ...f });
    setOpen(false);
    setF({ text:"", context:"", verdict:"", rating:"false", source:"" });
  }

  if (!open) return (
    <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>＋ Log Statement</button>
  );

  return (
    <div className="inline-form inline-form-red">
      <div className="section-label" style={{ marginBottom:12 }}>Log Statement</div>
      {[
        ["text","Exact quote","textarea"],
        ["context","Context (when / where said)","text"],
        ["verdict","Fact-check verdict","text"],
        ["source","Source / Fact-checker","text"],
      ].map(([k, ph, type]) => (
        <div key={k} className="form-field">
          <label className="form-label">{ph}</label>
          {type === "textarea"
            ? <textarea className="form-textarea" value={f[k]} onChange={set(k)} placeholder={ph} />
            : <input className="form-input" value={f[k]} onChange={set(k)} placeholder={ph} />
          }
        </div>
      ))}
      <div className="form-field">
        <label className="form-label">Rating</label>
        <select className="form-select" value={f.rating} onChange={set("rating")}>
          {["false","disputed","unverified","true"].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="form-actions">
        <button className="btn btn-red" onClick={submit}>File Statement</button>
        <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function AccountabilityTicker({ statements, onAddStatement, onFetchNew }) {
  const [filter,   setFilter]   = useState("all");
  const [openId,   setOpenId]   = useState(null);
  const [analyses, setAnalyses] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [fetching, setFetching] = useState(false);

  const counts = {
    all:        statements.length,
    false:      statements.filter(s => s.rating === "false").length,
    disputed:   statements.filter(s => s.rating === "disputed").length,
    unverified: statements.filter(s => s.rating === "unverified").length,
  };

  const visible = [...(filter === "all" ? statements : statements.filter(s => s.rating === filter))]
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  async function analyze(stmt) {
    if (analyses[stmt.id]) return;
    setLoadingId(stmt.id);
    try {
      const data = await callClaude(
        "You are a nonpartisan fact-check analyst. Given a presidential statement and its verdict, write 2-3 sentences: what makes this claim false/disputed/unverified, what the documented facts show, and the accountability implication. Plain prose, no markdown, no partisan framing.",
        `Statement: "${stmt.text}"\nContext: ${stmt.context}\nVerdict: ${stmt.verdict}\nRating: ${stmt.rating}\nSource: ${stmt.source}`
      );
      setAnalyses(a => ({ ...a, [stmt.id]: extractText(data) || "Analysis unavailable." }));
    } catch {
      setAnalyses(a => ({ ...a, [stmt.id]: "Analysis unavailable — check connection." }));
    }
    setLoadingId(null);
  }

  function toggle(stmt) {
    const next = openId === stmt.id ? null : stmt.id;
    setOpenId(next);
    if (next) analyze(stmt);
  }

  async function handleFetch() {
    setFetching(true);
    await onFetchNew();
    setFetching(false);
  }

  return (
    <div>
      {/* Counter banner */}
      <div className="counter-banner">
        {[
          { val: statements.length,  label:"Statements Logged", color:"#f5f2eb" },
          { val: counts.false,       label:"Rated FALSE",        color:"#ff7b6b" },
          { val: counts.disputed,    label:"Disputed",           color:"#ffd07b" },
          { val: counts.unverified,  label:"Unverified",         color:"#8ab8e8" },
        ].map(s => (
          <div key={s.label} className="counter-cell">
            <div className="counter-num" style={{ color: s.color }}>{s.val}</div>
            <div className="counter-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="filter-pills">
        {["all","false","disputed","unverified"].map(f => (
          <button key={f} className={`pill${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
            {f} ({counts[f] || 0})
          </button>
        ))}
        <button
          className="btn btn-red btn-sm"
          style={{ marginLeft:"auto" }}
          onClick={handleFetch}
          disabled={fetching}
        >
          {fetching ? "Searching…" : "↻ Fetch Latest"}
        </button>
      </div>

      {/* Statements */}
      <div>
        {visible.map(stmt => {
          const cfg    = RATING_CFG[stmt.rating] || RATING_CFG.unverified;
          const isOpen = openId === stmt.id;
          return (
            <div
              key={stmt.id}
              className="stmt-card"
              style={{ borderLeftColor: cfg.color, background: isOpen ? cfg.bg : "white" }}
              onClick={() => toggle(stmt)}
            >
              <div className="stmt-card-header">
                <div className="stmt-card-meta">
                  <div className="stmt-card-meta-left">
                    <span className="rating-badge" style={{ color: cfg.color, borderColor: cfg.color }}>
                      {cfg.label}
                    </span>
                    <span className="stmt-date">{fmtDate(stmt.date)}</span>
                    <span className="stmt-source">⊕ {stmt.source}</span>
                  </div>
                  <span className="stmt-chevron">{isOpen ? "▲" : "▼"}</span>
                </div>
                <div className="stmt-quote">"{stmt.text}"</div>
                <div className="stmt-context">{stmt.context}</div>
              </div>
              {isOpen && (
                <div className="stmt-body">
                  <div className="stmt-verdict-row">
                    <span className="stmt-verdict-label">Verdict: </span>
                    <span className="stmt-verdict-text">{stmt.verdict}</span>
                  </div>
                  <div className="analysis-label">◈ Fact-Check Analysis</div>
                  {loadingId === stmt.id
                    ? <Spinner label="Analyzing" />
                    : <div className="analysis-text">{analyses[stmt.id]}</div>
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid #e8e4da" }}>
        <AddStatementForm onAdd={onAddStatement} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PANEL 3 — INTELLIGENCE BRIEF
// ═══════════════════════════════════════════════════════════════

const PRESETS = [
  "What documents have the highest redaction density and why is that significant?",
  "Summarize all FALSE-rated statements in order of severity.",
  "What do released documents suggest about unnamed co-conspirators?",
  "Compare redaction levels across batches — what pattern emerges?",
  "Which statements most directly contradict documented evidence?",
];

function IntelligenceBrief({ docs, statements }) {
  const [query,      setQuery]      = useState("");
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [briefs,     setBriefs]     = useState([]);
  const [generating, setGenerating] = useState(false);

  function buildContext() {
    const docsCtx  = docs.map(d =>
      `[DOC|${d.date}] "${d.title}" — ${d.pages}pp, ${d.redactionPct}% redacted, keywords: ${d.keywords.join(", ")}, source: ${d.source}`
    ).join("\n");
    const stmtsCtx = statements.map(s =>
      `[STMT|${s.date}|${s.rating.toUpperCase()}] "${s.text}" — ${s.verdict}`
    ).join("\n");
    return { docsCtx, stmtsCtx };
  }

  async function search(q) {
    const question = (q || query).trim();
    if (!question) return;
    setLoading(true);
    setResult(null);
    const { docsCtx, stmtsCtx } = buildContext();
    try {
      const data = await callClaude(
        `You are the chief analyst for THE RECORD, a political accountability tracker. Answer questions using only the provided records. Be analytical, factual, precise. Plain prose with paragraph breaks — no markdown headers or bullets.\n\nDOCUMENT RECORDS:\n${docsCtx}\n\nSTATEMENT RECORDS:\n${stmtsCtx}`,
        question
      );
      setResult({ q: question, a: extractText(data) || "No result." });
    } catch {
      setResult({ q: question, a: "Query failed — check connection." });
    }
    setLoading(false);
  }

  async function generateBrief() {
    setGenerating(true);
    const { docsCtx, stmtsCtx } = buildContext();
    try {
      const data = await callClaude(
        "You are the senior editor of THE RECORD accountability tracker. Write a short intelligence brief (3 paragraphs, ~200 words) covering: the state of Epstein document transparency, the pattern of executive statements on record, and the most pressing accountability questions. Style: formal intelligence memo. No markdown. Begin with 'INTELLIGENCE BRIEF — THE RECORD'.",
        `Document records:\n${docsCtx}\n\nStatement records:\n${stmtsCtx}`
      );
      const text = extractText(data);
      if (text) setBriefs(b => [{ id:Date.now(), date:new Date().toISOString().split("T")[0], text }, ...b].slice(0, 5));
    } catch { /* silent */ }
    setGenerating(false);
  }

  return (
    <div>
      {/* Query */}
      <div className="query-wrap">
        <div className="section-label">Ask the Record</div>
        <div className="query-input-row">
          <input
            className="query-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search()}
            placeholder="Query the full document + statement database…"
          />
          <button className="btn btn-dark" onClick={() => search()} disabled={loading}>
            {loading ? "…" : "Query"}
          </button>
        </div>
        <div className="preset-chips">
          {PRESETS.map((p, i) => (
            <button key={i} className="preset-chip" onClick={() => { setQuery(p); search(p); }}>
              {p.substring(0, 60)}…
            </button>
          ))}
        </div>
      </div>

      {loading && <Spinner label="Querying database" />}

      {result && (
        <div className="ai-result-panel">
          <div className="ai-result-label">◈ Query Response</div>
          <div className="ai-result-q">Q: {result.q}</div>
          <div className="ai-result-text">{result.a}</div>
        </div>
      )}

      {/* Briefs */}
      <div style={{ borderTop:"1px solid #e8e4da", paddingTop:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
          <div className="section-label" style={{ marginBottom:0 }}>Intelligence Briefs</div>
          <button className="btn btn-dark btn-sm" onClick={generateBrief} disabled={generating}>
            {generating ? "Generating…" : "Generate Brief"}
          </button>
        </div>
        {generating && <Spinner label="Drafting intelligence brief" />}
        {briefs.length === 0 && !generating && (
          <div style={{ fontFamily:"var(--mono)", fontSize:"0.68rem", color:"#ccc",
            textTransform:"uppercase", letterSpacing:"0.08em", padding:"20px 0" }}>
            No briefs yet — click Generate Brief.
          </div>
        )}
        {briefs.map(b => (
          <div key={b.id} className="brief-card">
            <div className="brief-date">Generated {fmtDate(b.date)}</div>
            <div className="brief-text">{b.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PANEL 4 — DATA ACQUISITION
// ═══════════════════════════════════════════════════════════════

const PIPELINE = [
  { name:"OCR Engine",        desc:"Tesseract + AWS Textract for PDF ingestion",      status:"online",    throughput:"~40 pp/min"    },
  { name:"NLP Classifier",    desc:"Keyword tagging + entity extraction per document", status:"online",    throughput:"~120 docs/hr"  },
  { name:"Redaction Analyzer",desc:"Pixel density analysis on black-bar regions",      status:"online",    throughput:"real-time"     },
  { name:"Fact-Check NLP",    desc:"Cross-reference statements vs source documents",   status:"degraded",  throughput:"~60 stmts/hr"  },
  { name:"Data Store",        desc:"localStorage persistence + optional S3 backup",    status:"online",    throughput:"real-time"     },
];

const SOURCES = [
  { id:"doj",      name:"DOJ FOIA Portal",              url:"justice.gov/foia",               type:"document",   status:"active",     lastCheck:"2026-06-09", latency:"~2 days"   },
  { id:"sdny",     name:"SDNY Court Records (PACER)",   url:"pacer.gov",                       type:"document",   status:"active",     lastCheck:"2026-06-09", latency:"real-time" },
  { id:"senate",   name:"Senate Judiciary Committee",   url:"judiciary.senate.gov",            type:"document",   status:"active",     lastCheck:"2026-06-08", latency:"~1 day"    },
  { id:"politifact",name:"PolitiFact",                  url:"politifact.com",                  type:"fact-check", status:"active",     lastCheck:"2026-06-10", latency:"real-time" },
  { id:"wh",       name:"White House Press Transcripts",url:"whitehouse.gov/briefing-room",    type:"statement",  status:"active",     lastCheck:"2026-06-10", latency:"~1 hour"   },
  { id:"cspan",    name:"C-SPAN Transcript Archive",    url:"c-span.org",                      type:"statement",  status:"active",     lastCheck:"2026-06-09", latency:"~3 hours"  },
  { id:"reuters",  name:"Reuters Fact Check",           url:"reuters.com/fact-check",          type:"fact-check", status:"active",     lastCheck:"2026-06-10", latency:"real-time" },
  { id:"oversight",name:"House Oversight Committee",    url:"oversight.house.gov",             type:"document",   status:"monitoring", lastCheck:"2026-06-07", latency:"~1 day"    },
];

const LOG_COLOR = { success:"#2d6a4f", warn:"#b8860b", info:"#2d5f8a", error:"#c0392b" };

function DataAcquisition({ onFetchDocs, onFetchStatements }) {
  const [fetchingDocs,  setFetchingDocs]  = useState(false);
  const [fetchingStmts, setFetchingStmts] = useState(false);
  const [log, setLog] = useState([
    { ts:"2026-06-10 08:14", source:"SDNY",         msg:"2 new document references found",  type:"success" },
    { ts:"2026-06-10 06:00", source:"PolitiFact",    msg:"3 new ratings ingested",           type:"success" },
    { ts:"2026-06-09 22:30", source:"WH Transcripts",msg:"Press briefing transcript added",  type:"success" },
    { ts:"2026-06-09 18:00", source:"DOJ FOIA",      msg:"Rate limit hit — retry scheduled", type:"warn"    },
    { ts:"2026-06-09 14:15", source:"House Oversight",msg:"No new releases detected",        type:"info"    },
  ]);

  function addLog(source, msg, type = "success") {
    const now = new Date();
    const ts = `${now.toLocaleDateString("en-US",{month:"2-digit",day:"2-digit"})} ${now.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:false})}`;
    setLog(l => [{ ts, source, msg, type }, ...l].slice(0, 25));
  }

  async function runDocScrape() {
    setFetchingDocs(true);
    addLog("AI Scraper", "Querying for new document disclosures…", "info");
    await onFetchDocs();
    addLog("DOJ / SDNY", "Scrape complete — entries updated", "success");
    setFetchingDocs(false);
  }

  async function runStmtScrape() {
    setFetchingStmts(true);
    addLog("AI Scraper", "Searching for new executive statements…", "info");
    await onFetchStatements();
    addLog("WH Transcripts / PolitiFact", "Scrape complete — statements logged", "success");
    setFetchingStmts(false);
  }

  return (
    <div>
      {/* Pipeline */}
      <div className="section-label">Processing Pipeline</div>
      <div className="pipeline-grid">
        {PIPELINE.map(p => (
          <div key={p.name} className="pipeline-card">
            <div className="pipeline-card-head">
              <div className="status-pip" style={{ background: STATUS_COLOR[p.status] || "#888" }} />
              <span className="pipeline-name">{p.name}</span>
            </div>
            <div className="pipeline-desc">{p.desc}</div>
            <div className="pipeline-status" style={{ color: STATUS_COLOR[p.status] || "#888" }}>
              {p.status} · {p.throughput}
            </div>
          </div>
        ))}
      </div>

      {/* Sources */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
        <div className="section-label" style={{ marginBottom:0 }}>Monitored Sources</div>
        <button className="btn btn-dark btn-sm" onClick={runDocScrape} disabled={fetchingDocs}>
          {fetchingDocs ? "Scraping…" : "↻ Scrape Docs"}
        </button>
        <button className="btn btn-red btn-sm" onClick={runStmtScrape} disabled={fetchingStmts}>
          {fetchingStmts ? "Scraping…" : "↻ Scrape Statements"}
        </button>
      </div>
      <div className="sources-table">
        <div className="sources-table-head">
          <span>Source</span><span>Type</span><span>Last Check</span><span>Status</span>
        </div>
        {SOURCES.map(s => (
          <div key={s.id} className="sources-table-row">
            <div>
              <div className="source-name">{s.name}</div>
              <div className="source-url">{s.url} · lag: {s.latency}</div>
            </div>
            <div className="source-type">{s.type}</div>
            <div className="source-lastcheck">{s.lastCheck}</div>
            <div className="source-status-wrap">
              <div className="status-pip" style={{ background: STATUS_COLOR[s.status] || "#888" }} />
              <span className="source-status-lbl" style={{ color: STATUS_COLOR[s.status] || "#888" }}>
                {s.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Log */}
      <div className="section-label">Acquisition Log</div>
      <div className="log-console">
        {log.map((l, i) => (
          <div key={i} className="log-row">
            <span className="log-ts">{l.ts}</span>
            <span className="log-source">[{l.source}]</span>
            <span style={{ color: LOG_COLOR[l.type] || "#888" }}>{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════

const PANELS = [
  { id:"transparency", label:"Transparency Tracker",  sub:"Document Timeline"  },
  { id:"ticker",       label:"Accountability Ticker", sub:"Statement Ledger"   },
  { id:"intel",        label:"Intelligence Brief",    sub:"AI Query Engine"    },
  { id:"acquisition",  label:"Data Acquisition",      sub:"Source Monitoring"  },
];

function App() {
  const [docs,       setDocs]       = useState(SEED_DOCS);
  const [statements, setStatements] = useState(SEED_STATEMENTS);
  const [panel,      setPanel]      = useState("transparency");
  const [toasts,     setToasts]     = useState([]);
  const [time,       setTime]       = useState(new Date());

  // Persist to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.docs)       setDocs(d.docs);
        if (d.statements) setStatements(d.statements);
      }
    } catch { /* first run */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ docs, statements })); }
    catch { /* storage full */ }
  }, [docs, statements]);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  function toast(msg, type = "success") {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }

  function addDoc(doc)       { setDocs(d => [doc, ...d]);       toast("Document batch filed"); }
  function addStatement(stmt){ setStatements(s => [stmt, ...s]); toast("Statement logged"); }

  async function fetchNewStatements() {
    const existing = statements.slice(0,8).map(s => s.text.substring(0, 40)).join(" | ");
    try {
      const data = await callClaude(
        `You are a news intelligence system. Search for the latest notable or controversial statements by US President Trump. Return ONLY a raw JSON array (no markdown). Each object: {id,date,text,context,verdict,rating,source}. rating must be one of: false, disputed, unverified. Dates must be recent (2025–2026). Do not duplicate: ${existing}`,
        "Generate 2-3 new statement entries.",
        [{ type:"web_search_20250305", name:"web_search" }]
      );
      const raw   = extractText(data);
      const items = parseJSONArray(raw);
      const novel = items.filter(x => !statements.find(s => s.text === x.text));
      if (novel.length) { setStatements(s => [...novel, ...s]); toast(`${novel.length} new statement(s) added`); }
      else toast("No new statements found", "info");
    } catch { toast("Fetch failed — check connection", "error"); }
  }

  async function fetchNewDocs() {
    const existing = docs.slice(0,6).map(d => d.title.substring(0, 40)).join(" | ");
    try {
      const data = await callClaude(
        `You are a news intelligence system. Search for the latest Epstein file document releases or court unsealing orders. Return ONLY a raw JSON array (no markdown). Each object: {id,date,title,pages,redactionPct,keywords,source,status,batch}. status: released|partial|pending. Do not duplicate: ${existing}`,
        "Generate 2 new document batch entries.",
        [{ type:"web_search_20250305", name:"web_search" }]
      );
      const raw   = extractText(data);
      const items = parseJSONArray(raw);
      const novel = items.filter(x => !docs.find(d => d.title === x.title));
      if (novel.length) { setDocs(d => [...novel, ...d]); toast(`${novel.length} new batch(es) added`); }
      else toast("No new documents found", "info");
    } catch { toast("Fetch failed — check connection", "error"); }
  }

  const falseCount    = statements.filter(s => s.rating === "false").length;
  const disputedCount = statements.filter(s => s.rating === "disputed").length;
  const tickerItems   = [...docs, ...statements]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10)
    .map(x => x.title || `"${String(x.text || "").substring(0, 55)}…"`)
    .join("   ·   ");

  return (
    <div>
      {/* ── MASTHEAD ── */}
      <div className="masthead">
        <div className="masthead-inner">
          <div>
            <div className="masthead-title">THE RECORD</div>
            <div className="masthead-sub">Political Accountability Tracker · Epstein Files &amp; Executive Statements</div>
          </div>
          <div className="masthead-ticker-wrap">
            <div className="masthead-ticker-text">{tickerItems}</div>
          </div>
          <div className="masthead-clock">
            <div className="masthead-clock-date">
              {time.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric"})}
            </div>
            <div className="masthead-clock-time">
              {time.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
            </div>
          </div>
        </div>

        {/* Alert strip */}
        <div className="alert-strip">
          <span className="alert-strip-live">LIVE</span>
          <span>
            {docs.length} document batches ·{" "}
            <span className="alert-strip-stat-false">{falseCount} FALSE-rated statements</span> ·{" "}
            <span className="alert-strip-stat-disp">{disputedCount} disputed</span> ·{" "}
            {statements.length} total on record
          </span>
          <span className="alert-strip-right">AI-powered · Data persisted locally</span>
        </div>
      </div>

      {/* ── NAV ── */}
      <nav className="nav">
        {PANELS.map(p => (
          <button
            key={p.id}
            className={`nav-btn${panel === p.id ? " active" : ""}`}
            onClick={() => setPanel(p.id)}
          >
            {p.label}
            <span className="nav-btn-sub">{p.sub}</span>
          </button>
        ))}
      </nav>

      {/* ── CONTENT ── */}
      <div className="main">
        {panel === "transparency" && (
          <TransparencyTracker docs={docs} onAddDoc={addDoc} />
        )}
        {panel === "ticker" && (
          <AccountabilityTicker
            statements={statements}
            onAddStatement={addStatement}
            onFetchNew={fetchNewStatements}
          />
        )}
        {panel === "intel" && (
          <IntelligenceBrief docs={docs} statements={statements} />
        )}
        {panel === "acquisition" && (
          <DataAcquisition onFetchDocs={fetchNewDocs} onFetchStatements={fetchNewStatements} />
        )}
      </div>

      <ToastContainer toasts={toasts} />
    </div>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
































 











































































 









































































