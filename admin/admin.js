import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

const PAGE_SIZE = 25;
const LEAD_COLUMNS = [
  "id",
  "created_at",
  "updated_at",
  "name",
  "phone",
  "email",
  "company",
  "service",
  "budget",
  "timeline",
  "message",
  "marketing_consent",
  "language",
  "source_page",
  "status",
  "internal_note",
  "contacted_at",
  "email_sent",
].join(",");

const STATUS_LABELS = {
  new: "Mới",
  contacted: "Đã liên hệ",
  quoted: "Đã báo giá",
  won: "Đã chốt",
  lost: "Không tiếp tục",
};

const STATUS_ORDER = ["new", "contacted", "quoted", "won", "lost"];
const SERVICE_VALUES = [
  "Website chuẩn SEO",
  "Ứng dụng di động",
  "Domain, hosting & business email",
  "Phần mềm / chuyển đổi số",
  "Chưa xác định",
  "SEO website",
  "Mobile app",
  "Software / digital transformation",
  "Not sure yet",
];

const elements = {
  loginView: document.querySelector("#login-view"),
  loginForm: document.querySelector("#login-form"),
  loginStatus: document.querySelector("#login-status"),
  appView: document.querySelector("#app-view"),
  appStatus: document.querySelector("#app-status"),
  currentUser: document.querySelector("#current-user"),
  logoutButton: document.querySelector("#logout-button"),
  metricTotal: document.querySelector("#metric-total"),
  metricRecent: document.querySelector("#metric-recent"),
  statusBreakdown: document.querySelector("#status-breakdown"),
  serviceBreakdown: document.querySelector("#service-breakdown"),
  filtersForm: document.querySelector("#filters-form"),
  filterSearch: document.querySelector("#filter-search"),
  filterStatus: document.querySelector("#filter-status"),
  filterService: document.querySelector("#filter-service"),
  filterFrom: document.querySelector("#filter-from"),
  filterTo: document.querySelector("#filter-to"),
  resetFilters: document.querySelector("#reset-filters"),
  exportCsv: document.querySelector("#export-csv"),
  tableStatus: document.querySelector("#table-status"),
  listSummary: document.querySelector("#list-summary"),
  leadsBody: document.querySelector("#leads-body"),
  emptyState: document.querySelector("#empty-state"),
  previousPage: document.querySelector("#previous-page"),
  nextPage: document.querySelector("#next-page"),
  pageSummary: document.querySelector("#page-summary"),
  detailEmpty: document.querySelector("#detail-empty"),
  detailView: document.querySelector("#detail-view"),
  detailName: document.querySelector("#detail-name"),
  detailStatusBadge: document.querySelector("#detail-status-badge"),
  detailPhoneLink: document.querySelector("#detail-phone-link"),
  detailEmailLink: document.querySelector("#detail-email-link"),
  detailZaloLink: document.querySelector("#detail-zalo-link"),
  detailFields: document.querySelector("#detail-fields"),
  detailStatus: document.querySelector("#detail-status"),
  detailNote: document.querySelector("#detail-note"),
  saveDetail: document.querySelector("#save-detail"),
  detailStatusMessage: document.querySelector("#detail-status-message"),
};

const state = {
  supabase: null,
  session: null,
  selectedLead: null,
  leads: [],
  dashboardLeads: [],
  total: 0,
  page: 1,
  totalPages: 1,
  filters: {
    search: "",
    status: "",
    service: "",
    from: "",
    to: "",
  },
  loading: false,
  pendingLoginMessage: "",
};

function setMessage(element, message = "", type = "") {
  element.textContent = message;
  element.className = type ? `status-message ${type}` : "status-message";
}

function showLogin(message = "", type = "") {
  elements.loginView.hidden = false;
  elements.appView.hidden = true;
  setMessage(elements.loginStatus, message, type);
  if (!message) elements.loginForm.reset();
}

function showApp(session) {
  elements.loginView.hidden = true;
  elements.appView.hidden = false;
  elements.currentUser.textContent = session.user.email || "Đã đăng nhập";
}

