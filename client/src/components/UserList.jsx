import React from 'react';

export default function UserList({ users, selectedUserId, onSelect }) {
  return (
    <div className="user-list">
      <button
        className={`user-item ${selectedUserId === 'all' ? 'active' : ''}`}
        onClick={() => onSelect('all')}
        title="All Users"
      >
        All Users
      </button>
      {users.map((u) => (
        <button
          key={u.userId}
          className={`user-item ${selectedUserId === u.userId ? 'active' : ''}`}
          onClick={() => onSelect(u.userId)}
          title={u.displayName || u.userId}
        >
          {u.displayName || u.userId}
        </button>
      ))}
    </div>
  );
}
