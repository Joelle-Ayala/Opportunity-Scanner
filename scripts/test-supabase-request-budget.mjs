import assert from "node:assert/strict";
import { getEventListeners } from "node:events";

const {
  DEFAULT_SUPABASE_REQUEST_TIMEOUT_MS,
  supabaseSelectMany,
  withSupabaseRequestBudget
} = await import("../lib/supabaseRest.ts");

const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const originalEnv = {
  url: process.env.SUPABASE_URL,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  anonKey: process.env.SUPABASE_ANON_KEY
};

function installMockTimers() {
  const timers = [];

  globalThis.setTimeout = (callback, delay, ...args) => {
    const timer = {
      callback: () => callback(...args),
      cleared: false,
      delay
    };
    timers.push(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => {
    timer.cleared = true;
  };

  return timers;
}

function jsonResponse(value) {
  return {
    ok: true,
    json: async () => value
  };
}

async function startBodyReadRequest(budget) {
  let requestSignal;
  globalThis.fetch = async (_input, init = {}) => {
    requestSignal = init.signal;
    return {
      ok: true,
      json: () =>
        new Promise((_, reject) => {
          const rejectOnAbort = () => reject(requestSignal.reason);
          if (requestSignal.aborted) {
            rejectOnAbort();
          } else {
            requestSignal.addEventListener("abort", rejectOnAbort, { once: true });
          }
        })
    };
  };

  const request = budget
    ? withSupabaseRequestBudget(budget, () => supabaseSelectMany("scans", "select=id"))
    : supabaseSelectMany("scans", "select=id");
  await Promise.resolve();
  await Promise.resolve();
  return { request, requestSignal };
}

try {
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  delete process.env.SUPABASE_ANON_KEY;

  {
    const timers = installMockTimers();
    globalThis.fetch = async () => jsonResponse([]);

    await supabaseSelectMany("scans", "select=id");

    assert.equal(DEFAULT_SUPABASE_REQUEST_TIMEOUT_MS, 15_000);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, DEFAULT_SUPABASE_REQUEST_TIMEOUT_MS);
    assert.equal(timers[0].cleared, true);
  }

  {
    const timers = installMockTimers();
    globalThis.fetch = async () => jsonResponse([]);

    await withSupabaseRequestBudget({ timeoutMs: 1_250 }, () =>
      supabaseSelectMany("scans", "select=id")
    );

    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, 1_250);
    assert.equal(timers[0].cleared, true);
  }

  {
    const timers = installMockTimers();
    globalThis.fetch = async () => jsonResponse([]);

    await withSupabaseRequestBudget({ timeoutMs: 30_000 }, () =>
      supabaseSelectMany("scans", "select=id")
    );

    assert.equal(timers.length, 1);
    assert.equal(timers[0].delay, DEFAULT_SUPABASE_REQUEST_TIMEOUT_MS);
    assert.equal(timers[0].cleared, true);
  }

  {
    const timers = installMockTimers();
    const parentController = new AbortController();
    const parentReason = new DOMException("Scan stage ended.", "AbortError");
    const { request, requestSignal } = await startBodyReadRequest({
      signal: parentController.signal,
      timeoutMs: 2_000
    });

    assert.equal(getEventListeners(parentController.signal, "abort").length, 1);
    parentController.abort(parentReason);

    await assert.rejects(request, (error) => error === parentReason);
    assert.equal(requestSignal.aborted, true);
    assert.equal(requestSignal.reason, parentReason);
    assert.equal(getEventListeners(parentController.signal, "abort").length, 0);
    assert.equal(getEventListeners(requestSignal, "abort").length, 0);
    assert.equal(timers[0].cleared, true);
  }

  {
    const timers = installMockTimers();
    const parentController = new AbortController();
    const { request, requestSignal } = await startBodyReadRequest({
      signal: parentController.signal,
      timeoutMs: 750
    });

    assert.equal(getEventListeners(parentController.signal, "abort").length, 1);
    assert.equal(timers[0].delay, 750);
    timers[0].callback();

    await assert.rejects(request, /Supabase select failed timed out after 750ms\./);
    assert.equal(requestSignal.aborted, true);
    assert.equal(requestSignal.reason.name, "TimeoutError");
    assert.equal(getEventListeners(parentController.signal, "abort").length, 0);
    assert.equal(getEventListeners(requestSignal, "abort").length, 0);
    assert.equal(timers[0].cleared, true);
  }

  console.log("PASS Supabase requests use bounded budgets and clean up abort listeners");
} finally {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;

  if (originalEnv.url === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalEnv.url;
  if (originalEnv.serviceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.serviceRoleKey;
  if (originalEnv.anonKey === undefined) delete process.env.SUPABASE_ANON_KEY;
  else process.env.SUPABASE_ANON_KEY = originalEnv.anonKey;
}
