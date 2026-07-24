import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const accessSource = await readFile(
  new URL("../lib/admin/access.ts", import.meta.url),
  "utf8"
);

assert.match(accessSource, /ADMIN_OPERATOR_EMAILS/);
assert.match(accessSource, /email_confirmed_at/);
assert.match(accessSource, /NODE_ENV !== "production"/);
assert.match(accessSource, /request\.headers\.get\("origin"\)/);
assert.match(accessSource, /isSameOriginRequest/);
assert.match(accessSource, /sec-fetch-site/);
assert.doesNotMatch(accessSource, /SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(accessSource, /OPPORTUNITY_SCANNER_ADMIN_CODE[^)]*production/);

const executable = ts.transpileModule(accessSource, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;

const mocks = {
  getCustomerAuthConfig() {
    if (mocks.configError) throw new Error("not configured");
    return {
      appOrigin: "https://scanner.example.test",
      anonKey: "anon",
      authUrl: "https://db.example.test/auth/v1"
    };
  },
  isSameOriginRequest(request, appOrigin) {
    return request.headers.get("origin") === appOrigin;
  },
  async resolveCustomerPageSession() {
    return mocks.pageResolution;
  },
  async resolveCustomerSession() {
    return mocks.session;
  },
  hasAdminAccess(access) {
    return access === "local-token";
  },
  pageResolution: { session: null, refreshRequired: false },
  session: null,
  configError: false
};

const moduleUnderTest = { exports: {} };
const requireModule = (specifier) => {
  const modules = {
    "@/lib/customer-auth/config": { getCustomerAuthConfig: mocks.getCustomerAuthConfig },
    "@/lib/customer-auth/redirect": { isSameOriginRequest: mocks.isSameOriginRequest },
    "@/lib/customer-auth/session": {
      resolveCustomerPageSession: mocks.resolveCustomerPageSession,
      resolveCustomerSession: mocks.resolveCustomerSession
    },
    "@/lib/access": { hasAdminAccess: mocks.hasAdminAccess }
  };
  if (!(specifier in modules)) throw new Error(`Unexpected dependency: ${specifier}`);
  return modules[specifier];
};
new Function("require", "module", "exports", executable)(
  requireModule,
  moduleUnderTest,
  moduleUnderTest.exports
);

const {
  authorizeAdminMutation,
  configuredAdminOperatorEmails,
  isConfiguredAdminOperator,
  resolveAdminPageAccess
} = moduleUnderTest.exports;

assert.deepEqual(
  [...configuredAdminOperatorEmails({ ADMIN_OPERATOR_EMAILS: " Founder@Example.com,ops@example.com " })],
  ["founder@example.com", "ops@example.com"]
);
assert.equal(configuredAdminOperatorEmails({ ADMIN_OPERATOR_EMAILS: "valid@example.com,not-an-email" }).size, 0);
assert.equal(configuredAdminOperatorEmails({}).size, 0);
assert.equal(
  isConfiguredAdminOperator("FOUNDER@example.com", { ADMIN_OPERATOR_EMAILS: "founder@example.com" }),
  true
);

const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  ADMIN_OPERATOR_EMAILS: process.env.ADMIN_OPERATOR_EMAILS
};
try {
  process.env.NODE_ENV = "production";
  process.env.ADMIN_OPERATOR_EMAILS = "founder@example.com";

  mocks.pageResolution = {
    refreshRequired: false,
    session: {
      user: {
        email: "founder@example.com",
        email_confirmed_at: "2026-07-23T12:00:00.000Z"
      }
    }
  };
  assert.deepEqual(await resolveAdminPageAccess({ get() {} }), {
    status: "authorized",
    source: "session"
  });

  mocks.pageResolution.session.user.email = "other@example.com";
  assert.deepEqual(await resolveAdminPageAccess({ get() {} }), { status: "denied" });

  mocks.session = {
    user: {
      email: "founder@example.com",
      email_confirmed_at: "2026-07-23T12:00:00.000Z"
    },
    refreshedTokens: null
  };
  let request = {
    url: "https://scanner.example.test/admin/action",
    cookies: {},
    headers: new Headers({
      Origin: "https://scanner.example.test",
      "Sec-Fetch-Site": "same-origin"
    })
  };
  assert.equal((await authorizeAdminMutation(request)).authorized, true);

  request = {
    ...request,
    headers: new Headers({ Origin: "https://attacker.example.test" })
  };
  assert.equal((await authorizeAdminMutation(request)).authorized, false);

  process.env.ADMIN_OPERATOR_EMAILS = "";
  assert.equal((await authorizeAdminMutation({
    ...request,
    headers: new Headers({ Origin: "https://scanner.example.test" })
  })).authorized, false);

  process.env.NODE_ENV = "development";
  mocks.configError = true;
  const localRequest = {
    url: "http://localhost:3000/api/admin/action",
    cookies: {},
    headers: new Headers({ Origin: "http://localhost:3000" })
  };
  assert.equal((await authorizeAdminMutation(localRequest, "local-token")).authorized, true);
  assert.equal((await authorizeAdminMutation({
    ...localRequest,
    headers: new Headers({ Origin: "https://attacker.example.test" })
  }, "local-token")).authorized, false);
} finally {
  if (originalEnvironment.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnvironment.NODE_ENV;
  if (originalEnvironment.ADMIN_OPERATOR_EMAILS === undefined) delete process.env.ADMIN_OPERATOR_EMAILS;
  else process.env.ADMIN_OPERATOR_EMAILS = originalEnvironment.ADMIN_OPERATOR_EMAILS;
}

console.log("Admin operator access tests passed.");
