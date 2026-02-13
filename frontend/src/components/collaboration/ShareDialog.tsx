import React, { useState } from 'react';
import { X, Share2, Plus } from 'lucide-react';

interface ShareDialogProps {
  isOpen: boolean;
  taskId: string;
  onClose: () => void;
  onShare: (userId: number, permissions: string[]) => void;
}

export const ShareDialog: React.FC<ShareDialogProps> = ({
  isOpen,
  taskId,
  onClose,
  onShare,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<string[]>(['view', 'comment']);
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);

  const togglePermission = (perm: string) => {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleShare = () => {
    if (!selectedUserId) return;
    onShare(selectedUserId, permissions);
    setSelectedUserId(null);
    setPermissions(['view', 'comment']);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Share Task</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share with
            </label>
            <select
              value={selectedUserId || ''}
              onChange={(e) => setSelectedUserId(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a user...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Permissions
            </label>
            <div className="space-y-2">
              {['view', 'edit', 'comment', 'share'].map((perm) => (
                <label key={perm} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm)}
                    onChange={() => togglePermission(perm)}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700 capitalize">{perm}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={!selectedUserId}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
};