function isSupabaseConfigured() {
  const key = String(SUPABASE_ANON_KEY || "").toLowerCase();
  const looksLikePrivateKey =
    key.startsWith("sb_secret_") ||
    key.includes("service_role") ||
    key.startsWith("re_");
  return Boolean(
    SUPABASE_URL &&
      SUPABASE_ANON_KEY &&
      !SUPABASE_URL.includes("YOUR-PROJECT") &&
      !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE") &&
      !looksLikePrivateKey
  );
}

function populateServiceFilter() {
  const values = new Set(SERVICE_VALUES);
  values.forEach((service) => {
    const option = document.createElement("option");
    option.value = service;
    option.textContent = service;
    elements.filterService.append(option);
  });
}

function formatDate(value, withTime = true) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", withTime
    ? { dateStyle: "short", timeStyle: "short" }
    : { dateStyle: "short" }
  ).format(date);
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status || "Chưa rõ";
}

function makeStatusBadge(status) {
  const badge = document.createElement("span");
  badge.className = `status-badge status-${STATUS_LABELS[status] ? status : "new"}`;
  badge.textContent = statusLabel(status);
  return badge;
}

function appendTextCell(row, value, className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = value == null || value === "" ? "—" : String(value);
  row.append(cell);
  return cell;
}

function appendPrimaryCell(row, primary, secondary = "") {
  const cell = document.createElement("td");
  const primaryElement = document.createElement("span");
  primaryElement.className = "cell-primary";
  primaryElement.textContent = primary || "—";
  cell.append(primaryElement);
  if (secondary) {
    const secondaryElement = document.createElement("span");
    secondaryElement.className = "cell-secondary";
    secondaryElement.textContent = secondary;
    cell.append(secondaryElement);
  }
  row.append(cell);
  return cell;
}

function appendStatusCell(row, status) {
  const cell = document.createElement("td");
  cell.append(makeStatusBadge(status));
  row.append(cell);
  return cell;
}

function renderLeadTable() {
  elements.leadsBody.replaceChildren();
  state.leads.forEach((lead) => {
    const row = document.createElement("tr");
    row.tabIndex = 0;
    row.dataset.leadId = lead.id;
    row.setAttribute("aria-label", `Xem lead ${lead.name || "không tên"}`);
    row.addEventListener("click", () => selectLead(lead));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectLead(lead);
      }
    });

    appendTextCell(row, formatDate(lead.created_at));
    appendPrimaryCell(row, lead.name, lead.email);
    appendTextCell(row, lead.phone);
    appendTextCell(row, lead.service);
    appendTextCell(row, lead.budget);
    appendStatusCell(row, lead.status);
    elements.leadsBody.append(row);
  });

  const first = state.total === 0 ? 0 : (state.page - 1) * PAGE_SIZE + 1;
  const last = Math.min(state.page * PAGE_SIZE, state.total);
  elements.listSummary.textContent = state.total
    ? `Hiển thị ${first}–${last} trong ${state.total} lead`
    : "Chưa có lead phù hợp";
  elements.pageSummary.textContent = `Trang ${state.page} / ${state.totalPages}`;
  elements.previousPage.disabled = state.page <= 1 || state.loading;
  elements.nextPage.disabled = state.page >= state.totalPages || state.loading;
  elements.emptyState.hidden = state.leads.length > 0;
  if (!state.leads.length) {
    elements.emptyState.textContent = state.loading
      ? "Đang tải danh sách lead..."
      : "Không có lead nào phù hợp với bộ lọc hiện tại.";
  }
}

function renderBreakdown(container, counts, total, labelForValue = (value) => value) {
  container.replaceChildren();
  if (!counts.size) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Chưa có dữ liệu";
    container.append(empty);
    return;
  }

  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([value, count]) => {
      const row = document.createElement("div");
      row.className = "breakdown-row";
      const label = document.createElement("span");
      label.className = "breakdown-label";
      label.textContent = labelForValue(value);
      const number = document.createElement("span");
      number.className = "breakdown-value";
      number.textContent = String(count);
      const track = document.createElement("span");
      track.className = "breakdown-track";
      const progress = document.createElement("progress");
      progress.className = "breakdown-progress";
      progress.max = 100;
      progress.value = Math.round((count / total) * 100);
      progress.setAttribute("aria-label", `${labelForValue(value)}: ${count}`);
      track.append(progress);
      row.append(label, number, track);
      container.append(row);
    });
}

