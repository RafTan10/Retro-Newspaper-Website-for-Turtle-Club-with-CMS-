import { isConnected } from "./issues";

// Editor sign-in. Only accounts listed in the admins table can use the CMS.

export type Editor = { email: string };

async function client() {
  const { supabase } = await import("./supabase");
  return supabase!;
}

async function isEditor(userId: string): Promise<boolean> {
  const { data, error } = await (await client()).from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  return !error && Boolean(data);
}

/** The signed-in editor, or null. Always null in mock mode, which needs no sign-in. */
export async function getEditor(): Promise<Editor | null> {
  if (!isConnected) return null;
  const { data } = await (await client()).auth.getSession();
  const user = data.session?.user;
  if (!user || !(await isEditor(user.id))) return null;
  return { email: user.email ?? "" };
}

export async function signIn(email: string, password: string): Promise<Editor> {
  const sb = await client();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    if (/invalid login/i.test(error.message)) throw new Error("That email and password don't match. Check them and try again.");
    if (/fetch|network/i.test(error.message)) throw new Error("Couldn't reach the server. Check your internet connection and try again.");
    throw new Error(`Couldn't sign in: ${error.message}`);
  }
  if (!(await isEditor(data.user.id))) {
    await sb.auth.signOut();
    throw new Error("This account isn't an editor. Ask the site owner to add you in Supabase.");
  }
  return { email: data.user.email ?? email };
}

export async function signOut(): Promise<void> {
  if (!isConnected) return;
  await (await client()).auth.signOut();
}

/** Calls back when the session ends elsewhere (signed out in another tab, expired) */
export async function onSignedOut(callback: () => void): Promise<() => void> {
  if (!isConnected) return () => {};
  const { data } = (await client()).auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") callback();
  });
  return () => data.subscription.unsubscribe();
}
