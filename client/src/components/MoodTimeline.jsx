import React from 'react';

const moodColor = (m) => ({
  angry: '#ef4444',
  sad: '#3b82f6',
  happy: '#f59e0b',
  calm: '#10b981',
  tired: '#8b5cf6'
}[m] || '#6b7280');

export default function MoodTimeline({ days }) {
  if (!days || days.length === 0) {
    return <div className="status">No daily mood data yet.</div>;
  }
  return (
    <div className="timeline">
      {days.map((d) => (
        <div key={d.date} className="timeline-row">
          <div className="timeline-date">{d.date}</div>
          <div className="timeline-mood" style={{ color: moodColor(d.mood), borderColor: moodColor(d.mood) }}>
            {d.mood?.toUpperCase()}
          </div>
        </div>
      ))}
    </div>
  );
}
