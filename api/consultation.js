const sendJson = (response, body, status = 200) => {
  response.status(status).json(body);
};

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const MAX_LENGTHS = {
  name: 120,
  phone: 40,
  email: 254,
  company: 160,
  service: 120,
  budget: 80,
  timeline: 80,
  message: 4000,
  language: 2,
  source_page: 2048,
};

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_SUBMISSIONS = 3;

const VALID_VALUES = {
  service: new Set([
    "Website chuẩn SEO",
    "Ứng dụng di động",
    "Domain, hosting & business email",
    "Phần mềm / chuyển đổi số",
    "Chưa xác định",
    "SEO website",
    "Mobile app",
    "Software / digital transformation",
    "Not sure yet",
  ]),
  budget: new Set([
    "",
    "Chưa xác định",
    "Dưới 20 triệu",
    "20–50 triệu",
    "Trên 50 triệu",
    "Not sure yet",
    "Under VND 20m",
    "VND 20–50m",
    "Over VND 50m",
  ]),
  timeline: new Set([
    "",
    "Chưa xác định",
    "Trong 1 tháng",
    "1–3 tháng",
    "Trên 3 tháng",
    "Not sure yet",
    "Within 1 month",
    "1–3 months",
    "Over 3 months",
  ]),
};

let supabaseClientFactory = (url, serviceRoleKey) => {
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, serviceRoleKey);
};

const logErrorCode = (operation, error) => {
  if (!error) {
    console.error(`[consultation] ${operation}:unknown`);
    return;
  }

  if (typeof error === "string") {
    console.error(`[consultation] ${operation}:string_error`);
    return;
  }

  const rawCode =
    error.code ||
    error.status ||
    error.statusCode ||
    error.error_code ||
    error.name ||
    error.cause?.code;
  const constructorName = error.constructor && error.constructor.name;
  const fallbackCode = constructorName && constructorName !== "Object"
    ? constructorName
    : "object_error";
  const code = String(rawCode || fallbackCode).replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 80);
  console.error(`[consultation] ${operation}:${code}`);
};

const getText = (value) => String(value == null ? "" : value).trim();

const getReferer = (request) =>
  request.headers && (request.headers.referer || request.headers.referrer);

const getRefererUrl = (request) => {
  const referer = getReferer(request);
  if (!referer) return null;

  try {
    return new URL(referer);
  } catch (error) {
    return null;
  }
};

const inferLanguage = (request, submittedLanguage) => {
  if (submittedLanguage === "vi" || submittedLanguage === "en") {
    return submittedLanguage;
  }

  const refererUrl = getRefererUrl(request);
  return refererUrl && refererUrl.pathname.startsWith("/en/") ? "en" : "vi";
};

const inferSourcePage = (request, submittedSourcePage) => {
  if (submittedSourcePage && submittedSourcePage.startsWith("/")) {
    return submittedSourcePage;
  }

  const refererUrl = getRefererUrl(request);
  return refererUrl ? refererUrl.pathname : "";
};

const isValidEmail = (email) =>
  !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidPhone = (phone) => {
  if (!/^[+\d\s().-]+$/.test(phone)) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
};

const validateLength = (fields) =>
  Object.entries(MAX_LENGTHS).find(([field, max]) => fields[field].length > max);

const sendConsultationEmail = async ({ name, phone, email, company, service, budget, timeline, message }) => {
  const html = `
    <h2>New consultation request</h2>
    <p><strong>Name:</strong> ${escapeHtml(name)}</p>
    <p><strong>Phone/Zalo:</strong> ${escapeHtml(phone)}</p>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    <p><strong>Company:</strong> ${escapeHtml(company)}</p>
    <p><strong>Service:</strong> ${escapeHtml(service)}</p>
    <p><strong>Budget:</strong> ${escapeHtml(budget)}</p>
    <p><strong>Timeline:</strong> ${escapeHtml(timeline)}</p>
    <p><strong>Message:</strong><br>${escapeHtml(message).replaceAll("\n", "<br>")}</p>
  `;

  try {
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL,
        to: [process.env.LEAD_EMAIL],
        reply_to: email || undefined,
        subject: `Consultation request: ${name} — ${service}`,
        html,
      }),
    });

    if (!emailResponse.ok) {
      logErrorCode("email_send_failed", emailResponse);
      return false;
    }

    return true;
  } catch (error) {
    logErrorCode("email_send_failed", error);
    return false;
  }
};

