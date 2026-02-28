"use client";

import { useState, useEffect } from "react";
import {
    Users, ShieldCheck, UserX, UserCheck, RefreshCw,
    KeyRound, X, Eye, EyeOff, Trash2, UserPlus
} from "lucide-react";
import AdminLayout from "@/components/dashboard/AdminLayout";

const ROLES = ["admin", "manager", "sales_rep"];

interface User {
    id: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: string;
}

type ModalType = "password" | "add" | "delete" | null;

interface ModalState {
    type: ModalType;
    userId?: string;
    email?: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null);
    const [modal, setModal] = useState<ModalState>({ type: null });

    // Form state for password change
    const [newPassword, setNewPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [passwordError, setPasswordError] = useState("");
    const [savingPassword, setSavingPassword] = useState(false);

    // Form state for add user
    const [addForm, setAddForm] = useState({ email: "", password: "", role: "sales_rep" });
    const [showAddPassword, setShowAddPassword] = useState(false);
    const [addError, setAddError] = useState("");
    const [savingAdd, setSavingAdd] = useState(false);

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/admin/users");
            const data = await res.json();
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Failed to fetch users:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const closeModal = () => {
        setModal({ type: null });
        setNewPassword(""); setPasswordError(""); setShowPassword(false);
        setAddForm({ email: "", password: "", role: "sales_rep" }); setAddError(""); setShowAddPassword(false);
    };

    // --- Handlers ---

    const handleToggleActive = async (id: string, currentActive: boolean) => {
        setUpdating(id);
        try {
            await fetch(`/api/admin/users/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_active: !currentActive }),
            });
            fetchUsers();
        } catch (err) { console.error(err); }
        finally { setUpdating(null); }
    };

    const handleRoleChange = async (id: string, role: string) => {
        setUpdating(id);
        try {
            await fetch(`/api/admin/users/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role }),
            });
            fetchUsers();
        } catch (err) { console.error(err); }
        finally { setUpdating(null); }
    };

    const handleChangePassword = async () => {
        if (!modal.userId) return;
        if (newPassword.length < 8) { setPasswordError("Password must be at least 8 characters."); return; }
        setSavingPassword(true); setPasswordError("");
        try {
            const res = await fetch(`/api/admin/users/${modal.userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: newPassword }),
            });
            const data = await res.json();
            if (!res.ok) { setPasswordError(data.error || "Failed to update password."); return; }
            closeModal();
        } catch { setPasswordError("An unexpected error occurred."); }
        finally { setSavingPassword(false); }
    };

    const handleAddUser = async () => {
        const { email, password, role } = addForm;
        if (!email || !password) { setAddError("Email and password are required."); return; }
        if (password.length < 8) { setAddError("Password must be at least 8 characters."); return; }
        setSavingAdd(true); setAddError("");
        try {
            const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, role }),
            });
            const data = await res.json();
            if (!res.ok) { setAddError(data.error || "Failed to create user."); return; }
            closeModal();
            fetchUsers();
        } catch { setAddError("An unexpected error occurred."); }
        finally { setSavingAdd(false); }
    };

    const handleDeleteUser = async () => {
        if (!modal.userId) return;
        setUpdating(modal.userId);
        try {
            const res = await fetch(`/api/admin/users/${modal.userId}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) { alert(data.error || "Failed to delete user."); return; }
            closeModal();
            fetchUsers();
        } catch (err) { console.error(err); }
        finally { setUpdating(null); }
    };

    const activeUsers = users.filter(u => u.is_active).length;

    return (
        <AdminLayout>
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* Stats + Add Button */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 flex-1">
                        <StatCard title="Total Members" value={users.length} icon={<Users />} color="text-accent" />
                        <StatCard title="Active" value={activeUsers} icon={<UserCheck />} color="text-green-400" />
                        <StatCard title="Inactive" value={users.length - activeUsers} icon={<UserX />} color="text-red-400" />
                    </div>
                    <button
                        onClick={() => setModal({ type: "add" })}
                        className="w-full lg:w-auto shrink-0 flex items-center justify-center gap-2 px-6 py-3 bg-accent text-background font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all text-sm"
                    >
                        <UserPlus className="w-4 h-4" />
                        Add User
                    </button>
                </div>

                {/* Users Table */}
                <div className="border border-border/50 rounded-3xl bg-surface/10 overflow-hidden">
                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left">
                        <thead className="bg-surface/30 border-b border-border/50">
                            <tr>
                                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted">User</th>
                                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Role</th>
                                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Status</th>
                                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted">Joined</th>
                                <th className="px-8 py-5 text-xs font-semibold uppercase tracking-widest text-muted text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {loading ? (
                                <tr><td colSpan={5} className="px-8 py-12 text-center text-muted">Loading team...</td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan={5} className="px-8 py-12 text-center text-muted">No users found.</td></tr>
                            ) : (
                                users.map(user => (
                                    <tr key={user.id} className="hover:bg-accent/5 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-xs font-bold uppercase">
                                                    {user.email[0]}
                                                </div>
                                                <span className="text-sm font-medium">{user.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <select
                                                value={user.role}
                                                onChange={e => handleRoleChange(user.id, e.target.value)}
                                                disabled={updating === user.id}
                                                className="bg-surface/50 border border-border/50 rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent/50 transition-all"
                                            >
                                                {ROLES.map(r => (
                                                    <option key={r} value={r}>{r.replace("_", " ")}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-8 py-5">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter border ${user.is_active ? 'text-green-400 bg-green-400/10 border-green-400/20' : 'text-red-400 bg-red-400/10 border-red-400/20'}`}>
                                                {user.is_active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                                                {user.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-sm text-muted">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {/* Change password */}
                                                <button
                                                    onClick={() => setModal({ type: "password", userId: user.id, email: user.email })}
                                                    className="p-2 rounded-xl hover:bg-accent/10 hover:text-accent text-muted transition-all"
                                                    title="Change password"
                                                >
                                                    <KeyRound className="w-4 h-4" />
                                                </button>
                                                {/* Toggle active */}
                                                <button
                                                    onClick={() => handleToggleActive(user.id, user.is_active)}
                                                    disabled={updating === user.id}
                                                    className={`p-2 rounded-xl transition-all ${user.is_active ? 'hover:bg-yellow-500/10 hover:text-yellow-400' : 'hover:bg-green-500/10 hover:text-green-400'} text-muted`}
                                                    title={user.is_active ? "Deactivate user" : "Activate user"}
                                                >
                                                    {updating === user.id
                                                        ? <RefreshCw className="w-4 h-4 animate-spin" />
                                                        : user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />
                                                    }
                                                </button>
                                                {/* Delete */}
                                                <button
                                                    onClick={() => setModal({ type: "delete", userId: user.id, email: user.email })}
                                                    className="p-2 rounded-xl hover:bg-red-500/10 hover:text-red-400 text-muted transition-all"
                                                    title="Delete user"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>

                {/* Notice */}
                <div className="flex items-center gap-3 px-6 py-4 rounded-2xl border border-accent/20 bg-accent/5 text-sm text-muted">
                    <ShieldCheck className="w-5 h-5 text-accent shrink-0" />
                    Role changes take effect on next login. Deactivated users are immediately blocked. Deletion is permanent.
                </div>
            </div>

            {/* ── Modals ── */}

            {/* Add User */}
            {modal.type === "add" && (
                <Modal title="Add New User" icon={<UserPlus className="w-5 h-5" />} onClose={closeModal}>
                    <div className="space-y-4">
                        <Field label="Email Address">
                            <input
                                type="email"
                                value={addForm.email}
                                onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                                placeholder="name@company.com"
                                autoFocus
                                className="w-full bg-background border border-border/50 rounded-2xl py-3 px-4 focus:outline-none focus:border-accent/50 transition-all text-sm"
                            />
                        </Field>
                        <Field label="Password">
                            <div className="relative">
                                <input
                                    type={showAddPassword ? "text" : "password"}
                                    value={addForm.password}
                                    onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
                                    placeholder="Min. 8 characters"
                                    className="w-full bg-background border border-border/50 rounded-2xl py-3 px-4 pr-12 focus:outline-none focus:border-accent/50 transition-all text-sm"
                                />
                                <button type="button" onClick={() => setShowAddPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-foreground transition-colors">
                                    {showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </Field>
                        <Field label="Role">
                            <select
                                value={addForm.role}
                                onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
                                className="w-full bg-background border border-border/50 rounded-2xl py-3 px-4 focus:outline-none focus:border-accent/50 transition-all text-sm"
                            >
                                {ROLES.map(r => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                            </select>
                        </Field>
                        {addError && <p className="text-xs text-red-400">{addError}</p>}
                        <ModalActions
                            onCancel={closeModal}
                            onConfirm={handleAddUser}
                            confirmLabel={savingAdd ? "Creating..." : "Create User"}
                            disabled={savingAdd || !addForm.email || !addForm.password}
                        />
                    </div>
                </Modal>
            )}

            {/* Change Password */}
            {modal.type === "password" && (
                <Modal title="Change Password" icon={<KeyRound className="w-5 h-5" />} subtitle={modal.email} onClose={closeModal}>
                    <div className="space-y-4">
                        <Field label="New Password">
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={e => { setNewPassword(e.target.value); setPasswordError(""); }}
                                    onKeyDown={e => e.key === "Enter" && handleChangePassword()}
                                    placeholder="Min. 8 characters"
                                    autoFocus
                                    className="w-full bg-background border border-border/50 rounded-2xl py-3 px-4 pr-12 focus:outline-none focus:border-accent/50 transition-all text-sm"
                                />
                                <button type="button" onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-foreground transition-colors">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </Field>
                        {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
                        <ModalActions
                            onCancel={closeModal}
                            onConfirm={handleChangePassword}
                            confirmLabel={savingPassword ? "Saving..." : "Set Password"}
                            disabled={savingPassword || !newPassword}
                        />
                    </div>
                </Modal>
            )}

            {/* Delete Confirm */}
            {modal.type === "delete" && (
                <Modal title="Delete User" icon={<Trash2 className="w-5 h-5 text-red-400" />} onClose={closeModal}>
                    <div className="space-y-6">
                        <p className="text-sm text-muted leading-relaxed">
                            Are you sure you want to permanently delete{" "}
                            <span className="text-foreground font-medium">{modal.email}</span>?
                            This action cannot be undone and will remove all their data.
                        </p>
                        <ModalActions
                            onCancel={closeModal}
                            onConfirm={handleDeleteUser}
                            confirmLabel="Delete Permanently"
                            confirmClass="bg-red-500 hover:bg-red-400"
                            disabled={updating === modal.userId}
                        />
                    </div>
                </Modal>
            )}
        </AdminLayout>
    );
}

// ── Shared sub-components ──

function Modal({ title, subtitle, icon, onClose, children }: {
    title: string; subtitle?: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 lg:mx-0 bg-surface border border-border/50 rounded-3xl p-6 lg:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-accent/10 border border-accent/20 text-accent">
                            {icon}
                        </div>
                        <div>
                            <h3 className="font-serif text-lg">{title}</h3>
                            {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface/80 text-muted hover:text-foreground transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-muted font-bold">{label}</label>
            {children}
        </div>
    );
}

function ModalActions({ onCancel, onConfirm, confirmLabel, confirmClass = "bg-accent", disabled }: {
    onCancel: () => void; onConfirm: () => void; confirmLabel: string; confirmClass?: string; disabled?: boolean;
}) {
    return (
        <div className="flex gap-3 pt-2">
            <button onClick={onCancel}
                className="flex-1 py-3 rounded-2xl border border-border/50 text-sm text-muted hover:text-foreground hover:border-foreground/30 transition-all">
                Cancel
            </button>
            <button onClick={onConfirm} disabled={disabled}
                className={`flex-1 py-3 ${confirmClass} text-background font-bold rounded-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 text-sm`}>
                {confirmLabel}
            </button>
        </div>
    );
}

function StatCard({ title, value, icon, color }: any) {
    return (
        <div className="p-6 rounded-3xl bg-surface/20 border border-border/50 flex items-center justify-between">
            <div className="space-y-1">
                <p className="text-xs uppercase tracking-widest text-muted font-bold">{title}</p>
                <p className={`text-3xl font-serif ${color}`}>{value}</p>
            </div>
            <div className={`p-3 rounded-2xl bg-background/50 border border-border/50 ${color}`}>
                {icon}
            </div>
        </div>
    );
}
