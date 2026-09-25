"use client";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Cloud,
  Download,
  ExternalLink,
  FileText,
  Folder,
  Heart,
  History,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Pill,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Users,
  X,
} from "lucide-react";
import BodyMap from "@/components/body-map";
import {
  both,
  canEdit,
  demoState,
  driveUrl,
  folderId,
  mergeConditions,
  regionSchema,
  stateSchema,
  type CareState,
  type Condition,
  type Lang,
  type LocalText,
} from "@/lib/model";
import { dictionary, locale, regionLabels } from "@/lib/i18n";
import { parseImport } from "@/lib/import";
type Tab = "overview" | "history" | "files" | "expenses" | "tasks" | "settings";
type Kind =
  | "conditions"
  | "medications"
  | "appointments"
  | "tasks"
  | "expenses"
  | "members";
type Modal = { kind: Kind; id?: string };
const nav = [
  { id: "overview", icon: LayoutDashboard },
  { id: "history", icon: History },
  { id: "files", icon: Folder },
  { id: "expenses", icon: Receipt },
  { id: "tasks", icon: ClipboardList },
  { id: "settings", icon: Settings },
] as const;
function formatDate(value: string, lang: Lang) {
  if (!value) return dictionary[lang].unknownDate;
  return new Intl.DateTimeFormat(locale(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value.slice(0, 10) + "T12:00:00"));
}
export default function Home() {
  const [now, setNow] = useState<Date | null>(null);
  const [lang, setLang] = useState<Lang>("en"),
    [tab, setTab] = useState<Tab>("overview"),
    [data, setData] = useState<CareState>(demoState),
    [mode, setMode] = useState("loading"),
    [role, setRole] = useState("owner"),
    [configured, setConfigured] = useState(false),
    [google, setGoogle] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(""),
    [back, setBack] = useState(false),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [modal, setModal] = useState<Modal | null>(null),
    [mobile, setMobile] = useState(false),
    [imports, setImports] = useState<Condition[] | null>(null),
    [importIds, setImportIds] = useState<string[]>([]),
    [folder, setFolder] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    importDialog = useRef<HTMLDialogElement>(null),
    importInput = useRef<HTMLInputElement>(null);
  const t = dictionary[lang];
  const editable = canEdit(role);
  const l = (text: LocalText) => text[lang] || text.en || text.el;
  useEffect(() => {
    setNow(new Date());
    const saved = localStorage.getItem("mazi-language");
    if (saved === "el") setLang("el");
    const url = new URL(location.href);
    if (url.searchParams.has("auth"))
      setError(
        url.searchParams.get("auth") === "denied"
          ? "This Google account has not been added to the family. / Ο λογαριασμός δεν έχει προστεθεί στην οικογένεια."
          : "Google sign-in failed. / Η σύνδεση Google απέτυχε.",
      );
    if (url.searchParams.has("setup")) {
      setTab("settings");
      setMessage(
        "Google OAuth setup required / Απαιτείται ρύθμιση Google OAuth",
      );
    }
    fetch("/api/state", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            "Unable to load private workspace / Αδυναμία φόρτωσης ιδιωτικού χώρου",
          );
        return r.json();
      })
      .then((r) => {
        setMode(r.mode);
        setConfigured(r.configured);
        setRole(r.role || "owner");
        setGoogle(r.googleConnected || false);
        if (r.state) {
          setData(stateSchema.parse(r.state));
          setFolder(
            r.state.driveFolder
              ? `https://drive.google.com/drive/folders/${r.state.driveFolder}`
              : "",
          );
        }
      })
      .catch((e) => {
        setMode("error");
        setError(e.message);
      });
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("mazi-language", lang);
  }, [lang]);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  useEffect(() => {
    if (imports) importDialog.current?.showModal();
    else importDialog.current?.close();
  }, [imports]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4500);
    return () => clearTimeout(timer);
  }, [message]);
  function navigate(next: Tab) {
    setTab(next);
    setFilter("all");
    setQuery("");
    setMobile(false);
  }
  async function persist(next: CareState) {
    if (!editable || busy) return false;
    setError("");
    setBusy(true);
    try {
      const valid = stateSchema.parse(next);
      if (mode === "demo") {
        setData(valid);
        setMessage(t.saved);
        return true;
      }
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valid),
      });
      if (!response.ok)
        throw new Error(response.status === 409 ? t.conflict : t.error);
      const result = await response.json();
      setData(result.state);
      setMessage(t.saved);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function add(kind: Kind) {
    setModal({ kind });
  }
  async function remove(kind: Kind, id: string) {
    if (!confirm(t.deleteConfirm)) return;
    const next = { ...data, [kind]: data[kind].filter((x) => x.id !== id) };
    if (await persist(next)) setModal(null);
  }
  async function toggle(kind: "tasks" | "appointments", id: string) {
    await persist({
      ...data,
      [kind]: data[kind].map((x) =>
        x.id === id ? { ...x, done: !x.done } : x,
      ),
    });
  }
  async function refresh() {
    if (!google) {
      setError(t.refreshNeeded);
      navigate("settings");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/drive", { method: "POST" });
      if (!r.ok)
        throw new Error(
          r.status === 409
            ? t.conflict
            : r.status === 401
              ? t.refreshNeeded
              : t.error,
        );
      setData((await r.json()).state);
      setMessage(t.saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "mazi-private-care.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2000000) throw new Error(t.error);
      const rows = parseImport(JSON.parse(await file.text()));
      if (!rows.length) throw new Error(t.noImport);
      setImports(rows);
      setImportIds(
        rows
          .filter((c) => !data.conditions.some((v) => v.id === c.id))
          .map((c) => c.id),
      );
    } catch (e) {
      setError(
        e instanceof Error && e.message === t.noImport ? t.noImport : t.error,
      );
    }
    if (importInput.current) importInput.current.value = "";
  }
  const today =
    now?.toLocaleDateString("en-CA", { timeZone: "Europe/Athens" }) || "";
  const upcoming = data.appointments
    .filter((a) => !a.done && (!a.date || a.date >= today))
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const selectedCondition =
    data.conditions.find((c) => c.id === selected) || data.conditions[0];
  const total = data.expenses.reduce((s, e) => s + e.amount, 0);
  const unsettled = data.expenses
    .filter((e) => !e.settled)
    .reduce((s, e) => s + e.amount, 0);
  const money = (n: number) =>
    new Intl.NumberFormat(locale(lang), {
      style: "currency",
      currency: "EUR",
    }).format(n);
  function Empty({
    icon: Icon,
    title,
    description,
  }: {
    icon: typeof Heart;
    title: string;
    description?: string;
  }) {
    return (
      <div className="empty">
        <Icon size={28} />
        <p>{title}</p>
        {description && <span>{description}</span>}
      </div>
    );
  }
  function AddButton({ kind, label }: { kind: Kind; label: string }) {
    return editable ? (
      <button className="btn small" onClick={() => add(kind)} disabled={busy}>
        <Plus size={16} />
        {label}
      </button>
    ) : null;
  }
  function Status({ c }: { c: Condition }) {
    return (
      <span className={`badge ${c.status}`}>
        {c.status === "history" ? t.historyStatus : t[c.status]}
      </span>
    );
  }
  function Appointment({ a }: { a: CareState["appointments"][number] }) {
    return (
      <div className="appointment">
        <div className="date-tile">
          <span>
            {a.date
              ? new Intl.DateTimeFormat(locale(lang), {
                  month: "short",
                }).format(new Date(a.date + "T12:00:00"))
              : "—"}
          </span>
          <b>{a.date ? Number(a.date.slice(8)) : ""}</b>
        </div>
        <div className="grow">
          <strong>{l(a.title)}</strong>
          <p>
            {a.date
              ? `${a.time || ""} ${a.location ? "· " + a.location : ""}`
              : t.unscheduled}
          </p>
          {a.member && <small>{a.member}</small>}
        </div>
        {editable && (
          <button
            className="icon-button"
            aria-label={t.edit}
            onClick={() => setModal({ kind: "appointments", id: a.id })}
          >
            <MoreHorizontal size={20} />
          </button>
        )}
      </div>
    );
  }
  function TaskRow({ task }: { task: CareState["tasks"][number] }) {
    return (
      <div className={`task-row ${task.done ? "done" : ""}`}>
        <button
          className="check-button"
          aria-label={task.done ? t.reopen : t.complete}
          aria-pressed={task.done}
          disabled={!editable || busy}
          onClick={() => toggle("tasks", task.id)}
        >
          {task.done && <Check size={15} />}
        </button>
        <div className="grow">
          <strong>{l(task.title)}</strong>
          <p>
            {task.member || t.notSet}
            {task.date ? " · " + formatDate(task.date, lang) : ""}
          </p>
        </div>
        {editable && (
          <button
            className="icon-button"
            aria-label={t.edit}
            onClick={() => setModal({ kind: "tasks", id: task.id })}
          >
            <MoreHorizontal size={19} />
          </button>
        )}
      </div>
    );
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    const f = new FormData(event.currentTarget);
    const val = (k: string) => String(f.get(k) || "");
    const checked = (k: string) => f.get(k) === "on";
    const existing = data[modal.kind].find((x) => x.id === modal.id);
    const id = modal.id || crypto.randomUUID();
    const text = (key: string): LocalText => {
      const old =
        existing &&
        ((existing as unknown as Record<string, unknown>)[key] as
          LocalText | undefined);
      return old ? { ...old, [lang]: val(key) } : both(val(key));
    };
    let row: unknown;
    switch (modal.kind) {
      case "conditions":
        row = {
          id,
          title: text("title"),
          region: val("region"),
          status: val("status"),
          detail: text("detail"),
          date: val("date"),
          source: val("source"),
          sourceId: val("sourceId"),
          verified: checked("verified"),
        };
        break;
      case "medications":
        row = {
          id,
          name: text("name"),
          dose: val("dose"),
          schedule: text("schedule"),
          confirmed: checked("confirmed"),
          active: checked("active"),
        };
        break;
      case "appointments":
        row = {
          id,
          title: text("title"),
          date: val("date"),
          time: val("time"),
          location: val("location"),
          member: val("member"),
          done: checked("done"),
        };
        break;
      case "tasks":
        row = {
          id,
          title: text("title"),
          member: val("member"),
          date: val("date"),
          done: checked("done"),
        };
        break;
      case "expenses":
        row = {
          id,
          title: text("title"),
          amount: Number(val("amount")),
          member: val("member"),
          date: val("date"),
          settled: checked("settled"),
          receiptId: val("receiptId"),
        };
        break;
      case "members":
        row = {
          id,
          name: val("name"),
          email: val("email").trim().toLowerCase(),
          role: val("role"),
        };
        break;
    }
    const next = {
      ...data,
      [modal.kind]: existing
        ? data[modal.kind].map((x) => (x.id === id ? row : x))
        : [...data[modal.kind], row],
    };
    if (await persist(next as CareState)) setModal(null);
  }
  const current = modal
    ? (data[modal.kind].find((x) => x.id === modal.id) as unknown as
        Record<string, unknown> | undefined)
    : undefined;
  const defaultValue = (key: string) => {
    const v = current?.[key];
    return v && typeof v === "object" ? l(v as LocalText) : String(v ?? "");
  };
  function Field({
    name,
    label,
    type = "text",
    required = false,
  }: {
    name: string;
    label: string;
    type?: string;
    required?: boolean;
  }) {
    return (
      <label className="field">
        {label}
        <input
          name={name}
          type={type}
          defaultValue={defaultValue(name)}
          required={required}
          maxLength={500}
          {...(type === "number" ? { min: 0, step: "0.01" } : {})}
        />
      </label>
    );
  }
  function MemberSelect() {
    return (
      <label className="field">
        {t.assigned}
        <select name="member" defaultValue={defaultValue("member")}>
          <option value="">{t.none}</option>
          {data.members.map((m) => (
            <option key={m.id}>{m.name}</option>
          ))}
        </select>
      </label>
    );
  }
  function Checkbox({
    name,
    label,
    defaultChecked = false,
  }: {
    name: string;
    label: string;
    defaultChecked?: boolean;
  }) {
    return (
      <label className="checkbox-label">
        <input
          name={name}
          type="checkbox"
          defaultChecked={current ? Boolean(current[name]) : defaultChecked}
        />
        {label}
      </label>
    );
  }
  const pageTitle = {
    overview: t.healthOverview,
    history: t.fullHistory,
    files: t.files,
    expenses: t.expenses,
    tasks: t.tasks,
    settings: t.settings,
  }[tab];
  const pageSub = {
    overview: t.overviewSub,
    history: t.historySub,
    files: t.filesSub,
    expenses: t.expenseSub,
    tasks: t.tasksSub,
    settings: t.together,
  }[tab];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">
        {lang === "el" ? "Μετάβαση στο περιεχόμενο" : "Skip to content"}
      </a>
      {mobile && (
        <button
          aria-label={t.close}
          className="sidebar-overlay"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "visible" : ""}`}>
        <a className="brand" href="/" aria-label="Mazi">
          <span className="brand-mark">m</span>
          <span>
            mazi<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-label">{t.familySpace}</div>
        <button className="profile-card" onClick={() => navigate("settings")}>
          <span className="profile-icon">
            <Heart size={20} />
          </span>
          <span>
            <strong>{l(data.patient)}</strong>
            <small>{t.together}</small>
          </span>
          <ChevronRight size={16} />
        </button>
        <nav aria-label={t.familySpace}>
          {nav.map(({ id, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? "selected" : ""}`}
              onClick={() => navigate(id)}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{t[id]}</span>
              {id === "tasks" &&
                data.tasks.filter((x) => !x.done).length > 0 && (
                  <span className="nav-count">
                    {data.tasks.filter((x) => !x.done).length}
                  </span>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="family-mini">
            <div className="avatar-stack">
              {data.members.slice(0, 4).map((m, i) => (
                <span
                  key={m.id}
                  className={`avatar tone-${i % 3}`}
                  title={m.name}
                >
                  {m.name.slice(0, 1)}
                </span>
              ))}
            </div>
            <button onClick={() => navigate("settings")}>
              {t.family}
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="sidebar-security">
            <LockKeyhole size={14} />
            {mode === "local"
              ? t.local
              : mode === "private"
                ? t.signedIn
                : t.demo}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label={lang === "el" ? "Μενού" : "Menu"}
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>{t.family}</span>
            <ChevronRight size={14} />
            <strong>{t[tab]}</strong>
          </div>
          <div className="top-actions">
            <div className="language-switch" aria-label={t.language}>
              <button
                aria-pressed={lang === "en"}
                className={lang === "en" ? "selected" : ""}
                onClick={() => setLang("en")}
              >
                EN
              </button>
              <button
                aria-pressed={lang === "el"}
                className={lang === "el" ? "selected" : ""}
                onClick={() => setLang("el")}
              >
                ΕΛ
              </button>
            </div>
            <div className="private-label">
              <ShieldCheck size={16} />
              {mode === "demo"
                ? t.demo
                : mode === "local"
                  ? t.local
                  : t.signedIn}
            </div>
            <span className="avatar top-avatar">
              {mode === "demo" ? "A" : data.members[0]?.name.slice(0, 1) || "M"}
            </span>
          </div>
        </header>
        <main id="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {now
                  ? new Intl.DateTimeFormat(locale(lang), {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      timeZone: "Europe/Athens",
                    }).format(now)
                  : " "}
              </div>
              <h1>{pageTitle}</h1>
              <p>{pageSub}</p>
            </div>
            {tab === "overview" && (
              <AddButton kind="conditions" label={t.addRecord} />
            )}{" "}
            {tab === "history" && (
              <AddButton kind="conditions" label={t.addRecord} />
            )}{" "}
            {tab === "expenses" && (
              <AddButton kind="expenses" label={t.addExpense} />
            )}{" "}
            {tab === "tasks" && <AddButton kind="tasks" label={t.addTask} />}
          </div>
          {mode === "demo" && (
            <div className="notice demo-notice">
              <span>
                <strong>{t.demo}</strong> {t.demoDescription}
              </span>
              <a
                href={configured ? "/api/auth/google" : "#connections"}
                onClick={() => !configured && navigate("settings")}
              >
                {t.signIn}
                <ArrowUpRight size={16} />
              </a>
            </div>
          )}
          {mode === "loading" && (
            <div className="notice" role="status">
              {t.loading}
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label={t.close}
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {message && (
            <div className="toast" role="status">
              <Check size={17} />
              {message}
            </div>
          )}
          {mode !== "error" && mode !== "loading" && (
            <>
              {tab === "overview" && (
                <>
                  <div className="stats-row">
                    <div className="stat">
                      <span className="stat-icon mint">
                        <Activity size={21} />
                      </span>
                      <div>
                        <span>{t.recordedIssues}</span>
                        <strong>
                          {data.conditions.length}
                          <small>{t.recordCount}</small>
                        </strong>
                      </div>
                    </div>
                    <div className="stat">
                      <span className="stat-icon blue">
                        <CalendarDays size={21} />
                      </span>
                      <div>
                        <span>{t.nextAppointment}</span>
                        <strong className="stat-date">
                          {upcoming[0]?.date
                            ? formatDate(upcoming[0].date, lang)
                            : t.notSet}
                        </strong>
                      </div>
                    </div>
                    <div className="stat">
                      <span className="stat-icon peach">
                        <ClipboardList size={21} />
                      </span>
                      <div>
                        <span>{t.family}</span>
                        <strong>
                          {data.tasks.filter((x) => !x.done).length}
                          <small>{t.pendingTasks}</small>
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div className="overview-grid">
                    <section className="card body-card">
                      <div className="card-heading">
                        <div>
                          <h2>{t.bodyMap}</h2>
                          <p>{t.bodyHint}</p>
                        </div>
                        <div className="segmented">
                          <button
                            className={!back ? "selected" : ""}
                            onClick={() => setBack(false)}
                          >
                            {t.front}
                          </button>
                          <button
                            className={back ? "selected" : ""}
                            onClick={() => setBack(true)}
                          >
                            {t.back}
                          </button>
                        </div>
                      </div>
                      <div className="body-content">
                        <BodyMap
                          conditions={data.conditions}
                          selected={selectedCondition?.id || ""}
                          onSelect={setSelected}
                          lang={lang}
                          back={back}
                        />
                        <div className="condition-list">
                          {data.conditions.map((c, i) => (
                            <button
                              key={c.id}
                              className={`condition-item ${selectedCondition?.id === c.id ? "selected" : ""}`}
                              onClick={() => setSelected(c.id)}
                            >
                              <span className={`condition-number ${c.status}`}>
                                {i + 1}
                              </span>
                              <span className="grow">
                                <small>{t[regionLabels[c.region]]}</small>
                                <strong>{l(c.title)}</strong>
                                <Status c={c} />
                              </span>
                              <ChevronRight size={16} />
                            </button>
                          ))}
                          {!data.conditions.length && (
                            <Empty icon={Heart} title={t.noConditions} />
                          )}
                        </div>
                      </div>
                      {selectedCondition && (
                        <div className="condition-detail">
                          <div className="detail-header">
                            <span className="source-tag">
                              <FileText size={14} />
                              {
                                t[
                                  selectedCondition.source === "family"
                                    ? "familyReported"
                                    : selectedCondition.source === "document"
                                      ? "document"
                                      : "myhealth"
                                ]
                              }
                            </span>
                            <span className="review-tag">
                              {selectedCondition.verified
                                ? t.confirmed
                                : t.needsReview}
                            </span>
                            {editable && (
                              <button
                                className="text-button"
                                onClick={() =>
                                  setModal({
                                    kind: "conditions",
                                    id: selectedCondition.id,
                                  })
                                }
                              >
                                {t.edit}
                              </button>
                            )}
                          </div>
                          <p>{l(selectedCondition.detail)}</p>
                          {selectedCondition.sourceId &&
                            data.files.some(
                              (f) => f.id === selectedCondition.sourceId,
                            ) && (
                              <a
                                className="text-link"
                                target="_blank"
                                rel="noreferrer"
                                href={driveUrl(
                                  data.files.find(
                                    (f) => f.id === selectedCondition.sourceId,
                                  )!,
                                )}
                              >
                                {t.linkRecord}
                                <ExternalLink size={14} />
                              </a>
                            )}
                        </div>
                      )}
                    </section>
                    <div className="right-column">
                      <section className="card">
                        <div className="card-heading">
                          <h2>
                            <Pill size={19} />
                            {t.medications}
                          </h2>
                          <button
                            className="icon-button"
                            aria-label={t.addMedication}
                            onClick={() => add("medications")}
                            disabled={!editable}
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                        {!data.medications.filter((m) => m.active).length ? (
                          <Empty
                            icon={Pill}
                            title={t.noMedication}
                            description={t.noMedicationSub}
                          />
                        ) : (
                          <div className="med-list">
                            {data.medications
                              .filter((m) => m.active)
                              .map((m) => (
                                <button
                                  className="medication"
                                  key={m.id}
                                  onClick={() =>
                                    editable &&
                                    setModal({ kind: "medications", id: m.id })
                                  }
                                >
                                  <span className="pill-icon">
                                    <Pill size={19} />
                                  </span>
                                  <span className="grow">
                                    <strong>{l(m.name)}</strong>
                                    <p>
                                      {m.dose || t.notSet} ·{" "}
                                      {l(m.schedule) || t.notSet}
                                    </p>
                                    {!m.confirmed && (
                                      <span className="review-tag">
                                        {t.needsReview}
                                      </span>
                                    )}
                                  </span>
                                </button>
                              ))}
                          </div>
                        )}
                      </section>
                      <section className="card">
                        <div className="card-heading">
                          <h2>
                            <CalendarDays size={19} />
                            {t.upcoming}
                          </h2>
                          <button
                            className="icon-button"
                            aria-label={t.addAppointment}
                            onClick={() => add("appointments")}
                            disabled={!editable}
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                        {upcoming.length ? (
                          upcoming
                            .slice(0, 3)
                            .map((a) => <Appointment a={a} key={a.id} />)
                        ) : (
                          <Empty
                            icon={CalendarDays}
                            title={t.noAppointments}
                            description={t.noAppointmentsSub}
                          />
                        )}
                      </section>
                      <div className="care-note">
                        <ShieldCheck size={21} />
                        <div>
                          <strong>{t.unconfirmed}</strong>
                          <p>{t.sourceReview}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <section className="card below-card">
                    <div className="card-heading">
                      <h2>{t.tasks}</h2>
                      <button
                        className="text-button"
                        onClick={() => navigate("tasks")}
                      >
                        {t.viewAll}
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    {data.tasks
                      .filter((x) => !x.done)
                      .slice(0, 3)
                      .map((task) => (
                        <TaskRow key={task.id} task={task} />
                      ))}
                    {!data.tasks.filter((x) => !x.done).length && (
                      <Empty icon={ClipboardList} title={t.noTasks} />
                    )}
                  </section>
                </>
              )}
              {tab === "history" && (
                <>
                  <div className="filter-bar">
                    <div className="segmented">
                      {["all", "active", "planned", "history"].map((f) => (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className={filter === f ? "selected" : ""}
                        >
                          {f === "history"
                            ? t.historyStatus
                            : t[f as "all" | "active" | "planned"]}
                        </button>
                      ))}
                    </div>
                    <span>{t.dateFilter}</span>
                  </div>
                  <div className="timeline">
                    {data.conditions
                      .filter((c) => filter === "all" || c.status === filter)
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((c) => (
                        <article className="timeline-row" key={c.id}>
                          <div className="timeline-date">
                            {formatDate(c.date, lang)}
                          </div>
                          <div className="timeline-dot" />
                          <div className="card timeline-card">
                            <div className="card-heading">
                              <h2>{l(c.title)}</h2>
                              <Status c={c} />
                            </div>
                            <p>{l(c.detail)}</p>
                            <div className="timeline-footer">
                              <span>
                                {t[regionLabels[c.region]]} ·{" "}
                                {c.verified ? t.confirmed : t.needsReview}
                              </span>
                              {editable && (
                                <button
                                  className="text-button"
                                  onClick={() =>
                                    setModal({ kind: "conditions", id: c.id })
                                  }
                                >
                                  {t.edit}
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                  </div>
                  {!data.conditions.length && (
                    <Empty icon={History} title={t.noConditions} />
                  )}
                  <section className="card below-card">
                    <div className="card-heading">
                      <h2>{t.medications}</h2>
                      <AddButton kind="medications" label={t.addMedication} />
                    </div>
                    {data.medications.map((m) => (
                      <div className="list-row" key={m.id}>
                        <Pill size={20} />
                        <div className="grow">
                          <strong>{l(m.name)}</strong>
                          <p>
                            {m.dose} · {l(m.schedule)} ·{" "}
                            {m.active ? t.active : t.historyStatus}
                          </p>
                        </div>
                        {editable && (
                          <button
                            className="text-button"
                            onClick={() =>
                              setModal({ kind: "medications", id: m.id })
                            }
                          >
                            {t.edit}
                          </button>
                        )}
                      </div>
                    ))}
                  </section>
                  <section className="card below-card">
                    <div className="card-heading">
                      <h2>{t.upcoming}</h2>
                      <AddButton kind="appointments" label={t.addAppointment} />
                    </div>
                    {data.appointments
                      .filter((a) => !a.done)
                      .map((a) => (
                        <Appointment key={a.id} a={a} />
                      ))}
                    <details className="past-appointments">
                      <summary>{t.previous}</summary>
                      {data.appointments
                        .filter((a) => a.done)
                        .map((a) => (
                          <Appointment key={a.id} a={a} />
                        ))}
                    </details>
                  </section>
                </>
              )}
              {tab === "files" && (
                <>
                  <div className="file-toolbar">
                    <label className="search">
                      <Search size={18} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t.searchFiles}
                        aria-label={t.searchFiles}
                      />
                    </label>
                    <button
                      className="btn"
                      disabled={busy || !editable}
                      onClick={refresh}
                    >
                      <RefreshCw size={17} className={busy ? "spin" : ""} />
                      {t.sync}
                    </button>
                    {data.driveFolder && (
                      <a
                        className="btn"
                        target="_blank"
                        rel="noreferrer"
                        href={driveUrl({
                          id: data.driveFolder,
                          mimeType: "application/vnd.google-apps.folder",
                        })}
                      >
                        {t.openDrive}
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                  <div className="file-info">
                    <span>
                      <Cloud size={16} />
                      Google Drive · {data.files.length} {t.fileCount}
                    </span>
                    <span>
                      {data.driveIndexedAt
                        ? `${t.indexDate}: ${formatDate(data.driveIndexedAt, lang)}`
                        : t.notConnected}
                    </span>
                  </div>
                  <div className="card file-list">
                    {data.files
                      .filter((f) =>
                        (f.name + " " + f.path)
                          .toLocaleLowerCase()
                          .includes(query.toLocaleLowerCase()),
                      )
                      .map((f) => (
                        <a
                          className="file-row"
                          key={f.id}
                          href={driveUrl(f)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span
                            className={`file-icon ${f.mimeType.includes("folder") ? "folder-icon" : ""}`}
                          >
                            {f.mimeType.includes("folder") ? (
                              <Folder size={22} />
                            ) : (
                              <FileText size={22} />
                            )}
                          </span>
                          <span className="grow">
                            <strong>{f.name}</strong>
                            <small>{f.path || "Google Drive"}</small>
                          </span>
                          <span className="file-date">
                            {f.modifiedTime
                              ? formatDate(f.modifiedTime, lang)
                              : ""}
                          </span>
                          <ArrowUpRight size={19} />
                        </a>
                      ))}
                    {!data.files.length ? (
                      <Empty
                        icon={Folder}
                        title={t.emptyFiles}
                        description={t.connectFiles}
                      />
                    ) : (
                      !data.files.some((f) =>
                        (f.name + " " + f.path)
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      ) && <Empty icon={Search} title={t.noMatch} />
                    )}
                  </div>
                </>
              )}
              {tab === "expenses" && (
                <>
                  <div className="stats-row financial-stats">
                    <div className="stat">
                      <div>
                        <span>{t.total}</span>
                        <strong>{money(total)}</strong>
                      </div>
                    </div>
                    <div className="stat">
                      <div>
                        <span>{t.pending}</span>
                        <strong>{money(unsettled)}</strong>
                      </div>
                    </div>
                    <div className="stat">
                      <div>
                        <span>{t.paid}</span>
                        <strong>{money(total - unsettled)}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{t.title}</th>
                            <th>{t.date}</th>
                            <th>{t.paidBy}</th>
                            <th>{t.status}</th>
                            <th>{t.amount}</th>
                            <th>
                              <span className="sr-only">{t.edit}</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.expenses.map((e) => (
                            <tr key={e.id}>
                              <td>
                                <strong>{l(e.title)}</strong>
                                {e.receiptId && (
                                  <a
                                    className="text-link"
                                    target="_blank"
                                    rel="noreferrer"
                                    href={driveUrl({ id: e.receiptId })}
                                  >
                                    {t.receipt}
                                    <ExternalLink size={13} />
                                  </a>
                                )}
                              </td>
                              <td>{formatDate(e.date, lang)}</td>
                              <td>{e.member || "—"}</td>
                              <td>
                                <span
                                  className={`badge ${e.settled ? "history" : "planned"}`}
                                >
                                  {e.settled ? t.settled : t.outstanding}
                                </span>
                              </td>
                              <td className="amount">{money(e.amount)}</td>
                              <td>
                                {editable && (
                                  <button
                                    className="icon-button"
                                    aria-label={t.edit}
                                    onClick={() =>
                                      setModal({ kind: "expenses", id: e.id })
                                    }
                                  >
                                    <MoreHorizontal size={19} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!data.expenses.length && (
                      <Empty icon={Receipt} title={t.noExpenses} />
                    )}
                  </div>
                  <div className="member-totals">
                    {data.members.map((m, i) => (
                      <div className="card member-total" key={m.id}>
                        <span className={`avatar tone-${i % 3}`}>
                          {m.name[0]}
                        </span>
                        <span className="grow">{m.name}</span>
                        <strong>
                          {money(
                            data.expenses
                              .filter((e) => e.member === m.name)
                              .reduce((s, e) => s + e.amount, 0),
                          )}
                        </strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {tab === "tasks" && (
                <>
                  <div className="filter-bar">
                    <div className="segmented">
                      {[
                        "all",
                        "open",
                        "completed",
                        ...data.members.map((m) => m.name),
                      ].map((f) => (
                        <button
                          key={f}
                          className={filter === f ? "selected" : ""}
                          onClick={() => setFilter(f)}
                        >
                          {f === "all" || f === "open" || f === "completed"
                            ? t[f]
                            : f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="card tasks-card">
                    {data.tasks
                      .filter(
                        (v) =>
                          filter === "all" ||
                          (filter === "open" && !v.done) ||
                          (filter === "completed" && v.done) ||
                          v.member === filter,
                      )
                      .map((task) => (
                        <TaskRow task={task} key={task.id} />
                      ))}
                    {!data.tasks.filter(
                      (v) =>
                        filter === "all" ||
                        (filter === "open" && !v.done) ||
                        (filter === "completed" && v.done) ||
                        v.member === filter,
                    ).length && (
                      <Empty icon={ClipboardList} title={t.noTasks} />
                    )}
                  </div>
                </>
              )}
              {tab === "settings" && (
                <div className="settings-grid">
                  <div className="settings-primary">
                    <section className="card" id="connections">
                      <div className="card-heading">
                        <h2>
                          <Link2 size={19} />
                          {t.connections}
                        </h2>
                      </div>
                      <div className="connection">
                        <div className="connection-title">
                          <span className="connection-icon">
                            <Cloud size={24} />
                          </span>
                          <div className="grow">
                            <h3>{t.googleDrive}</h3>
                            <span
                              className={`badge ${google ? "history" : "planned"}`}
                            >
                              {google ? t.confirmed : t.notConnected}
                            </span>
                          </div>
                        </div>
                        <p>{t.driveDescription}</p>
                        <label className="field">
                          {t.folder}
                          <input
                            value={folder}
                            onChange={(e) => setFolder(e.target.value)}
                            placeholder="https://drive.google.com/drive/folders/…"
                            disabled={role !== "owner"}
                          />
                        </label>
                        <div className="button-row">
                          <button
                            className="btn"
                            disabled={busy || role !== "owner"}
                            onClick={() => {
                              try {
                                const id = folderId(folder);
                                persist({
                                  ...data,
                                  driveFolder: id,
                                  ...(id === data.driveFolder
                                    ? {}
                                    : { files: [], driveIndexedAt: "" }),
                                });
                              } catch {
                                setError(
                                  lang === "el"
                                    ? "Μη έγκυρος σύνδεσμος φακέλου."
                                    : "Invalid folder link.",
                                );
                              }
                            }}
                          >
                            {t.saveFolder}
                          </button>
                          {configured ? (
                            <a className="btn primary" href="/api/auth/google">
                              {t.googleConnect}
                              <ArrowUpRight size={15} />
                            </a>
                          ) : (
                            <span className="setup-hint">{t.setup}</span>
                          )}
                        </div>
                        {!configured && (
                          <p className="help-text">{t.setupText}</p>
                        )}
                      </div>
                      <div className="connection">
                        <div className="connection-title">
                          <span className="connection-icon blue">
                            <Activity size={24} />
                          </span>
                          <div>
                            <h3>
                              MyHealth <span className="subtle">Ελλάδα</span>
                            </h3>
                            <span className="badge planned">
                              {t.apiPending}
                            </span>
                          </div>
                        </div>
                        <p>{t.myhealthDescription}</p>
                        <div className="button-row">
                          <button
                            className="btn"
                            disabled={!editable}
                            onClick={() => importInput.current?.click()}
                          >
                            <Download size={16} />
                            {t.importRecords}
                          </button>
                          <a
                            className="text-link"
                            href="https://ehealthrecord.gov.gr/"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t.openMyhealth}
                            <ExternalLink size={15} />
                          </a>
                        </div>
                        <p className="help-text">{t.importHelp}</p>
                        <input
                          className="sr-only"
                          ref={importInput}
                          type="file"
                          accept="application/json,.json"
                          aria-label={t.chooseImport}
                          onChange={(e) => importFile(e.target.files?.[0])}
                        />
                      </div>
                    </section>
                    <section className="card">
                      <div className="card-heading">
                        <h2>
                          <Users size={19} />
                          {t.family}
                        </h2>
                        {role === "owner" && (
                          <AddButton kind="members" label={t.addMember} />
                        )}
                      </div>
                      <p className="section-description">
                        {t.familyDescription}
                      </p>
                      {data.members.map((m, i) => (
                        <div className="member-row" key={m.id}>
                          <span className={`avatar tone-${i % 3}`}>
                            {m.name[0]}
                          </span>
                          <div className="grow">
                            <strong>{m.name}</strong>
                            <small>{m.email || t.accessPending}</small>
                          </div>
                          <span className="badge">{t[m.role]}</span>
                          {role === "owner" && (
                            <button
                              className="icon-button"
                              aria-label={t.edit}
                              onClick={() =>
                                setModal({ kind: "members", id: m.id })
                              }
                            >
                              <MoreHorizontal size={20} />
                            </button>
                          )}
                        </div>
                      ))}
                    </section>
                  </div>
                  <div className="settings-secondary">
                    <section className="card">
                      <div className="card-heading">
                        <h2>{t.preferences}</h2>
                      </div>
                      <div className="settings-fields">
                        <label className="field">
                          {t.language}
                          <select
                            value={lang}
                            onChange={(e) => setLang(e.target.value as Lang)}
                          >
                            <option value="en">English</option>
                            <option value="el">Ελληνικά</option>
                          </select>
                        </label>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const value = String(
                              new FormData(e.currentTarget).get("patient") ||
                                "",
                            );
                            if (value.trim())
                              persist({ ...data, patient: both(value) });
                          }}
                        >
                          <label className="field">
                            {t.patient}
                            <input
                              key={l(data.patient)}
                              name="patient"
                              defaultValue={l(data.patient)}
                              maxLength={100}
                              required
                              disabled={!editable}
                            />
                          </label>
                          <button className="btn" disabled={!editable || busy}>
                            {t.save}
                          </button>
                        </form>
                        <hr />
                        <button className="btn" onClick={exportData}>
                          <Download size={16} />
                          {t.exportData}
                        </button>
                        <p className="help-text">{t.exportHint}</p>
                        {google && (
                          <button
                            className="btn"
                            onClick={async () => {
                              await fetch("/api/auth/logout", {
                                method: "POST",
                              });
                              location.href = "/";
                            }}
                          >
                            {t.signOut}
                          </button>
                        )}
                      </div>
                    </section>
                    <div className="care-note">
                      <ShieldCheck size={23} />
                      <p>{t.privacy}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              mazi<span className="brand-dot">.</span> <span>{t.together}</span>
            </span>
            <span>{t.noAuto}</span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal(null);
        }}
        aria-labelledby="dialog-title"
      >
        <div className="dialog-header">
          <h2 id="dialog-title">
            {modal?.id
              ? t.edit
              : modal?.kind === "conditions"
                ? t.addRecord
                : modal?.kind === "medications"
                  ? t.addMedication
                  : modal?.kind === "appointments"
                    ? t.addAppointment
                    : modal?.kind === "expenses"
                      ? t.addExpense
                      : modal?.kind === "members"
                        ? t.addMember
                        : t.addTask}
          </h2>
          <button
            className="icon-button"
            onClick={() => setModal(null)}
            aria-label={t.close}
          >
            <X size={21} />
          </button>
        </div>
        {modal && (
          <form key={`${modal.kind}-${modal.id || "new"}`} onSubmit={submit}>
            <div className="dialog-fields">
              {error && (
                <div className="notice error" role="alert">
                  {error}
                </div>
              )}
              {modal.kind === "members" ? (
                <>
                  <Field name="name" label={t.name} required />
                  <Field name="email" label={t.email} type="email" />
                  <label className="field">
                    {t.role}
                    <select
                      name="role"
                      defaultValue={defaultValue("role") || "editor"}
                    >
                      {current?.role === "owner" && (
                        <option value="owner">{t.owner}</option>
                      )}
                      <option value="editor">{t.editor}</option>
                      <option value="viewer">{t.viewer}</option>
                    </select>
                  </label>
                </>
              ) : modal.kind === "medications" ? (
                <>
                  <Field name="name" label={t.name} required />
                  <Field name="dose" label={t.dose} />
                  <Field name="schedule" label={t.schedule} />
                  <Checkbox name="active" label={t.active} defaultChecked />
                  <Checkbox name="confirmed" label={t.medConfirmed} />
                </>
              ) : (
                <>
                  <Field name="title" label={t.title} required />
                  {modal.kind === "conditions" && (
                    <>
                      <div className="form-columns">
                        <label className="field">
                          {t.region}
                          <select
                            name="region"
                            defaultValue={defaultValue("region") || "body"}
                          >
                            {regionSchema.options.map((r) => (
                              <option key={r} value={r}>
                                {t[regionLabels[r]]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="field">
                          {t.status}
                          <select
                            name="status"
                            defaultValue={defaultValue("status") || "active"}
                          >
                            <option value="active">{t.active}</option>
                            <option value="planned">{t.planned}</option>
                            <option value="history">{t.historyStatus}</option>
                            <option value="unknown">{t.unknown}</option>
                          </select>
                        </label>
                      </div>
                      <label className="field">
                        {t.details}
                        <textarea
                          name="detail"
                          rows={4}
                          defaultValue={defaultValue("detail")}
                          maxLength={5000}
                        />
                      </label>
                      <label className="field">
                        {t.source}
                        <select
                          name="source"
                          defaultValue={defaultValue("source") || "family"}
                        >
                          <option value="family">{t.familyReported}</option>
                          <option value="document">{t.document}</option>
                          <option value="myhealth">{t.myhealth}</option>
                        </select>
                      </label>
                      <label className="field">
                        {t.linkRecord}
                        <select
                          name="sourceId"
                          defaultValue={defaultValue("sourceId")}
                        >
                          <option value="">{t.none}</option>
                          {Boolean(current?.sourceId) &&
                            !data.files.some(
                              (f) => f.id === current?.sourceId,
                            ) && (
                              <option value={String(current?.sourceId)}>
                                {String(current?.sourceId)}
                              </option>
                            )}
                          {data.files.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Checkbox name="verified" label={t.confirmedRecord} />
                    </>
                  )}
                  <div className="form-columns">
                    <Field name="date" label={t.date} type="date" />
                    {modal.kind === "appointments" && (
                      <Field name="time" label={t.time} type="time" />
                    )}
                    {modal.kind === "expenses" && (
                      <Field
                        name="amount"
                        label={t.amount}
                        type="number"
                        required
                      />
                    )}
                  </div>
                  {modal.kind === "appointments" && (
                    <Field name="location" label={t.location} />
                  )}{" "}
                  {modal.kind !== "conditions" && <MemberSelect />}
                  {(modal.kind === "tasks" ||
                    modal.kind === "appointments") && (
                    <Checkbox name="done" label={t.completed} />
                  )}{" "}
                  {modal.kind === "expenses" && (
                    <>
                      <label className="field">
                        {t.receipt}
                        <select
                          name="receiptId"
                          defaultValue={defaultValue("receiptId")}
                        >
                          <option value="">{t.none}</option>
                          {data.files
                            .filter((f) => !f.mimeType.includes("folder"))
                            .map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <Checkbox name="settled" label={t.settled} />
                    </>
                  )}
                </>
              )}
            </div>
            <div className="dialog-actions">
              {modal.id && editable && (
                <button
                  className="icon-button danger"
                  type="button"
                  disabled={busy}
                  onClick={() => remove(modal.kind, modal.id!)}
                  aria-label={t.remove}
                >
                  <Trash2 size={18} />
                </button>
              )}
              <div className="grow" />
              <button
                className="btn"
                type="button"
                onClick={() => setModal(null)}
              >
                {t.cancel}
              </button>
              <button
                className="btn primary"
                disabled={busy || !editable}
                type="submit"
              >
                {t.save}
              </button>
            </div>
          </form>
        )}
      </dialog>
      <dialog
        ref={importDialog}
        onCancel={() => setImports(null)}
        aria-labelledby="import-title"
      >
        <div className="dialog-header">
          <h2 id="import-title">{t.reviewImport}</h2>
          <button
            className="icon-button"
            onClick={() => setImports(null)}
            aria-label={t.close}
          >
            <X size={21} />
          </button>
        </div>
        <div className="dialog-fields">
          <p>
            {imports?.length} {t.importReady}
          </p>
          <p className="help-text">{t.keepOriginal}</p>
          {imports?.map((c) => {
            const exists = data.conditions.some((v) => v.id === c.id);
            return (
              <label className="import-row" key={c.id}>
                <input
                  type="checkbox"
                  disabled={exists}
                  checked={importIds.includes(c.id) && !exists}
                  onChange={(e) =>
                    setImportIds(
                      e.target.checked
                        ? [...importIds, c.id]
                        : importIds.filter((v) => v !== c.id),
                    )
                  }
                />
                <span>
                  <strong>{l(c.title)}</strong>
                  <small>
                    {exists ? t.alreadyImported : formatDate(c.date, lang)}
                  </small>
                  <p>{l(c.detail)}</p>
                </span>
              </label>
            );
          })}
        </div>
        <div className="dialog-actions">
          <button className="btn" onClick={() => setImports(null)}>
            {t.cancel}
          </button>
          <button
            className="btn primary"
            disabled={!importIds.length || busy}
            onClick={async () => {
              if (
                await persist({
                  ...data,
                  conditions: mergeConditions(
                    data.conditions,
                    (imports || []).filter((c) => importIds.includes(c.id)),
                  ),
                })
              )
                setImports(null);
            }}
          >
            {t.importNow}
          </button>
        </div>
      </dialog>
    </div>
  );
}
