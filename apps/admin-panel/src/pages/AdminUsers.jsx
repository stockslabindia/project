import React, { useState, useEffect } from 'react';
import { Search, Plus, Shield, UserCog, Key, Trash2, Power, Loader2 } from 'lucide-react';
import { adminApi } from '../services/adminApi';

export default function AdminUsers() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');

  // New admin state
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
    role: 'operator',
    password_hash: 'Temp@12345' // Usually handled securely by backend, passing plain for now
  });

  const roles = ['super_admin', 'admin', 'operator', 'finance', 'support'];

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await adminApi.getCrmModule('admin-users');
      setAdmins(res.admin_users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreateAdmin = async () => {
    if (!newAdmin.name || !newAdmin.email) return alert('Name and Email required');
    try {
      await adminApi.createCrmModule('admin-users', newAdmin);
      setShowAddModal(false);
      setNewAdmin({ name: '', email: '', role: 'operator', password_hash: 'Temp@12345' });
      fetchAdmins();
    } catch (err) {
      console.error(err);
      alert('Failed to create admin user');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove admin access? This action cannot be undone.')) return;
    try {
      await adminApi.deleteCrmModule('admin-users', id);
      fetchAdmins();
    } catch (err) {
      console.error(err);
      alert('Failed to delete admin');
    }
  };

  const handleResetPassword = async (adminId, email) => {
    const password = window.prompt(`Enter new password for ${email}:`);
    if (!password) return;
    if (password.length < 6) return alert('Password must be at least 6 characters.');
    try {
      await adminApi.resetAdminPassword(adminId, password);
      alert('Password reset successfully!');
      fetchAdmins();
    } catch (err) {
      alert('Failed to reset password: ' + err.message);
    }
  };

  const handleEditRole = async (adminId, name, currentRole) => {
    const roleListStr = roles.join(', ');
    const newRole = window.prompt(`Enter new role for ${name} (options: ${roleListStr}):`, currentRole);
    if (!newRole) return;
    const resolvedRole = newRole.trim().toLowerCase();
    if (!roles.includes(resolvedRole)) {
      return alert(`Invalid role. Options are: ${roleListStr}`);
    }
    try {
      await adminApi.updateCrmModule('admin-users', adminId, { role: resolvedRole });
      alert('Admin role updated successfully!');
      fetchAdmins();
    } catch (err) {
      alert('Failed to update role: ' + err.message);
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      'super_admin': 'bg-red-100 text-red-700 border-red-200',
      'admin': 'bg-orange-100 text-orange-700 border-orange-200',
      'support': 'bg-blue-100 text-blue-700 border-blue-200',
      'finance': 'bg-green-100 text-green-700 border-green-200',
      'operator': 'bg-purple-100 text-purple-700 border-purple-200',
    };
    return colors[role] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const filteredAdmins = admins.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'All Roles' || a.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Add, remove, and manage admin staff accounts and their roles.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAdmins} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">Refresh</button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Admin User
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-2 text-sm font-medium">
            <UserCog className="w-4 h-4 text-blue-500" /> Total Admins
          </div>
          <div className="text-2xl font-bold text-gray-900">{admins.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-2 text-sm font-medium">
            <Power className="w-4 h-4 text-green-500" /> Active Now
          </div>
          <div className="text-2xl font-bold text-green-600">{admins.filter(a => a.is_active).length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-2 text-sm font-medium">
            <Shield className="w-4 h-4 text-red-500" /> Super Admins
          </div>
          <div className="text-2xl font-bold text-gray-900">{admins.filter(a => a.role === 'super_admin').length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 text-gray-500 mb-2 text-sm font-medium">
            <Key className="w-4 h-4 text-orange-500" /> Roles Defined
          </div>
          <div className="text-2xl font-bold text-gray-900">{roles.length}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 items-center justify-between bg-gray-50">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search admin by name or email..." className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>All Roles</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 flex justify-center text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading admin users...</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">Admin</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Login</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAdmins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold uppercase">
                          {admin.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{admin.name}</div>
                          <div className="text-xs text-gray-500">{admin.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border uppercase ${getRoleBadge(admin.role)}`}>
                        {admin.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${admin.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className={`text-xs font-medium ${admin.is_active ? 'text-green-700' : 'text-gray-500'}`}>
                          {admin.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {admin.last_login_at ? new Date(admin.last_login_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(admin.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleResetPassword(admin.id, admin.email)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Reset Password">
                          <Key className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEditRole(admin.id, admin.name, admin.role)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="Edit Role">
                          <UserCog className="w-4 h-4" />
                        </button>
                        {admin.role !== 'super_admin' && (
                          <button onClick={() => handleDelete(admin.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAdmins.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-500">No admins found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Add New Admin User</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input type="text" value={newAdmin.name} onChange={e => setNewAdmin({...newAdmin, name: e.target.value})} className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Rahul Sharma" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input type="email" value={newAdmin.email} onChange={e => setNewAdmin({...newAdmin, email: e.target.value})} className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="user@stockslab.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Role</label>
                <select value={newAdmin.role} onChange={e => setNewAdmin({...newAdmin, role: e.target.value})} className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize">
                  {roles.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" value="Temp@12345" readOnly />
                <p className="text-xs text-gray-400 mt-1">User will be forced to reset on first login.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleCreateAdmin} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm">
                Create Admin Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
