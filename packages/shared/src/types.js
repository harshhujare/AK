"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSuperAdmin = exports.isAdmin = exports.ADMIN_ROLES = void 0;
// ─── Role helpers ─────────────────────────────────────────────────────────────
exports.ADMIN_ROLES = ['SUPER_ADMIN', 'CONTENT_MANAGER'];
const isAdmin = (role) => exports.ADMIN_ROLES.includes(role);
exports.isAdmin = isAdmin;
const isSuperAdmin = (role) => role === 'SUPER_ADMIN';
exports.isSuperAdmin = isSuperAdmin;
//# sourceMappingURL=types.js.map