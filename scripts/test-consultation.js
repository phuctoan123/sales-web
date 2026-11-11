const assert = require("assert");
const handler = require("../api/consultation");

const ENV_KEYS = [
  "SITE_ORIGIN",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const originalEnv = Object.fromEntries(
  ENV_KEYS.filter((key) => process.env[key] !== undefined).map((key) => [key, process.env[key]])
);
const originalFetch = global.fetch;

const setEnv = (values = {}) => {
  ENV_KEYS.forEach((key) => delete process.env[key]);
  Object.entries(values).forEach(([key, value]) => {
    process.env[key] = value;
  });
};

const restoreEnvironment = () => {
  ENV_KEYS.forEach((key) => delete process.env[key]);
  Object.entries(originalEnv).forEach(([key, value]) => {
    process.env[key] = value;
  });
  global.fetch = originalFetch;
  handler._resetSupabaseClientFactory();
};

const validLead = (overrides = {}) => ({
  name: "Nguyen Van A",
  phone: "0901234567",
  email: "lead@example.com",
  company: "Example Co",
  service: "Website chuẩn SEO",
  budget: "20–50 triệu",
  timeline: "Trong 1 tháng",
  message: "Cần tư vấn website mới.",
  consent: "on",
  marketing_consent: "yes",
  language: "vi",
  source_page: "/tu-van/",
  ...overrides,
});

const invoke = async ({ method = "POST", body = validLead(), headers = {} } = {}) => {
  let statusCode = 200;
  let responseBody;
  const response = {
    status(status) {
      statusCode = status;
      return this;
    },
    json(bodyValue) {
      responseBody = bodyValue;
      return this;
    },
  };

  await handler({ method, body, headers }, response);
  return { statusCode, responseBody };
};

const configureSupabaseMock = ({ insertError = null, updateError = null, rateLimitCount = 0, rateLimitError = null } = {}) => {
  const calls = { insert: 0, update: 0, rateCheck: 0, insertPayload: null };
  handler._setSupabaseClientFactory(() => ({
    from(table) {
      assert.equal(table, "leads");
      return {
        select(columns, options) {
          assert.equal(options.head, true);
          return {
            eq(field, value) {
              assert.equal(field, "phone");
              assert.equal(value, "0901234567");
              calls.rateCheck += 1;
              return {
                async gte(fieldName) {
                  assert.equal(fieldName, "created_at");
                  return { count: rateLimitCount, error: rateLimitError };
                },
              };
            },
          };
        },
        insert(rows) {
          calls.insert += 1;
          calls.insertPayload = rows[0];
          return {
            select() {
              return {
                async single() {
                  return insertError
                    ? { data: null, error: insertError }
                    : { data: { id: "lead-1" }, error: null };
                },
              };
            },
          };
        },
        update(values) {
          calls.update += 1;
          calls.updateValues = values;
          return {
            async eq() {
              return { error: updateError };
            },
          };
        },
      };
    },
  }));
  return calls;
};

const configureAllEnvironment = () => {
  setEnv();
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
};

const tests = [
  ["rejects a non-POST request", async () => {
    setEnv();
    const result = await invoke({ method: "GET" });
    assert.equal(result.statusCode, 405);
  }],
  ["rejects a mismatched origin", async () => {
    setEnv({ SITE_ORIGIN: "https://example.com" });
    const result = await invoke({ headers: { origin: "https://evil.example" } });
    assert.equal(result.statusCode, 403);
  }],
  ["accepts the honeypot response without sending", async () => {
    setEnv();
    const result = await invoke({ body: validLead({ website: "bot" }) });
    assert.equal(result.statusCode, 200);
  }],
  ["rejects missing required fields", async () => {
    setEnv();
    const result = await invoke({ body: validLead({ name: "", consent: "" }) });
    assert.equal(result.statusCode, 422);
  }],
  ["rejects values outside the form options", async () => {
    setEnv();
    const result = await invoke({ body: validLead({ service: "Unknown service" }) });
    assert.equal(result.statusCode, 422);
  }],
  ["rate limits repeated phone submissions", async () => {
    configureAllEnvironment();
    const calls = configureSupabaseMock({ rateLimitCount: 3 });
    const result = await invoke();
    assert.equal(result.statusCode, 429);
    assert.equal(calls.rateCheck, 1);
    assert.equal(calls.insert, 0);
  }],
  ["returns success when DB works", async () => {
    configureAllEnvironment();
    const calls = configureSupabaseMock();
    const result = await invoke({
      body: validLead({ language: "en", source_page: "/en/consultation/" }),
    });
    assert.equal(result.statusCode, 200);
    assert.equal(calls.insert, 1);
    assert.equal(calls.update, 0);
    assert.equal(calls.insertPayload.language, "en");
    assert.equal(calls.insertPayload.source_page, "/en/consultation/");
    assert.equal(calls.insertPayload.email_sent, false);
  }],
  ["returns a service error when DB fails", async () => {
    configureAllEnvironment();
    configureSupabaseMock({ insertError: { code: "DB_FAIL" } });
    const result = await invoke();
    assert.equal(result.statusCode, 503);
  }],
  ["returns a service error when Supabase is not configured", async () => {
    setEnv();
    const result = await invoke();
    assert.equal(result.statusCode, 503);
  }],
];

(async () => {
  try {
    for (const [name, test] of tests) {
      await test();
      console.log(`passed: ${name}`);
    }
    console.log(`consultation tests passed: ${tests.length}`);
  } finally {
    restoreEnvironment();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
