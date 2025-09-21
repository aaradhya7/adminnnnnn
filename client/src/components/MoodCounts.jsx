import React from 'react';

export default function MoodCounts({ counts }) {
  if (!counts) return null;
  const items = [
    { key: 'angry', label: 'Angry' },
    { key: 'sad', label: 'Sad' },
    { key: 'happy', label: 'Happy' },
    { key: 'calm', label: 'Calm' },
    { key: 'tired', label: 'Tired' }
  ];
  return (
    <div className="counts">
      <div className="counts-title">Mood counts</div>
      <div className="counts-grid">
        {items.map(({ key, label }) => (
          <div className="count-item" key={key}>
            <div className="count-label">{label}</div>
            <div className="count-value">{counts[key] ?? 0}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
