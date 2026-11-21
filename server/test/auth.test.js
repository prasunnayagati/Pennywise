import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createAuth } from "../src/auth.js";

async function createTemporaryAuth(t, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pennywise-auth-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const auth = createAuth({
    filePath: path.join(directory, "auth.json"),
    ...options
  });
  const setupToken = await auth.initialize();
  await auth.setupAccount(setupToken, "owner@example.com", "initial-password-123");
  return { auth, filePath: path.join(directory, "auth.json") };
}

test("initial credentials are hashed and can authenticate", async t => {
  const { auth, filePath } = await createTemporaryAuth(t);
  const saved = JSON.parse(await fs.readFile(filePath, "utf8"));

  assert.equal(saved.username, "owner@example.com");
  assert.equal(JSON.stringify(saved).includes("initial-password-123"), false);
  assert.equal(await auth.verifyCredentials("OWNER@example.com", "initial-password-123"), true);
  assert.equal(await auth.verifyCredentials("owner@example.com", "wrong-password"), false);
  assert.equal(await auth.verifyCredentials("other@example.com", "initial-password-123"), false);
});

test("changing a password invalidates existing sessions and persists the new password", async t => {
  const { auth, filePath } = await createTemporaryAuth(t);
  const response = { cookie(name, value) { this.name = name; this.value = value; } };
  auth.setSessionCookie({ secure: false }, response);
  const request = { headers: { cookie: `${response.name}=${response.value}` } };

  assert.deepEqual(auth.getSession(request), { username: "owner@example.com" });
  await assert.rejects(auth.changePassword("owner@example.com", "wrong-password", "new-password-123"), /Current password is incorrect/);
  await auth.changePassword("owner@example.com", "initial-password-123", "new-password-123");
  assert.equal(auth.getSession(request), null);

  const restartedAuth = createAuth({ filePath });
  await restartedAuth.initialize();
  assert.equal(await restartedAuth.verifyCredentials("owner@example.com", "initial-password-123"), false);
  assert.equal(await restartedAuth.verifyCredentials("owner@example.com", "new-password-123"), true);
});

test("session cookies expire", async t => {
  let timestamp = 1_000;
  const { auth } = await createTemporaryAuth(t, { now: () => timestamp });
  const response = { cookie(name, value) { this.name = name; this.value = value; } };
  auth.setSessionCookie({ secure: false }, response);

  assert.ok(auth.getSession({ headers: { cookie: `${response.name}=${response.value}` } }));
  timestamp += 13 * 60 * 60 * 1000;
  assert.equal(auth.getSession({ headers: { cookie: `${response.name}=${response.value}` } }), null);
});

test("first-time setup creates and saves the owner's chosen credentials once", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pennywise-auth-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "auth.json");
  const auth = createAuth({ filePath });
  const setupToken = await auth.initialize();

  assert.equal(auth.needsSetup(), true);
  await assert.rejects(auth.setupAccount("invalid-token", "my-owner@example.com", "chosen-password-123"), /Setup token is invalid/);
  await assert.rejects(auth.setupAccount(setupToken, "not-an-email", "chosen-password-123"), /valid email address/);
  await auth.setupAccount(setupToken, "My-Owner@example.com", "chosen-password-123");
  assert.equal(auth.needsSetup(), false);
  assert.equal(await auth.verifyCredentials("my-owner@example.com", "chosen-password-123"), true);
  assert.equal((await fs.readFile(filePath, "utf8")).includes("chosen-password-123"), false);
  await assert.rejects(auth.setupAccount(setupToken, "another-owner@example.com", "another-password-123"), /already been completed/);

  const restartedAuth = createAuth({ filePath });
  assert.equal(await restartedAuth.initialize(), null);
  assert.equal(await restartedAuth.verifyCredentials("my-owner@example.com", "chosen-password-123"), true);
});

test("a configured setup token is accepted without logging or exposing a generated token", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pennywise-auth-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const setupToken = "private-setup-token-with-at-least-32-characters";
  const auth = createAuth({ filePath: path.join(directory, "auth.json"), setupToken });

  assert.equal(await auth.initialize(), null);
  await auth.setupAccount(setupToken, "owner@example.com", "private-password-123");
  assert.equal(await auth.verifyCredentials("owner@example.com", "private-password-123"), true);
});

test("first-time setup rejects weak passwords and corrupt authentication data", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pennywise-auth-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, "auth.json");

  const weakPasswordAuth = createAuth({ filePath });
  const setupToken = await weakPasswordAuth.initialize();
  await assert.rejects(weakPasswordAuth.setupAccount(setupToken, "owner@example.com", "too-short"), /between 12 and 1024 characters/);
  await fs.writeFile(filePath, JSON.stringify({ version: 1 }));
  const corruptFileAuth = createAuth({ filePath });
  await assert.rejects(corruptFileAuth.initialize(), /Authentication data is invalid/);
});

test("legacy username accounts can switch to email sign-in and revoke old sessions", async t => {
  const { auth, filePath } = await createTemporaryAuth(t);
  const saved = JSON.parse(await fs.readFile(filePath, "utf8"));
  saved.username = "legacy-owner";
  await fs.writeFile(filePath, JSON.stringify(saved));

  const legacyAuth = createAuth({ filePath });
  await legacyAuth.initialize();
  assert.equal(legacyAuth.needsEmailUpdate(), true);
  assert.equal(await legacyAuth.verifyCredentials("legacy-owner", "initial-password-123"), true);

  const response = { cookie(name, value) { this.name = name; this.value = value; } };
  legacyAuth.setSessionCookie({ secure: false }, response);
  const request = { headers: { cookie: `${response.name}=${response.value}` } };
  await legacyAuth.changeEmail("legacy-owner", "initial-password-123", "new-owner@example.com");

  assert.equal(legacyAuth.getSession(request), null);
  assert.equal(legacyAuth.needsEmailUpdate(), false);
  assert.equal(await legacyAuth.verifyCredentials("new-owner@example.com", "initial-password-123"), true);
});
