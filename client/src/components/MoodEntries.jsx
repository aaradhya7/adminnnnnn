import React, { useMemo } from 'react';

const moodColor = (m) => ({
  angry: '#ef4444',
  sad: '#3b82f6',
  happy: '#2BA57A',
  calm: '#10b981',
  tired: '#8b5cf6'
}[m] || '#6b7280');

function fmtDate(d) {
  const dt = new Date(d);
  const date = dt.toLocaleDateString();
  const time = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

export default function MoodEntries({ entries }) {
  const data = useMemo(() => entries || [], [entries]);
  if (!data || data.length === 0) return <div className="status">No mood entries found.</div>;

  const showNumerics = data.some(e => typeof e.sad === 'number' || typeof e.happy === 'number' || typeof e.angry === 'number' || typeof e.calm === 'number' || typeof e.tired === 'number');

  return (
    <div className="table-wrap">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Mood</th>
              {showNumerics && <th className="num-col">Angry</th>}
              {showNumerics && <th className="num-col">Sad</th>}
              {showNumerics && <th className="num-col">Happy</th>}
              {showNumerics && <th className="num-col">Calm</th>}
              {showNumerics && <th className="num-col">Tired</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((e, idx) => {
              const { date, time } = fmtDate(e.date);
              const color = moodColor(e.bestMood);
              return (
                <tr key={idx}>
                  <td>{date}</td>
                  <td className="muted">{time}</td>
                  <td>
                    <span className="pill" style={{ color, borderColor: color, background: `${color}12` }}>
                      {(e.bestMood || 'unknown').toUpperCase()}
                    </span>
                  </td>
                  {showNumerics && <td className="num-col">{e.angry ?? '-'}</td>}
                  {showNumerics && <td className="num-col">{e.sad ?? '-'}</td>}
                  {showNumerics && <td className="num-col">{e.happy ?? '-'}</td>}
                  {showNumerics && <td className="num-col">{e.calm ?? '-'}</td>}
                  {showNumerics && <td className="num-col">{e.tired ?? '-'}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
