import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { dataDir } from "./store.js";

const scrypt = promisify(crypto.scrypt);
const COOKIE_NAME = "pennywise_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 12;

export class AuthError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function isEmail(value) {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateEmail(value) {
  if (typeof value !== "string") throw new AuthError("Enter a valid email address.");
  const email = value.trim().toLowerCase();
  if (!isEmail(email)) throw new AuthError("Enter a valid email address.");
  return email;
}

function validatePassword(value) {
  if (typeof value !== "string" || value.length < MIN_PASSWORD_LENGTH || value.length > 1024) {
    throw new AuthError(`Password must be between ${MIN_PASSWORD_LENGTH} and 1024 characters.`);
  }
  return value;
}

async function hashPassword(password, salt) {
  return (await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })).toString("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validRecord(record) {
  return record?.version === 1
    && typeof record.username === "string"
    && isEmail(record.username)
    && typeof record.passwordSalt === "string"
    && typeof record.passwordHash === "string"
    && Buffer.from(record.passwordSalt, "base64url").length === 16
    && Buffer.from(record.passwordHash, "base64url").length === 64
    && typeof record.sessionSecret === "string"
    && Buffer.from(record.sessionSecret, "base64url").length === 32;
}

function cookieValue(req) {
  const prefix = `${COOKIE_NAME}=`;
  const entry = (req.headers.cookie || "").split(";").map(value => value.trim()).find(value => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : "";
}

export function createAuth({ filePath, now = Date.now }) {
  let record;
  let setupInProgress = false;

  async function persist(nextRecord) {
    const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(nextRecord), { mode: 0o600 });
    try {
      await fs.rename(temporaryPath, filePath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true });
      throw error;
    }
  }

  async function initialize() {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    try {
      const saved = JSON.parse(await fs.readFile(filePath, "utf8"));
      if (!validRecord(saved)) throw new Error("Authentication data is invalid; refusing to start.");
      record = saved;
      return null;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    return null;
  }

  async function setupAccount(emailValue, passwordValue) {
    if (record || setupInProgress) throw new AuthError("Account setup has already been completed.", 409);
    setupInProgress = true;
    try {
      const email = validateEmail(emailValue);
      const password = validatePassword(passwordValue);
      const passwordSalt = crypto.randomBytes(16).toString("base64url");
      const nextRecord = {
        version: 1,
        username: email,
        passwordSalt,
        passwordHash: await hashPassword(password, passwordSalt),
        sessionSecret: crypto.randomBytes(32).toString("base64url")
      };
      await persist(nextRecord);
      record = nextRecord;
    } finally {
      setupInProgress = false;
    }
  }

  async function verifyCredentials(identifier, password) {
    if (!record) return false;
    if (typeof password !== "string" || password.length > 1024) return false;
    if (typeof identifier !== "string") return false;
    let email;
    try {
      email = validateEmail(identifier);
    } catch {
      return false;
    }
    const candidateHash = await hashPassword(password, record.passwordSalt);
    const identityMatches = email === record.username;
    return safeEqual(candidateHash, record.passwordHash)
      && identityMatches;
  }

  function signSession(payload) {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", record.sessionSecret).update(encoded).digest("base64url");
    return `${encoded}.${signature}`;
  }

  function getSession(req) {
    if (!record) return null;
    const parts = cookieValue(req).split(".");
    if (parts.length !== 2) return null;
    const [encoded, suppliedSignature] = parts;
    const expectedSignature = crypto.createHmac("sha256", record.sessionSecret).update(encoded).digest("base64url");
    if (!safeEqual(suppliedSignature, expectedSignature)) return null;
    try {
      const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
      if (payload.username !== record.username || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= now()) return null;
      return { username: payload.username };
    } catch {
      return null;
    }
  }

  function setSessionCookie(req, res, username = record.username) {
    const value = signSession({ username, expiresAt: now() + SESSION_TTL_MS });
    res.cookie(COOKIE_NAME, value, {
      httpOnly: true,
      secure: req.secure || process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_TTL_MS
    });
  }

  function clearSessionCookie(req, res) {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: req.secure || process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/"
    });
  }

  async function changePassword(username, currentPassword, newPassword) {
    if (username !== record?.username) throw new AuthError("Authentication is required.", 401);
    const password = validatePassword(newPassword);
    if (!(await verifyCredentials(username, currentPassword))) throw new AuthError("Current password is incorrect.");
    const nextRecord = {
      ...record,
      passwordSalt: crypto.randomBytes(16).toString("base64url"),
      sessionSecret: crypto.randomBytes(32).toString("base64url")
    };
    nextRecord.passwordHash = await hashPassword(password, nextRecord.passwordSalt);
    await persist(nextRecord);
    record = nextRecord;
  }

  async function changeEmail(username, currentPassword, newEmail) {
    if (username !== record?.username) throw new AuthError("Authentication is required.", 401);
    const email = validateEmail(newEmail);
    if (!(await verifyCredentials(username, currentPassword))) throw new AuthError("Current password is incorrect.");
    if (email === record.username) return;
    const nextRecord = {
      ...record,
      username: email,
      sessionSecret: crypto.randomBytes(32).toString("base64url")
    };
    await persist(nextRecord);
    record = nextRecord;
  }

  function requireAuth(req, res, next) {
    res.set("Cache-Control", "no-store");
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: "Please sign in to continue." });
    req.authenticatedUser = session.username;
    next();
  }

  return {
    initialize,
    needsSetup: () => !record,
    needsEmailUpdate: () => Boolean(record) && !isEmail(record.username),
    getIdentity: () => record?.username ?? null,
    setupAccount,
    verifyCredentials,
    getSession,
    setSessionCookie,
    clearSessionCookie,
    changePassword,
    changeEmail,
    requireAuth
  };
}

export const auth = createAuth({
  filePath: path.join(dataDir, "auth.json")
});
