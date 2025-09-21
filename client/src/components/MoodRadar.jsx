import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

export default function MoodRadar({ data }) {
  const maxValue = 10; // adjust if your mood scale differs
  return (
    <div style={{ width: '100%', height: 420 }}>
      <ResponsiveContainer>
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="mood" />
          <PolarRadiusAxis angle={30} domain={[0, maxValue]} />
          <Radar name="Average" dataKey="value" stroke="#175D45" fill="#2BA57A" fillOpacity={0.5} />
          <Tooltip formatter={(v) => Number(v).toFixed(2)} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
