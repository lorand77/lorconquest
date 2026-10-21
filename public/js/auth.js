// Who is signed in, for the pages that need someone: asks the server, and sends everyone else to the sign-in page, which
// sends them back once they are in.
export async function requireUser() {
    const res = await fetch("/api/me");
    if (res.ok) return res.json();
    location.href = `/login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
    return new Promise(() => {});
}

export async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    location.href = "/login.html";
}
