import { z } from "zod";
export type Lang = "en" | "el";
export const textSchema = z.object({
  en: z.string().max(5000),
  el: z.string().max(5000),
});
export type LocalText = z.infer<typeof textSchema>;
export const both = (en: string, el = en): LocalText => ({ en, el });
const id = z.string().min(1).max(150);
export const regionSchema = z.enum([
  "left-eye",
  "right-eye",
  "heart",
  "right-lung",
  "left-lung",
  "abdomen",
  "left-hip",
  "right-hip",
  "body",
]);
export type Region = z.infer<typeof regionSchema>;
const date = z
  .string()
  .refine(
    (v) =>
      v === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        !Number.isNaN(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v),
    "Invalid date",
  );
export const conditionSchema = z.object({
  id,
  title: textSchema,
  region: regionSchema,
  status: z.enum(["active", "planned", "history", "unknown"]),
  detail: textSchema,
  date,
  source: z.enum(["family", "document", "myhealth"]),
  sourceId: z.string().max(200).default(""),
  verified: z.boolean().default(false),
});
export const medicationSchema = z.object({
  id,
  name: textSchema,
  dose: z.string().max(200),
  schedule: textSchema,
  confirmed: z.boolean(),
  active: z.boolean(),
});
export const appointmentSchema = z.object({
  id,
  title: textSchema,
  date,
  time: z.string().max(20),
  location: z.string().max(500),
  member: z.string().max(100),
  done: z.boolean(),
});
export const taskSchema = z.object({
  id,
  title: textSchema,
  member: z.string().max(100),
  date,
  done: z.boolean(),
});
export const expenseSchema = z.object({
  id,
  title: textSchema,
  amount: z.number().min(0).max(1e7),
  member: z.string().max(100),
  contributions: z.array(z.object({
    member: z.string().min(1).max(100),
    amount: z.number().min(0).max(1e7).multipleOf(0.01),
  })).max(60).optional(),
  date,
  settled: z.boolean(),
  receiptId: z.string().max(200),
}).refine((expense) => {
  const shares = expense.contributions ?? [];
  return new Set(shares.map((share) => share.member)).size === shares.length &&
    shares.reduce((sum, share) => sum + Math.round(share.amount * 100), 0) <= Math.round(expense.amount * 100);
}, "Contributions must have unique members and cannot exceed the expense total");
export function expenseContributions(expense: z.infer<typeof expenseSchema>) {
  return expense.contributions ?? (expense.member ? [{ member: expense.member, amount: expense.amount }] : []);
}
export function uncoveredExpense(expense: z.infer<typeof expenseSchema>) {
  return Math.max(0, Math.round(expense.amount * 100) - expenseContributions(expense)
    .reduce((sum, share) => sum + Math.round(share.amount * 100), 0)) / 100;
}
export function memberExpenseTotal(expenses: z.infer<typeof expenseSchema>[], member: string) {
  return expenses.flatMap(expenseContributions).filter((share) => share.member === member)
    .reduce((sum, share) => sum + Math.round(share.amount * 100), 0) / 100;
}
export const memberSchema = z.object({
  id,
  name: z.string().min(1).max(100),
  email: z.union([z.email(), z.literal("")]),
  role: z.enum(["owner", "editor", "viewer"]),
});
export const fileSchema = z.object({
  id,
  name: z.string().max(1000),
  mimeType: z.string().max(200),
  modifiedTime: z.string().max(100),
  path: z.string().max(3000),
});
export const stateSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().min(0),
  patient: textSchema,
  conditions: z.array(conditionSchema).max(500),
  medications: z.array(medicationSchema).max(200),
  appointments: z.array(appointmentSchema).max(1000),
  tasks: z.array(taskSchema).max(1000),
  expenses: z.array(expenseSchema).max(2000),
  members: z.array(memberSchema).max(30),
  files: z.array(fileSchema).max(10000),
  driveFolder: z.string().max(200),
  driveIndexedAt: z.string().max(100),
});
export type CareState = z.infer<typeof stateSchema>;
export type Condition = CareState["conditions"][number];
export type Member = CareState["members"][number];
export const blankState = (): CareState => ({
  version: 1,
  revision: 0,
  patient: both("Family care", "Οικογενειακή φροντίδα"),
  conditions: [],
  medications: [],
  appointments: [],
  tasks: [],
  expenses: [],
  members: [],
  files: [],
  driveFolder: "",
  driveIndexedAt: "",
});
export function demoState(): CareState {
  const s = blankState();
  s.patient = both("Demo care profile", "Ενδεικτικό προφίλ");
  s.members = [
    { id: "alex", name: "Alex", email: "", role: "owner" },
    { id: "maria", name: "Maria", email: "", role: "editor" },
  ];
  s.conditions = [
    {
      id: "demo-knee",
      title: both("Hip follow-up", "Επανέλεγχος ισχίου"),
      region: "left-hip",
      status: "active",
      detail: both(
        "Example record. Add notes and link the original medical report.",
        "Ενδεικτική εγγραφή. Προσθέστε σημειώσεις και συνδέστε την αρχική γνωμάτευση.",
      ),
      date: "",
      source: "family",
      sourceId: "",
      verified: false,
    },
    {
      id: "demo-eye",
      title: both("Eye examination", "Οφθαλμολογικός έλεγχος"),
      region: "left-eye",
      status: "planned",
      detail: both(
        "Example of an upcoming examination.",
        "Παράδειγμα προγραμματισμένης εξέτασης.",
      ),
      date: "",
      source: "family",
      sourceId: "",
      verified: false,
    },
  ];
  s.tasks = [
    {
      id: "demo-task",
      title: both(
        "Gather the latest medical reports",
        "Συγκέντρωση πρόσφατων γνωματεύσεων",
      ),
      member: "Alex",
      date: "",
      done: false,
    },
  ];
  return s;
}
export function driveUrl(file: { id: string; mimeType?: string }) {
  return `https://drive.google.com/${file.mimeType === "application/vnd.google-apps.folder" ? "drive/folders/" : "file/d/"}${encodeURIComponent(file.id)}${file.mimeType === "application/vnd.google-apps.folder" ? "" : "/view"}`;
}
export function folderId(input: string) {
  const match = input
    .trim()
    .match(
      /^(?:https:\/\/drive\.google\.com\/drive\/folders\/)?([a-zA-Z0-9_-]+)(?:\?[^\s]*)?$/,
    );
  if (!match) throw new Error("Invalid Google Drive folder");
  return match[1];
}
export function canEdit(role: string) {
  return role === "owner" || role === "editor";
}
export function isImagingPackage(name: string) {
  return /^#?\s*dicom(?:\s+files)?$/i.test(name.trim());
}
export function authorizeRole(
  state: CareState,
  email: string,
  owner: string,
): Member["role"] | null {
  if (owner && email.toLowerCase() === owner.toLowerCase()) return "owner";
  return state.members.find(
    (m) => m.email && m.email.toLowerCase() === email.toLowerCase(),
  )?.role === "viewer"
    ? "viewer"
    : state.members.some(
          (m) =>
            m.email &&
            m.email.toLowerCase() === email.toLowerCase() &&
            m.role === "editor",
        )
      ? "editor"
      : null;
}
export function mergeConditions(current: Condition[], incoming: Condition[]) {
  const seen = new Set(current.map((c) => c.id));
  return [
    ...current,
    ...incoming.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    }),
  ];
}
