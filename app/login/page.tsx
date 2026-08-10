"use client";

import { useState, useEffect, useCallback } from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(null);

  // Admin user creation state
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("SUPERVISEE");
  const [createLoading, setCreateLoading] = useState(false);
  const [createStatus, setCreateStatus] = useState<{ success?: boolean; msg?: string } | null>(null);

  // User list state for Admin
  const [userList, setUserList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated) {
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) {
        setUserList(data.users);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (currentUser && (currentUser.role === "ADMIN" || currentUser.role === "SUPERADMIN")) {
      fetchUsers();
    }
  }, [currentUser, fetchUsers]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        setCurrentUser(data.user);
        setJwtToken(data.token);
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err: any) {
      setError(err.message || "Failed to reach server");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateStatus(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setCreateStatus({ success: true, msg: `User "${data.user.name}" (${data.user.role}) created successfully!` });
        setNewUserName("");
        setNewUserEmail("");
        setNewUserPassword("");
        setNewUserRole("SUPERVISEE");
        fetchUsers();
      } else {
        setCreateStatus({ success: false, msg: data.error || "Failed to create user" });
      }
    } catch (err: any) {
      setCreateStatus({ success: false, msg: err.message || "Network error" });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setJwtToken(null);
    setUserList([]);
  };

  const quickFill = (userEmail: string, userPass: string = "password123") => {
    setEmail(userEmail);
    setPassword(userPass);
    setError("");
  };

  const roleColors: Record<string, { bg: string; text: string; border: string }> = {
    SUPERADMIN: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30" },
    ADMIN: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
    SUPERVISOR: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
    SUPERVISEE: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  };

  const canManageUsers = currentUser?.role === "ADMIN" || currentUser?.role === "SUPERADMIN";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-4xl space-y-8 my-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            Supervision Application Auth
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Role-Based Authentication
          </h1>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Public self-registration is disabled. Seed initial users via <code className="text-indigo-300 font-mono">npm run seed</code>. New accounts are created by authenticated Admins.
          </p>
        </div>

        {/* Test User Credentials (Populated via CLI Seed) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider text-slate-400">
              Seeded Test Accounts (Password: <code className="text-indigo-300 font-mono">password123</code>)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any card below to pre-fill login credentials
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { role: "SUPERADMIN", email: "superadmin@example.com", label: "Super Admin" },
              { role: "ADMIN", email: "admin@example.com", label: "Admin" },
              { role: "SUPERVISOR", email: "supervisor@example.com", label: "Supervisor" },
              { role: "SUPERVISEE", email: "supervisee@example.com", label: "Supervisee" },
            ].map((item) => {
              const colors = roleColors[item.role];
              return (
                <div
                  key={item.role}
                  onClick={() => quickFill(item.email)}
                  className={`p-3 rounded-xl border ${colors.border} bg-slate-900/60 hover:bg-slate-800/80 cursor-pointer transition flex flex-col justify-between space-y-2 group`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-semibold ${colors.bg} ${colors.text}`}>
                      {item.role}
                    </span>
                    <span className="text-[11px] text-slate-500 group-hover:text-indigo-400 transition">Fill &rarr;</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-200">{item.label}</div>
                    <div className="text-xs text-slate-400 font-mono truncate">{item.email}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Auth State Panel */}
        {currentUser ? (
          <div className="space-y-6">
            
            {/* Active User Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs text-emerald-400 font-medium tracking-wide uppercase">Active Session</span>
                  <h2 className="text-2xl font-bold text-white mt-1">{currentUser.name}</h2>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition"
                >
                  Log Out
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <span className="text-xs text-slate-400 font-mono uppercase">User Profile</span>
                  <div className="text-sm text-slate-300"><strong className="text-slate-400">ID:</strong> <code className="text-xs text-indigo-300">{currentUser.id}</code></div>
                  <div className="text-sm text-slate-300"><strong className="text-slate-400">Email:</strong> {currentUser.email}</div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-sm text-slate-400">Role:</span>
                    <span className={`text-xs font-mono uppercase px-2.5 py-0.5 rounded-full font-bold ${roleColors[currentUser.role]?.bg || "bg-slate-800"} ${roleColors[currentUser.role]?.text || "text-slate-300"}`}>
                      {currentUser.role}
                    </span>
                  </div>
                </div>

                {jwtToken && (
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 flex flex-col justify-between">
                    <div>
                      <span className="text-xs text-slate-400 font-mono uppercase">JWT Auth Token</span>
                      <p className="text-[11px] text-indigo-300/80 font-mono break-all line-clamp-3 mt-1 bg-slate-900 p-2 rounded border border-slate-800">
                        {jwtToken}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">Cookie set: auth_token (HTTP-only)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Admin Controls: Create New User & View Users */}
            {canManageUsers ? (
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-sm space-y-6">
                <div className="border-b border-slate-800 pb-4">
                  <span className="text-xs text-indigo-400 font-mono uppercase">Admin Privileges</span>
                  <h3 className="text-xl font-bold text-white mt-1">Register New User Account</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    As an authenticated {currentUser.role}, you can provision new user accounts into the system.
                  </p>
                </div>

                {createStatus && (
                  <div className={`p-3 rounded-xl border text-xs font-medium ${createStatus.success ? "bg-emerald-950/60 border-emerald-800/50 text-emerald-300" : "bg-red-950/60 border-red-800/50 text-red-300"}`}>
                    {createStatus.msg}
                  </div>
                )}

                <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="e.g. Jordan Miller"
                      className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="jordan@example.com"
                      className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Assigned Role</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value="SUPERVISEE">SUPERVISEE</option>
                      <option value="SUPERVISOR">SUPERVISOR</option>
                      {currentUser.role === "SUPERADMIN" && (
                        <>
                          <option value="ADMIN">ADMIN</option>
                          <option value="SUPERADMIN">SUPERADMIN</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="sm:col-span-2 pt-2">
                    <button
                      type="submit"
                      disabled={createLoading}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                    >
                      {createLoading ? "Registering User..." : "+ Create User Account"}
                    </button>
                  </div>
                </form>

                {/* User Directory */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-200">Registered Users Directory</h4>
                    <button onClick={fetchUsers} className="text-xs text-indigo-400 hover:underline">
                      Refresh Directory
                    </button>
                  </div>

                  {loadingUsers ? (
                    <div className="text-xs text-slate-500">Loading user directory...</div>
                  ) : (
                    <div className="divide-y divide-slate-800/60 rounded-xl border border-slate-800/80 bg-slate-950/40 overflow-hidden">
                      {userList.map((usr) => {
                        const colors = roleColors[usr.role] || { bg: "bg-slate-800", text: "text-slate-300", border: "" };
                        return (
                          <div key={usr.id} className="p-3 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-semibold text-slate-200">{usr.name}</span>
                              <span className="text-slate-400 ml-2 font-mono">{usr.email}</span>
                            </div>
                            <span className={`font-mono uppercase px-2 py-0.5 rounded-full font-bold ${colors.bg} ${colors.text}`}>
                              {usr.role}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs text-center">
                User registration and management is restricted to Admin accounts. Log in as an Admin to register new users.
              </div>
            )}

          </div>
        ) : (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Sign In to Your Account</h2>
              <p className="text-xs text-slate-400 mt-1">Public registration disabled. Enter your credentials or pick a test role above.</p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/50 text-red-300 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. admin@example.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/25 disabled:opacity-50 mt-2"
              >
                {loading ? "Authenticating..." : "Sign In with JWT"}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