const saveLead = async (lead) => {
  const client = supabaseClientFactory(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const { data, error } = await client
    .from("leads")
    .insert([lead])
    .select("id")
    .single();

  if (error) throw error;
  return data && data.id;
};

const isRateLimited = async (phone) => {
  const client = supabaseClientFactory(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await client
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .gte("created_at", cutoff);

  if (error) throw error;
  return (count || 0) >= RATE_LIMIT_MAX_SUBMISSIONS;
};

const markEmailSent = async (leadId) => {
  if (!leadId) return;

  try {
    const client = supabaseClientFactory(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { error } = await client
      .from("leads")
      .update({ email_sent: true })
      .eq("id", leadId);

    if (error) logErrorCode("email_flag_update_failed", error);
  } catch (error) {
    logErrorCode("email_flag_update_failed", error);
  }
};

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    return sendJson(response, { message: "Method not allowed." }, 405);
  }

  const siteOrigin = process.env.SITE_ORIGIN;
  const requestOrigin = request.headers && request.headers.origin;
  if (siteOrigin && requestOrigin !== siteOrigin) {
    return sendJson(response, { message: "Invalid origin." }, 403);
  }

  let data;
  try {
    data =
      request.body && typeof request.body === "object"
        ? request.body
        : JSON.parse(request.body || "{}");
  } catch (error) {
    return sendJson(response, { message: "Invalid request." }, 400);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return sendJson(response, { message: "Invalid request." }, 400);
  }

  if (data.website) {
    return sendJson(response, {
      message: "Cảm ơn bạn. Thông tin đã được tiếp nhận.",
    });
  }

  const fields = {
    name: getText(data.name),
    phone: getText(data.phone),
    email: getText(data.email),
    company: getText(data.company),
    service: getText(data.service),
    budget: getText(data.budget),
    timeline: getText(data.timeline),
    message: getText(data.message),
    language: getText(data.language),
    source_page: getText(data.source_page),
  };
  const consent = data.consent === true || data.consent === "on";

  if (!fields.name || !fields.phone || !fields.service || !consent) {
    return sendJson(response, {
      message: "Vui lòng điền họ tên, số điện thoại, dịch vụ và xác nhận đồng ý.",
    }, 422);
  }

  const tooLong = validateLength(fields);
  if (tooLong) {
    return sendJson(response, { message: "Vui lòng kiểm tra độ dài thông tin đã nhập." }, 422);
  }

  if (!isValidEmail(fields.email) || !isValidPhone(fields.phone)) {
    return sendJson(response, { message: "Vui lòng kiểm tra email và số điện thoại." }, 422);
  }

  if (
    !VALID_VALUES.service.has(fields.service) ||
    !VALID_VALUES.budget.has(fields.budget) ||
    !VALID_VALUES.timeline.has(fields.timeline)
  ) {
    return sendJson(response, { message: "Vui lòng chọn giá trị hợp lệ trong biểu mẫu." }, 422);
  }

  const language = inferLanguage(request, fields.language);
  const sourcePage = inferSourcePage(request, fields.source_page);
  const marketingConsent =
    data.marketing_consent === true ||
    data.marketing_consent === "yes" ||
    data.marketing_consent === "on";
  const hasSupabase = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const hasEmail = Boolean(
    process.env.RESEND_API_KEY && process.env.LEAD_EMAIL && process.env.FROM_EMAIL
  );

  if (!hasSupabase && !hasEmail) {
    return sendJson(response, {
      message: "Form đang chờ cấu hình email. Vui lòng liên hệ trực tiếp qua thông tin bên cạnh.",
    }, 503);
  }

  if (hasSupabase) {
    try {
      if (await isRateLimited(fields.phone)) {
        return sendJson(response, {
          message: "Bạn đã gửi quá nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau.",
        }, 429);
      }
    } catch (error) {
      // A rate-limit lookup must not make the lead form unavailable.
      logErrorCode("rate_limit_check_failed", error);
    }
  }

  let leadId = null;
  let dbSucceeded = false;

  if (hasSupabase) {
    try {
      leadId = await saveLead({
        name: fields.name,
        phone: fields.phone,
        email: fields.email || null,
        company: fields.company || null,
        service: fields.service,
        budget: fields.budget || null,
        timeline: fields.timeline || null,
        message: fields.message || null,
        marketing_consent: marketingConsent,
        language,
        source_page: sourcePage || null,
        email_sent: false,
      });
      dbSucceeded = true;
    } catch (error) {
      logErrorCode("lead_insert_failed", error);
    }
  }

  let emailSucceeded = false;
  if (hasEmail) {
    emailSucceeded = await sendConsultationEmail(fields);
  }

  if (dbSucceeded && emailSucceeded) {
    await markEmailSent(leadId);
  }

  if (dbSucceeded || emailSucceeded) {
    return sendJson(response, {
      message: "Cảm ơn bạn. Tôi sẽ phản hồi trong thời gian sớm nhất.",
    });
  }

  if (!hasEmail) {
    return sendJson(response, {
      message: "Form đang chờ cấu hình email. Vui lòng liên hệ trực tiếp qua thông tin bên cạnh.",
    }, 503);
  }

  return sendJson(response, {
    message: "Không thể gửi thông tin lúc này. Vui lòng thử lại sau.",
  }, 502);
};

// Test hook: production code uses the real Supabase client factory above.
module.exports._setSupabaseClientFactory = (factory) => {
  supabaseClientFactory = factory;
};

module.exports._resetSupabaseClientFactory = () => {
  supabaseClientFactory = (url, serviceRoleKey) => {
    const { createClient } = require("@supabase/supabase-js");
    return createClient(url, serviceRoleKey);
  };
};
