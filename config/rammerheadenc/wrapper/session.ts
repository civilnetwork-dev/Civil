import { StrShuffler } from "./shuffler.ts";
import { buildProxyHref } from "./url.ts";

const SESSION_KEY = "session-string";

async function fetchText(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`http ${res.status} from ${url}`);
  return res.text();
}

async function sessionExists(serverBase: string, id: string) {
  const text = await fetchText(
    `${serverBase}/sessionexists?id=${encodeURIComponent(id)}`,
  );
  return text === "exists";
}

async function newSession(serverBase: string) {
  return fetchText(`${serverBase}/newsession`);
}

async function fetchShuffleDict(serverBase: string, id: string) {
  const text = await fetchText(
    `${serverBase}/api/shuffleDict?id=${encodeURIComponent(id)}`,
  );
  return JSON.parse(text) as string;
}

async function getOrCreateSession(serverBase: string) {
  const stored = localStorage.getItem(SESSION_KEY);
  if (stored && (await sessionExists(serverBase, stored))) return stored;
  const id = await newSession(serverBase);
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

export async function encode(
  baseUrl: string,
  serverBase: string,
  prefix?: string,
) {
  const sessionId = await getOrCreateSession(serverBase);
  const dict = await fetchShuffleDict(serverBase, sessionId);
  const shuffler = StrShuffler.fromDictionary(dict);
  const href = buildProxyHref(baseUrl, sessionId, shuffler, prefix);
  shuffler.free();
  return href;
}
