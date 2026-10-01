import { GoogleWorkspaceError, googleApiFetch, signedInGoogleEmail } from './googleWorkspaceAuth';

/**
 * Google Tasks sync for the SIGNED-IN USER ONLY.
 *
 * Google Tasks is personal: there are no shared task lists and an app can only reach the task
 * lists of the Google account that gave it the token. So the portal can only put a task into
 * Google Tasks for the person who is signed in (e.g. "my tasks" when I create / tick / edit
 * them). It cannot push a task into a colleague's Google Tasks; callers should only sync tasks
 * assigned to the current user and keep `googleTaskId` per user.
 *
 * Tasks go into a list called "SHCO Portal" in that user's Google Tasks (found, or created on
 * first use). Scope: `tasks`.
 */

const API = 'https://tasks.googleapis.com/tasks/v1';
export const GOOGLE_TASK_LIST_TITLE = 'SHCO Portal';

interface TaskList { id: string; title: string }
interface GTask { id: string; title?: string; notes?: string; status?: string; due?: string; webViewLink?: string }

const listCache = new Map<string, Promise<string>>();

/** Finds the user's "SHCO Portal" task list, creating it if missing. Returns its ID. */
export function ensureTaskList(): Promise<string> {
  const email = signedInGoogleEmail();
  const hit = listCache.get(email);
  if (hit) return hit;
  const p = (async () => {
    let pageToken = '';
    do {
      const res = await googleApiFetch('tasks', API + '/users/@me/lists?maxResults=100' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''));
      const j = await res.json() as { items?: TaskList[]; nextPageToken?: string };
      const found = (j.items || []).find((l) => l.title === GOOGLE_TASK_LIST_TITLE);
      if (found) return found.id;
      pageToken = j.nextPageToken || '';
    } while (pageToken);
    const made = await googleApiFetch('tasks', API + '/users/@me/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: GOOGLE_TASK_LIST_TITLE }),
    });
    const list = await made.json() as TaskList;
    if (!list.id) throw new GoogleWorkspaceError('Google Tasks did not create the “' + GOOGLE_TASK_LIST_TITLE + '” list.', 'unknown', 'tasks');
    return list.id;
  })();
  listCache.set(email, p);
  p.catch(() => listCache.delete(email));
  return p;
}

export interface GoogleTaskInput {
  /** Set when the task was synced before; it is updated in place (or re-created if it was deleted in Google). */
  googleTaskId?: string;
  title: string;
  notes?: string;
  /** YYYY-MM-DD. Google Tasks keeps the date only. Leave out for no due date (clears an existing one). */
  due?: string;
  completed: boolean;
}

const body = (t: GoogleTaskInput) => {
  const title = String(t.title || '').trim();
  if (!title) throw new GoogleWorkspaceError('The task needs a title.', 'bad_request', 'tasks');
  const due = String(t.due || '').trim();
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new GoogleWorkspaceError('The due date “' + due + '” is not a valid date (expected YYYY-MM-DD).', 'bad_request', 'tasks');
  return {
    title: title.slice(0, 1024),
    notes: String(t.notes || '').slice(0, 8192),
    due: due ? due + 'T00:00:00.000Z' : null,
    status: t.completed ? 'completed' : 'needsAction',
    ...(t.completed ? {} : { completed: null }),
  };
};

/**
 * Creates or updates the task in the signed-in user's "SHCO Portal" list.
 * Send the task's full current state (title, notes, due, completed).
 */
export async function upsertGoogleTask(t: GoogleTaskInput): Promise<{ googleTaskId: string; taskListId: string; webViewLink?: string }> {
  const b = body(t);
  const listId = await ensureTaskList();
  const base = API + '/lists/' + encodeURIComponent(listId) + '/tasks';
  if (t.googleTaskId) {
    try {
      const res = await googleApiFetch('tasks', base + '/' + encodeURIComponent(t.googleTaskId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(b),
      });
      const g = await res.json() as GTask;
      return { googleTaskId: g.id || t.googleTaskId, taskListId: listId, webViewLink: g.webViewLink };
    } catch (e) {
      // Deleted in Google Tasks (or the list was) → create it again below.
      if (!(e instanceof GoogleWorkspaceError && (e.status === 404 || e.status === 410))) throw e;
      listCache.delete(signedInGoogleEmail());
    }
  }
  const lid = await ensureTaskList();
  const res = await googleApiFetch('tasks', API + '/lists/' + encodeURIComponent(lid) + '/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
  });
  const g = await res.json() as GTask;
  if (!g.id) throw new GoogleWorkspaceError('Google Tasks did not return the new task.', 'unknown', 'tasks');
  return { googleTaskId: g.id, taskListId: lid, webViewLink: g.webViewLink };
}

/** Deletes the task from the signed-in user's "SHCO Portal" list. Already gone (404 / 410) counts as deleted. */
export async function deleteGoogleTask(googleTaskId: string): Promise<void> {
  if (!googleTaskId) throw new GoogleWorkspaceError('No Google Task ID to delete.', 'bad_request', 'tasks');
  const listId = await ensureTaskList();
  try {
    await googleApiFetch('tasks', API + '/lists/' + encodeURIComponent(listId) + '/tasks/' + encodeURIComponent(googleTaskId), { method: 'DELETE' });
  } catch (e) {
    if (e instanceof GoogleWorkspaceError && (e.status === 404 || e.status === 410)) return;
    throw e;
  }
}

/** Settings "Test": finds or creates the "SHCO Portal" list in the signed-in user's Google Tasks. */
export async function testGoogleTasks(): Promise<{ ok: boolean; message: string }> {
  try {
    await ensureTaskList();
    return { ok: true, message: 'The “' + GOOGLE_TASK_LIST_TITLE + '” list is ready in ' + (signedInGoogleEmail() || 'your') + ' Google Tasks.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
