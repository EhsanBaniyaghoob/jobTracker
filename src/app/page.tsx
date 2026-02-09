"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Status = "SAVED" | "APPLIED" | "INTERVIEW" | "OFFER" | "REJECTED";

type Job = {
  id: string;
  company: string;
  role: string;
  status: Status;
  location?: string | null;
  url?: string | null;
  salary?: string | null;
  notes?: string | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

const COLS: { key: Status; title: string; badgeCls: string }[] = [
  { key: "SAVED", title: "Saved", badgeCls: "badge-saved" },
  { key: "APPLIED", title: "Applied", badgeCls: "badge-applied" },
  { key: "INTERVIEW", title: "Interview", badgeCls: "badge-interview" },
  { key: "OFFER", title: "Offer", badgeCls: "badge-offer" },
  { key: "REJECTED", title: "Rejected", badgeCls: "badge-rejected" },
];

type ToastKind = "success" | "danger" | "warning" | "info";
type ToastMsg = { id: string; kind: ToastKind; title: string; message: string };

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

function toInputDateTimeValue(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Page() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // query controls
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<Status | "ALL">("ALL");
  const [sort, setSort] = useState(
    "updated_desc" as
      | "updated_desc"
      | "updated_asc"
      | "created_desc"
      | "created_asc"
      | "company_asc"
      | "company_desc"
  );

  // add form
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<Status>("APPLIED");

  // DnD state
  const [dragId, setDragId] = useState<string>("");
  const [overCol, setOverCol] = useState<Status | "">("");

  // toasts
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toastTimers = useRef<Record<string, number>>({});

  // edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);

  // confirm delete modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmJob, setConfirmJob] = useState<Job | null>(null);

  function pushToast(kind: ToastKind, title: string, message: string) {
    const id = uid();
    setToasts((prev) => [{ id, kind, title, message }, ...prev].slice(0, 4));

    // auto dismiss
    window.clearTimeout(toastTimers.current[id]);
    toastTimers.current[id] = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete toastTimers.current[id];
    }, 3500);
  }

  function dismissToast(id: string) {
    window.clearTimeout(toastTimers.current[id]);
    delete toastTimers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  async function loadJobs() {
    setLoading(true);
    setErrorMsg("");

    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (filterStatus !== "ALL") params.set("status", filterStatus);
    params.set("sort", sort);

    const res = await fetch(`/api/jobs?${params.toString()}`, { cache: "no-store" });

    if (!res.ok) {
      const t = await res.text();
      console.error("Failed to load jobs:", t);
      setJobs([]);
      setErrorMsg("Failed to load jobs. Check your API route and database connection.");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setJobs(Array.isArray(data?.jobs) ? data.jobs : []);
    setLoading(false);
  }

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload when query controls change (debounced)
  useEffect(() => {
    const t = window.setTimeout(() => {
      loadJobs();
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filterStatus, sort]);

  const grouped = useMemo(() => {
    const m = new Map<Status, Job[]>();
    for (const c of COLS) m.set(c.key, []);
    for (const j of jobs) m.get(j.status)?.push(j);
    return m;
  }, [jobs]);

  const stats = useMemo(() => {
    const counts: Record<Status, number> = {
      SAVED: 0,
      APPLIED: 0,
      INTERVIEW: 0,
      OFFER: 0,
      REJECTED: 0,
    };
    for (const j of jobs) counts[j.status]++;

    const applied = counts.APPLIED;
    const interview = counts.INTERVIEW;
    const rate = applied > 0 ? Math.round((interview / applied) * 100) : 0;

    return { counts, total: jobs.length, interviewRate: rate };
  }, [jobs]);

  async function addJob() {
    const c = company.trim();
    const r = role.trim();
    if (!c || !r) {
      pushToast("warning", "Missing info", "Please enter company and role.");
      return;
    }

    setBusy(true);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: c,
        role: r,
        status,
        notes: notes.trim() || null,
      }),
    });

    if (!res.ok) {
      pushToast("danger", "Failed", "Could not add job. Please try again.");
      setBusy(false);
      return;
    }

    setCompany("");
    setRole("");
    setNotes("");
    setStatus("APPLIED");
    pushToast("success", "Added", "Job added successfully.");
    await loadJobs();
    setBusy(false);
  }

  function onDragStart(id: string) {
    setDragId(id);
    // add dragging class via attribute on card (handled by CSS with [data-dragging="1"])
  }

  async function moveJob(id: string, newStatus: Status) {
    // optimistic update with rollback
    const prev = jobs;
    setJobs((p) => p.map((j) => (j.id === id ? { ...j, status: newStatus } : j)));

    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) {
      setJobs(prev);
      pushToast("danger", "Failed", "Could not move job. Please try again.");
      return;
    }

    pushToast("success", "Updated", `Moved to ${newStatus}.`);
  }

  function onDrop(col: Status) {
    if (!dragId) return;
    moveJob(dragId, col);
    setDragId("");
    setOverCol("");
  }

  function openEdit(job: Job) {
    setEditJob(job);
    setEditOpen(true);
  }

  async function saveEdit(updated: Partial<Job>) {
    if (!editJob) return;
    setBusy(true);

    const res = await fetch(`/api/jobs/${editJob.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });

    if (!res.ok) {
      pushToast("danger", "Failed", "Could not save changes.");
      setBusy(false);
      return;
    }

    setEditOpen(false);
    setEditJob(null);
    pushToast("success", "Saved", "Job updated.");
    await loadJobs();
    setBusy(false);
  }

  function askDelete(job: Job) {
    setConfirmJob(job);
    setConfirmOpen(true);
  }

  async function confirmDelete() {
    if (!confirmJob) return;
    setBusy(true);

    const res = await fetch(`/api/jobs/${confirmJob.id}`, { method: "DELETE" });

    if (!res.ok) {
      pushToast("danger", "Failed", "Could not delete job.");
      setBusy(false);
      return;
    }

    setConfirmOpen(false);
    setConfirmJob(null);
    pushToast("success", "Deleted", "Job deleted.");
    await loadJobs();
    setBusy(false);
  }

  async function seedDemo() {
    if (process.env.NODE_ENV === "production") return;
    setBusy(true);

    const samples = [
      { company: "IONOS", role: "Junior Web Developer", status: "APPLIED", notes: "Applied via careers page." },
      { company: "BBC", role: "Frontend Developer", status: "SAVED", notes: "Tailor CV + cover letter." },
      { company: "Autotrader", role: "Software Engineer", status: "INTERVIEW", notes: "Prep: React + APIs." },
    ];

    for (const s of samples) {
      // eslint-disable-next-line no-await-in-loop
      await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
    }

    pushToast("info", "Seeded", "Added sample jobs for demo.");
    await loadJobs();
    setBusy(false);
  }

  const showSeed = process.env.NODE_ENV !== "production";

  return (
    <main className="app-shell">
      {/* Toasts */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-card toast-${t.kind}`}>
            <div className="d-flex justify-content-between gap-3">
              <div>
                <div className="toast-title">{t.title}</div>
                <div className="toast-msg">{t.message}</div>
              </div>
              <button className="btn btn-sm btn-soft" type="button" onClick={() => dismissToast(t.id)}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Top card */}
      <div className="hero-card p-4 mb-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <h1 className="h3 fw-bold mb-0">Job Application Tracker</h1>
              <span className="kbd-pill">Kanban + SQLite</span>
              <span className="kbd-pill kbd-soft">Search • Edit • Stats</span>
            </div>
            <div className="text-muted">
              Track applications, drag cards between stages, keep notes — simple and clean.
            </div>
          </div>

          <div className="d-flex gap-2 align-items-center flex-wrap">
            <span className="count-pill">{loading ? "Loading…" : `${stats.total} total`}</span>
            <button className="btn btn-soft" onClick={loadJobs} type="button" disabled={busy}>
              Refresh
            </button>
            {showSeed ? (
              <button className="btn btn-soft" onClick={seedDemo} type="button" disabled={busy}>
                Add sample jobs
              </button>
            ) : null}
          </div>
        </div>

        {/* Stats row */}
        <div className="stats-row mb-3">
          <div className="stat">
            <div className="stat-label">Saved</div>
            <div className="stat-value">{stats.counts.SAVED}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Applied</div>
            <div className="stat-value">{stats.counts.APPLIED}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Interview</div>
            <div className="stat-value">{stats.counts.INTERVIEW}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Offer</div>
            <div className="stat-value">{stats.counts.OFFER}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Rejected</div>
            <div className="stat-value">{stats.counts.REJECTED}</div>
          </div>
          <div className="stat stat-wide">
            <div className="stat-label">Interview rate (vs applied)</div>
            <div className="stat-value">{stats.interviewRate}%</div>
          </div>
        </div>

        {/* Search / filter / sort */}
        <div className="row g-2 mb-3">
          <div className="col-md-6">
            <label className="form-label fw-semibold text-muted">Search</label>
            <input
              className="form-control"
              placeholder="Search company, role, notes, next action…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="col-md-3">
            <label className="form-label fw-semibold text-muted">Filter</label>
            <select
              className="form-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as Status | "ALL")}
            >
              <option value="ALL">All statuses</option>
              {COLS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-3">
            <label className="form-label fw-semibold text-muted">Sort</label>
            <select className="form-select" value={sort} onChange={(e) => setSort(e.target.value as any)}>
              <option value="updated_desc">Updated (newest)</option>
              <option value="updated_asc">Updated (oldest)</option>
              <option value="created_desc">Created (newest)</option>
              <option value="created_asc">Created (oldest)</option>
              <option value="company_asc">Company (A–Z)</option>
              <option value="company_desc">Company (Z–A)</option>
            </select>
          </div>
        </div>

        {/* Add job */}
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label fw-semibold text-muted">Company</label>
            <input
              className="form-control"
              placeholder="e.g. IONOS"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="col-md-4">
            <label className="form-label fw-semibold text-muted">Role</label>
            <input
              className="form-control"
              placeholder="e.g. Junior Web Developer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="col-md-2">
            <label className="form-label fw-semibold text-muted">Stage</label>
            <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as Status)} disabled={busy}>
              {COLS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-2 d-grid">
            <button className="btn btn-accent" type="button" onClick={addJob} disabled={busy}>
              {busy ? "Working…" : "Add job"}
            </button>
          </div>

          <div className="col-12">
            <label className="form-label fw-semibold text-muted">Notes (optional)</label>
            <input
              className="form-control"
              placeholder="e.g. Referral from LinkedIn, applied via careers page…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={busy}
            />
            <div className="small-help mt-2">
              Tip: drag cards between columns. Click a card to edit.
            </div>
          </div>
        </div>

        {errorMsg ? (
          <div className="alert alert-danger mt-3 mb-0">
            <strong>Oops.</strong> {errorMsg}
          </div>
        ) : null}
      </div>

      {/* Kanban */}
      <div className="kanban">
        {COLS.map((col) => {
          const list = grouped.get(col.key) ?? [];
          const isOver = overCol === col.key;

          return (
            <section
              key={col.key}
              className={`kanban-col ${isOver ? "kanban-drop-active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(col.key);
              }}
              onDragLeave={() => setOverCol("")}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(col.key);
              }}
            >
              <div className="kanban-col-header">
                <div className="col-title">{col.title}</div>
                <span className="count-pill">{list.length}</span>
              </div>

              {loading ? (
                <div className="d-grid gap-2 mt-2">
                  <div className="skeleton-card" />
                  <div className="skeleton-card" />
                  <div className="skeleton-card" />
                </div>
              ) : list.length === 0 ? (
                <div className="text-muted small mt-2">No jobs here yet.</div>
              ) : (
                list.map((job) => (
                  <article
                    key={job.id}
                    className="job-card"
                    draggable
                    data-dragging={dragId === job.id ? "1" : "0"}
                    onDragStart={() => onDragStart(job.id)}
                    onDragEnd={() => setDragId("")}
                    onClick={() => openEdit(job)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") openEdit(job);
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div className="me-2">
                        <div className="job-title">{job.role}</div>
                        <div className="job-meta">{job.company}</div>
                        {job.location ? <div className="job-meta mt-1">📍 {job.location}</div> : null}
                      </div>

                      <span className={`badge badge-status ${col.badgeCls}`}>{col.title}</span>
                    </div>

                    {job.notes ? <div className="job-meta mt-2">{job.notes}</div> : null}

                    {job.nextAction ? (
                      <div className="next-action mt-2">
                        <div className="next-action-label">Next</div>
                        <div className="next-action-text">
                          {job.nextAction}
                          {job.nextActionAt ? ` • ${fmtDate(job.nextActionAt)}` : ""}
                        </div>
                      </div>
                    ) : null}

                    <div className="d-flex justify-content-between align-items-center mt-3">
                      <div className="text-muted small">Created {fmtDate(job.createdAt)}</div>

                      <button
                        className="btn btn-soft btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          askDelete(job);
                        }}
                        type="button"
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              )}
            </section>
          );
        })}
      </div>

      {/* Edit modal (controlled) */}
      {editOpen && editJob ? (
        <div className="modal-backdrop-lite" onClick={() => !busy && setEditOpen(false)} role="presentation">
          <div className="modal-lite" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <div className="modal-title-lite">Edit job</div>
                <div className="text-muted small">Update details, stage and notes.</div>
              </div>
              <button className="btn btn-soft btn-sm" onClick={() => setEditOpen(false)} disabled={busy} type="button">
                ✕
              </button>
            </div>

            <EditForm
              job={editJob}
              disabled={busy}
              onCancel={() => setEditOpen(false)}
              onSave={saveEdit}
            />
          </div>
        </div>
      ) : null}

      {/* Confirm delete modal */}
      {confirmOpen && confirmJob ? (
        <div className="modal-backdrop-lite" onClick={() => !busy && setConfirmOpen(false)} role="presentation">
          <div className="modal-lite" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <div className="modal-title-lite">Delete job?</div>
                <div className="text-muted small">
                  This will permanently delete <strong>{confirmJob.company}</strong> — {confirmJob.role}.
                </div>
              </div>
              <button className="btn btn-soft btn-sm" onClick={() => setConfirmOpen(false)} disabled={busy} type="button">
                ✕
              </button>
            </div>

            <div className="d-flex gap-2 justify-content-end">
              <button className="btn btn-soft" type="button" onClick={() => setConfirmOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-danger" type="button" onClick={confirmDelete} disabled={busy}>
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function EditForm({
  job,
  disabled,
  onCancel,
  onSave,
}: {
  job: Job;
  disabled: boolean;
  onCancel: () => void;
  onSave: (updated: Partial<Job>) => Promise<void>;
}) {
  const [company, setCompany] = useState(job.company);
  const [role, setRole] = useState(job.role);
  const [status, setStatus] = useState<Status>(job.status);
  const [location, setLocation] = useState(job.location ?? "");
  const [url, setUrl] = useState(job.url ?? "");
  const [salary, setSalary] = useState(job.salary ?? "");
  const [notes, setNotes] = useState(job.notes ?? "");
  const [nextAction, setNextAction] = useState(job.nextAction ?? "");
  const [nextActionAt, setNextActionAt] = useState(toInputDateTimeValue(job.nextActionAt));

  async function submit() {
    await onSave({
      company: company.trim(),
      role: role.trim(),
      status,
      location: location.trim() || null,
      url: url.trim() || null,
      salary: salary.trim() || null,
      notes: notes.trim() || null,
      nextAction: nextAction.trim() || null,
      nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : null,
    });
  }

  return (
    <>
      <div className="row g-2">
        <div className="col-md-6">
          <label className="form-label fw-semibold text-muted">Company</label>
          <input className="form-control" value={company} onChange={(e) => setCompany(e.target.value)} disabled={disabled} />
        </div>

        <div className="col-md-6">
          <label className="form-label fw-semibold text-muted">Role</label>
          <input className="form-control" value={role} onChange={(e) => setRole(e.target.value)} disabled={disabled} />
        </div>

        <div className="col-md-6">
          <label className="form-label fw-semibold text-muted">Stage</label>
          <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as Status)} disabled={disabled}>
            {COLS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-6">
          <label className="form-label fw-semibold text-muted">Location</label>
          <input className="form-control" value={location} onChange={(e) => setLocation(e.target.value)} disabled={disabled} />
        </div>

        <div className="col-md-6">
          <label className="form-label fw-semibold text-muted">URL</label>
          <input className="form-control" value={url} onChange={(e) => setUrl(e.target.value)} disabled={disabled} />
        </div>

        <div className="col-md-6">
          <label className="form-label fw-semibold text-muted">Salary</label>
          <input className="form-control" value={salary} onChange={(e) => setSalary(e.target.value)} disabled={disabled} />
        </div>

        <div className="col-12">
          <label className="form-label fw-semibold text-muted">Notes</label>
          <textarea className="form-control" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={disabled} />
        </div>

        <div className="col-md-6">
          <label className="form-label fw-semibold text-muted">Next action</label>
          <input className="form-control" value={nextAction} onChange={(e) => setNextAction(e.target.value)} disabled={disabled} />
        </div>

        <div className="col-md-6">
          <label className="form-label fw-semibold text-muted">Next action date/time</label>
          <input
            type="datetime-local"
            className="form-control"
            value={nextActionAt}
            onChange={(e) => setNextActionAt(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="d-flex gap-2 justify-content-end mt-3">
        <button className="btn btn-soft" type="button" onClick={onCancel} disabled={disabled}>
          Cancel
        </button>
        <button className="btn btn-accent" type="button" onClick={submit} disabled={disabled}>
          {disabled ? "Saving…" : "Save changes"}
        </button>
      </div>
    </>
  );
}