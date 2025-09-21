import React, { useEffect, useMemo, useState } from 'react';
import Navbar from './components/Navbar.jsx';
import UserList from './components/UserList.jsx';
import MoodRadar from './components/MoodRadar.jsx';
import MoodCounts from './components/MoodCounts.jsx';
import MoodTimeline from './components/MoodTimeline.jsx';
import MoodEntries from './components/MoodEntries.jsx';
import { api } from './services/api.js';

const MOODS = ['angry', 'sad', 'happy', 'calm', 'tired'];

export default function App() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [averages, setAverages] = useState(null);
  const [counts, setCounts] = useState(null);
  const [dailyMoods, setDailyMoods] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await api.get('/moods/users');
        setUsers(res.users || []);
      } catch (e) {
        console.error(e);
        setError('Failed to load users');
      }
    }
    loadUsers();
  }, []);

  useEffect(() => {
    async function loadAverages() {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/moods/averages', { userId: selectedUserId });
        setAverages(res.data || null);
      } catch (e) {
        console.error(e);
        setError('Failed to load averages');
      } finally {
        setLoading(false);
      }
    }
    loadAverages();
  }, [selectedUserId]);

  // Load raw entries (most recent first)
  useEffect(() => {
    async function loadEntries() {
      if (selectedUserId === 'all') {
        setEntries([]);
        return;
      }
      try {
        const res = await api.get('/moods/entries', { userId: selectedUserId, limit: 300 });
        setEntries(res.entries || []);
      } catch (e) {
        console.error(e);
        setEntries([]);
      }
    }
    loadEntries();
  }, [selectedUserId]);

  // Load mood counts for an individual user
  useEffect(() => {
    async function loadCounts() {
      if (selectedUserId === 'all') {
        setCounts(null);
        return;
      }
      try {
        const res = await api.get('/moods/counts', { userId: selectedUserId });
        setCounts(res.counts || null);
      } catch (e) {
        console.error(e);
        setCounts(null);
      }
    }
    loadCounts();
  }, [selectedUserId]);

  // Load daily moods timeline for an individual user
  useEffect(() => {
    async function loadDaily() {
      if (selectedUserId === 'all') {
        setDailyMoods([]);
        return;
      }
      try {
        const res = await api.get('/moods/daily-mood', { userId: selectedUserId });
        setDailyMoods(res.days || []);
      } catch (e) {
        console.error(e);
        setDailyMoods([]);
      }
    }
    loadDaily();
  }, [selectedUserId]);

  const chartData = useMemo(() => {
    if (!averages) return [];
    return MOODS.map((m) => ({ mood: m.toUpperCase(), value: Math.max(0, Number(averages[m] || 0)) }));
  }, [averages]);

  const selectedUser = useMemo(() => {
    if (selectedUserId === 'all') return { userId: 'all', displayName: 'All Users' };
    return users.find((u) => u.userId === selectedUserId) || { userId: selectedUserId };
  }, [selectedUserId, users]);

  return (
    <div className="app">
      <Navbar />
      <div className="content">
        <aside className="sidebar">
          <div className="sidebar-header">Users</div>
          <UserList
            users={users}
            selectedUserId={selectedUserId}
            onSelect={setSelectedUserId}
          />
        </aside>
        <main className="main">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>{selectedUserId === 'all' ? 'All Users Average' : (selectedUser.displayName || selectedUser.userId)}</h2>
                <p className="muted">Mood averages across angry, sad, happy, calm, tired</p>
              </div>
            </div>

            {loading && <div className="status">Loading...</div>}
            {error && <div className="status error">{error}</div>}

            {!loading && !error && (
              <div className="panel-body">
                <div className="chart-wrap">
                  <MoodRadar data={chartData} />
                </div>
                {selectedUserId !== 'all' && (
                  <MoodCounts counts={counts} />
                )}
              </div>
            )}
          </div>

          {selectedUserId !== 'all' && (
            <div className="panel" style={{ marginTop: 16 }}>
              <div className="panel-header">
                <div>
                  <h3>Daily Mood Timeline</h3>
                  <p className="muted">Per day latest mood entry for this user</p>
                </div>
              </div>
              <MoodTimeline days={dailyMoods} />
            </div>
          )}

          {selectedUserId !== 'all' && (
            <div className="panel" style={{ marginTop: 16 }}>
              <div className="panel-header">
                <div>
                  <h3>All Mood Entries</h3>
                  <p className="muted">Every mood submission with timestamp (most recent first)</p>
                </div>
              </div>
              <MoodEntries entries={entries} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