function renderDashboard(leads) {
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentCount = leads.filter((lead) => {
    const created = Date.parse(lead.created_at);
    return !Number.isNaN(created) && created >= recentCutoff;
  }).length;
  const statusCounts = new Map(STATUS_ORDER.map((status) => [status, 0]));
  const serviceCounts = new Map();

  leads.forEach((lead) => {
    if (statusCounts.has(lead.status)) {
      statusCounts.set(lead.status, statusCounts.get(lead.status) + 1);
    }
    const service = lead.service || "Chưa xác định";
    serviceCounts.set(service, (serviceCounts.get(service) || 0) + 1);
  });

  elements.metricTotal.textContent = String(leads.length);
  elements.metricRecent.textContent = String(recentCount);
  renderBreakdown(elements.statusBreakdown, statusCounts, leads.length || 1, statusLabel);
  renderBreakdown(elements.serviceBreakdown, serviceCounts, leads.length || 1);
}

function getFilterValues() {
  return {
    search: elements.filterSearch.value.trim(),
    status: elements.filterStatus.value,
    service: elements.filterService.value,
    from: elements.filterFrom.value,
    to: elements.filterTo.value,
  };
}

function safeSearchTerm(value) {
  return value.replace(/[(),*%\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

function nextDateValue(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}

function buildLeadQuery({ exportAll = false } = {}) {
  let query = state.supabase.from("leads").select(
    LEAD_COLUMNS,
    exportAll ? undefined : { count: "exact" }
  );
  const { search, status, service, from, to } = state.filters;

  if (search) {
    const term = safeSearchTerm(search);
    if (term) {
      const pattern = `*${term}*`;
      query = query.or([
        `name.ilike.${pattern}`,
        `phone.ilike.${pattern}`,
        `email.ilike.${pattern}`,
        `company.ilike.${pattern}`,
      ].join(","));
    }
  }
  if (status) query = query.eq("status", status);
  if (service) query = query.eq("service", service);
  if (from) query = query.gte("created_at", `${from}T00:00:00`);
  if (to) {
    const nextDate = nextDateValue(to);
    if (nextDate) query = query.lt("created_at", nextDate);
  }

  query = query.order("created_at", { ascending: false });
  if (!exportAll) {
    const start = (state.page - 1) * PAGE_SIZE;
    query = query.range(start, start + PAGE_SIZE - 1);
  }
  return query;
}

async function fetchLeads() {
  const { data, error, count } = await buildLeadQuery();
  if (error) throw error;
  state.leads = data || [];
  state.total = count || 0;
  state.totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));
  if (state.page > state.totalPages) state.page = state.totalPages;
  renderLeadTable();
}

async function fetchDashboard() {
  const { data, error } = await state.supabase
    .from("leads")
    .select("created_at,service,status");
  if (error) throw error;
  state.dashboardLeads = data || [];
  renderDashboard(state.dashboardLeads);
}

async function loadData() {
  state.loading = true;
  setMessage(elements.tableStatus, "Đang tải...", "");
  renderLeadTable();
  try {
    await Promise.all([fetchLeads(), fetchDashboard()]);
    setMessage(elements.tableStatus, "", "");
  } catch (error) {
    setMessage(elements.tableStatus, "Không thể tải dữ liệu lead.", "error");
    elements.emptyState.hidden = false;
    elements.emptyState.textContent = "Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.";
    setMessage(elements.appStatus, "Kiểm tra quyền RLS, bảng leads và phiên đăng nhập Supabase.", "error");
  } finally {
    state.loading = false;
    renderLeadTable();
  }
}

async function changePage(nextPage) {
  if (nextPage < 1 || nextPage > state.totalPages || state.loading) return;
  state.page = nextPage;
  state.loading = true;
  setMessage(elements.tableStatus, "Đang tải...", "");
  renderLeadTable();
  try {
    await fetchLeads();
    setMessage(elements.tableStatus, "", "");
  } catch (error) {
    setMessage(elements.tableStatus, "Không thể tải trang lead này.", "error");
  } finally {
    state.loading = false;
    renderLeadTable();
  }
}

function setQuickLink(link, href) {
  if (href) {
    link.href = href;
    link.removeAttribute("aria-disabled");
    link.tabIndex = 0;
  } else {
    link.href = "#";
    link.setAttribute("aria-disabled", "true");
    link.tabIndex = -1;
  }
}

function detailField(label, value) {
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value == null || value === "" ? "—" : String(value);
  elements.detailFields.append(term, description);
}

function renderDetails(lead) {
  state.selectedLead = lead;
  elements.detailEmpty.hidden = true;
  elements.detailView.hidden = false;
  elements.detailName.textContent = lead.name || "Lead không tên";
  elements.detailStatusBadge.replaceChildren(makeStatusBadge(lead.status));
  elements.detailStatus.value = lead.status || "new";
  elements.detailNote.value = lead.internal_note || "";

  const phone = String(lead.phone || "").replace(/[^\d+]/g, "");
  const phoneDigits = String(lead.phone || "").replace(/\D/g, "");
  setQuickLink(elements.detailPhoneLink, phone ? `tel:${phone}` : "");
  setQuickLink(elements.detailEmailLink, lead.email ? `mailto:${encodeURIComponent(lead.email)}` : "");
  setQuickLink(elements.detailZaloLink, phoneDigits ? `https://zalo.me/${phoneDigits}` : "");

  elements.detailFields.replaceChildren();
  detailField("Thời gian", formatDate(lead.created_at));
  detailField("Số điện thoại", lead.phone);
  detailField("Email", lead.email);
  detailField("Doanh nghiệp", lead.company);
  detailField("Dịch vụ", lead.service);
  detailField("Ngân sách", lead.budget);
  detailField("Thời gian dự kiến", lead.timeline);
  detailField("Nội dung", lead.message);
  detailField("Marketing", lead.marketing_consent ? "Đồng ý" : "Không đồng ý");
  detailField("Ngôn ngữ", lead.language);
  detailField("Trang nguồn", lead.source_page);
  detailField("Đã liên hệ lúc", formatDate(lead.contacted_at));
  detailField("Email đã gửi", lead.email_sent ? "Có" : "Chưa");
}

function selectLead(lead) {
  renderDetails(lead);
  document.querySelectorAll("tbody tr").forEach((row) => {
    row.classList.toggle("is-selected", row.dataset.leadId === lead.id);
  });
}

function clearDetails() {
  state.selectedLead = null;
  elements.detailEmpty.hidden = false;
  elements.detailView.hidden = true;
}

async function saveDetails() {
  const lead = state.selectedLead;
  if (!lead || !state.supabase) return;

  const nextStatus = elements.detailStatus.value;
  const update = {
    status: nextStatus,
    internal_note: elements.detailNote.value.trim() || null,
  };
  if (nextStatus === "contacted" && !lead.contacted_at) {
    update.contacted_at = new Date().toISOString();
  }

  elements.saveDetail.disabled = true;
  setMessage(elements.detailStatusMessage, "Đang lưu...", "");
  try {
    const { error } = await state.supabase
      .from("leads")
      .update(update)
      .eq("id", lead.id);
    if (error) throw error;

    const updatedLead = { ...lead, ...update };
    state.selectedLead = updatedLead;
    state.leads = state.leads.map((item) => item.id === lead.id ? updatedLead : item);
    renderLeadTable();
    renderDetails(updatedLead);
    await fetchDashboard();
    setMessage(elements.detailStatusMessage, "Đã lưu thay đổi.", "success");
  } catch (error) {
    setMessage(elements.detailStatusMessage, "Không thể lưu thay đổi. Kiểm tra quyền UPDATE trong RLS.", "error");
  } finally {
    elements.saveDetail.disabled = false;
  }
}

function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function leadToCsvRow(lead) {
  return [
    formatDate(lead.created_at),
    lead.name,
    lead.phone,
    lead.email,
    lead.company,
    lead.service,
    lead.budget,
    lead.timeline,
    lead.message,
    lead.marketing_consent ? "Có" : "Không",
    lead.language,
    lead.source_page,
    statusLabel(lead.status),
    lead.internal_note,
    lead.email_sent ? "Có" : "Không",
    formatDate(lead.contacted_at),
  ].map(csvCell).join(",");
}

async function exportCsv() {
  if (!state.supabase) return;
  elements.exportCsv.disabled = true;
  setMessage(elements.appStatus, "Đang chuẩn bị file CSV...", "");
  try {
    const { data, error } = await buildLeadQuery({ exportAll: true });
    if (error) throw error;
    const headers = [
      "Thời gian",
      "Họ tên",
      "Số điện thoại",
      "Email",
      "Doanh nghiệp",
      "Dịch vụ",
      "Ngân sách",
      "Thời gian dự kiến",
      "Nội dung",
      "Marketing consent",
      "Ngôn ngữ",
      "Trang nguồn",
      "Trạng thái",
      "Ghi chú nội bộ",
      "Email đã gửi",
      "Đã liên hệ lúc",
    ];
    const csv = `\ufeff${headers.map(csvCell).join(",")}\n${(data || []).map(leadToCsvRow).join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage(elements.appStatus, `Đã xuất ${(data || []).length} lead.`, "success");
  } catch (error) {
    setMessage(elements.appStatus, "Không thể xuất CSV.", "error");
  } finally {
    elements.exportCsv.disabled = false;
  }
}

async function handleLogin(event) {
  event.preventDefault();
  if (!state.supabase) {
    setMessage(elements.loginStatus, "Chưa cấu hình Supabase trong admin/config.js.", "error");
    return;
  }

  const email = elements.loginForm.elements.email.value.trim();
  const password = elements.loginForm.elements.password.value;
  if (!email || !password) {
    setMessage(elements.loginStatus, "Vui lòng nhập email và mật khẩu.", "error");
    return;
  }

  const button = elements.loginForm.querySelector("button[type='submit']");
  button.disabled = true;
  setMessage(elements.loginStatus, "Đang đăng nhập...", "");
  try {
    const { error } = await state.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  } catch (error) {
    setMessage(elements.loginStatus, "Email hoặc mật khẩu không đúng.", "error");
  } finally {
    button.disabled = false;
  }
}

async function handleSession(session) {
  if (!session) {
    const message = state.pendingLoginMessage;
    state.pendingLoginMessage = "";
    showLogin(message, message ? "error" : "");
    clearDetails();
    return;
  }

  setMessage(elements.loginStatus, "Đang kiểm tra quyền truy cập...", "");
  try {
    const { data, error } = await state.supabase.rpc("is_admin");
    if (error) throw error;
    if (data !== true) {
      state.pendingLoginMessage = "Không có quyền truy cập";
      await state.supabase.auth.signOut();
      return;
    }

    state.session = session;
    showApp(session);
    await loadData();
  } catch (error) {
    state.pendingLoginMessage = "Không thể kiểm tra quyền truy cập. Vui lòng thử lại.";
    await state.supabase.auth.signOut();
  }
}

function bindEvents() {
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.logoutButton.addEventListener("click", async () => {
    if (state.supabase) await state.supabase.auth.signOut();
  });
  elements.filtersForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.filters = getFilterValues();
    state.page = 1;
    clearDetails();
    await loadData();
  });
  elements.resetFilters.addEventListener("click", async () => {
    elements.filtersForm.reset();
    state.filters = getFilterValues();
    state.page = 1;
    clearDetails();
    await loadData();
  });
  elements.exportCsv.addEventListener("click", exportCsv);
  elements.previousPage.addEventListener("click", async () => {
    await changePage(state.page - 1);
  });
  elements.nextPage.addEventListener("click", async () => {
    await changePage(state.page + 1);
  });
  elements.saveDetail.addEventListener("click", saveDetails);
}

async function initialize() {
  populateServiceFilter();
  bindEvents();

  if (!isSupabaseConfigured()) {
    showLogin("Chưa cấu hình Supabase trong admin/config.js.", "error");
    return;
  }

  state.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  state.supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      void handleSession(null);
      return;
    }
    setTimeout(() => void handleSession(session), 0);
  });

  const { data, error } = await state.supabase.auth.getSession();
  if (error) {
    showLogin("Không thể khôi phục phiên đăng nhập.", "error");
    return;
  }
  await handleSession(data.session);
}

initialize().catch(() => {
  showLogin("Không thể khởi tạo trang quản trị.", "error");
});
