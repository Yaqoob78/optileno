import React, { useState, useEffect } from 'react';
import { Send, MoreVertical, Trash2 } from 'lucide-react';
import { socket } from '../../services/realtime/socket-client';

interface Comment {
  id: string;
  author: string;
  content: string;
  created_at: string;
  replies?: Comment[];
}

interface CommentThreadProps {
  taskId: string;
  onCommentAdded?: (comment: Comment) => void;
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  taskId,
  onCommentAdded,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchComments();

    // Listen for new comments
    socket.on('collaboration:comment:added', (data: any) => {
      if (data.task_id === taskId) {
        setComments((prev) => [...prev, data.comment]);
      }
    });

    return () => {
      socket.off('collaboration:comment:added');
    };
  }, [taskId]);

  const fetchComments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/v1/tasks/${taskId}/comments`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      const data = await response.json();
      setComments(data.comments || []);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`/api/v1/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          content: newComment,
          parent_comment_id: replyingTo,
        }),
      });

      if (response.ok) {
        const comment = await response.json();
        setComments((prev) => [...prev, comment]);
        setNewComment('');
        setReplyingTo(null);
        onCommentAdded?.(comment);
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await fetch(`/api/v1/tasks/${taskId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const CommentItem: React.FC<{ comment: Comment; depth?: number }> = ({
    comment,
    depth = 0,
  }) => (
    <div className={`${depth > 0 ? 'ml-8 mt-4' : 'mt-4 pt-4 border-t border-gray-200'}`}>
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
          <span className="text-white text-sm font-medium">
            {comment.author.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{comment.author}</p>
              <p className="text-xs text-gray-500">
                {new Date(comment.created_at).toLocaleString()}
              </p>
            </div>
            <button className="p-1 hover:bg-gray-100 rounded transition">
              <MoreVertical className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <p className="mt-2 text-gray-700">{comment.content}</p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setReplyingTo(comment.id)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Reply
            </button>
            <button
              onClick={() => handleDeleteComment(comment.id)}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Replies */}
      {comment.replies?.map((reply) => (
        <CommentItem key={reply.id} comment={reply} depth={depth + 1} />
      ))}
    </div>
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Comments</h3>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No comments yet</div>
      ) : (
        <div className="space-y-2">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      {/* Add Comment Form */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        {replyingTo && (
          <div className="mb-4 p-3 bg-blue-50 rounded-md flex items-center justify-between">
            <span className="text-sm text-blue-700">
              Replying to {comments.find((c) => c.id === replyingTo)?.author}
            </span>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-blue-700 hover:text-blue-800"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex gap-3">
          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">Me</span>
          </div>
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => {
                  setNewComment('');
                  setReplyingTo(null);
                }}
                className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Send className="w-4 h-4" />
                Comment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
