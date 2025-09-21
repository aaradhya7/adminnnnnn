import express from 'express';
import MindfulnessMood from '../models/MindfulnessMood.js';

const router = express.Router();

// GET /api/moods/users - list all users (alphabetical by displayName or userId)
router.get('/users', async (req, res) => {
  try {
    const users = await MindfulnessMood.aggregate([
      {
        $group: {
          _id: '$userId',
          displayName: {
            $first: {
              $ifNull: [
                '$displayName',
                {
                  $ifNull: [
                    '$userName',
                    {
                      $ifNull: [
                        '$name',
                        {
                          $ifNull: [
                            '$fullName',
                            {
                              $ifNull: [
                                { $concat: [{ $ifNull: ['$firstName', ''] }, ' ', { $ifNull: ['$lastName', ''] }] },
                                '$email'
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          }
        }
      },
      {
        $addFields: {
          displayName: {
            $cond: [
              { $or: [{ $eq: ['$displayName', null] }, { $eq: ['$displayName', ' '] }, { $eq: ['$displayName', ''] }] },
              '$_id',
              '$displayName'
            ]
          }
        }
      },
      { $addFields: { sortKey: { $toLower: '$displayName' } } },
      { $sort: { sortKey: 1 } },
      { $project: { _id: 0, userId: '$_id', displayName: 1 } }
    ]);

    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Helper to compute averages for a filter (overall or per user)
async function computeAverages(matchStage = {}) {
  const pipeline = [
    ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
    // When `mood` field exists, convert to one-hot 1/0; otherwise use numeric fields
    {
      $project: {
        lowerMood: { $toLower: '$mood' },
        angryField: { $ifNull: ['$angry', 0] },
        sadField: { $ifNull: ['$sad', 0] },
        happyField: { $ifNull: ['$happy', 0] },
        calmField: { $ifNull: ['$calm', 0] },
        tiredField: { $ifNull: ['$tired', 0] }
      }
    },
    {
      $project: {
        angryVal: {
          $cond: [
            { $in: ['$lowerMood', ['angry','sad','happy','calm','tired']] },
            { $cond: [{ $eq: ['$lowerMood', 'angry'] }, 1, 0] },
            '$angryField'
          ]
        },
        sadVal: {
          $cond: [
            { $in: ['$lowerMood', ['angry','sad','happy','calm','tired']] },
            { $cond: [{ $eq: ['$lowerMood', 'sad'] }, 1, 0] },
            '$sadField'
          ]
        },
        happyVal: {
          $cond: [
            { $in: ['$lowerMood', ['angry','sad','happy','calm','tired']] },
            { $cond: [{ $eq: ['$lowerMood', 'happy'] }, 1, 0] },
            '$happyField'
          ]
        },
        calmVal: {
          $cond: [
            { $in: ['$lowerMood', ['angry','sad','happy','calm','tired']] },
            { $cond: [{ $eq: ['$lowerMood', 'calm'] }, 1, 0] },
            '$calmField'
          ]
        },
        tiredVal: {
          $cond: [
            { $in: ['$lowerMood', ['angry','sad','happy','calm','tired']] },
            { $cond: [{ $eq: ['$lowerMood', 'tired'] }, 1, 0] },
            '$tiredField'
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        angry: { $avg: '$angryVal' },
        sad: { $avg: '$sadVal' },
        happy: { $avg: '$happyVal' },
        calm: { $avg: '$calmVal' },
        tired: { $avg: '$tiredVal' },
        count: { $sum: 1 }
      }
    },
    { $project: { _id: 0, angry: 1, sad: 1, happy: 1, calm: 1, tired: 1, count: 1 } }
  ];

  const result = await MindfulnessMood.aggregate(pipeline);
  return result[0] || { angry: 0, sad: 0, happy: 0, calm: 0, tired: 0, count: 0 };
}

// GET /api/moods/averages?userId=... (omit or userId=all for overall)
router.get('/averages', async (req, res) => {
  try {
    const { userId } = req.query;
    const matchStage = userId && userId !== 'all' ? { userId } : {};
    const data = await computeAverages(matchStage);
    res.json({ scope: userId && userId !== 'all' ? 'user' : 'all', userId, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute averages' });
  }
});

// GET /api/moods/daily?userId=... - optional daily time series for a user or all
router.get('/daily', async (req, res) => {
  try {
    const { userId } = req.query;
    const matchStage = userId && userId !== 'all' ? { userId } : {};

    const pipeline = [
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      {
        $addFields: {
          day: {
            $dateToString: { format: '%Y-%m-%d', date: '$date' }
          }
        }
      },
      {
        $group: {
          _id: '$day',
          angry: { $avg: { $ifNull: ['$angry', 0] } },
          sad: { $avg: { $ifNull: ['$sad', 0] } },
          happy: { $avg: { $ifNull: ['$happy', 0] } },
          calm: { $avg: { $ifNull: ['$calm', 0] } },
          tired: { $avg: { $ifNull: ['$tired', 0] } }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          angry: 1,
          sad: 1,
          happy: 1,
          calm: 1,
          tired: 1
        }
      }
    ];

    const series = await MindfulnessMood.aggregate(pipeline);
    res.json({ scope: userId && userId !== 'all' ? 'user' : 'all', userId, series });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute daily series' });
  }
});

// GET /api/moods/counts?userId=... - counts how many times each mood occurs for the user
// Supports 2 data shapes:
// 1) categorical: a string field `mood` equals one of angry|sad|happy|calm|tired
// 2) numeric fields: angry/sad/happy/calm/tired numeric > 0, count as occurrence
router.get('/counts', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || userId === 'all') {
      return res.status(400).json({ error: 'Provide userId for counts' });
    }

    // First, try categorical `mood` (case-insensitive)
    const categorical = await MindfulnessMood.aggregate([
      { $match: { userId, mood: { $type: 'string' } } },
      { $project: { m: { $toLower: '$mood' } } },
      { $match: { m: { $in: ['angry','sad','happy','calm','tired'] } } },
      { $group: { _id: '$m', count: { $sum: 1 } } }
    ]);

    let counts = { angry: 0, sad: 0, happy: 0, calm: 0, tired: 0 };
    if (categorical.length > 0) {
      for (const row of categorical) counts[row._id] = row.count;
      return res.json({ userId, counts, shape: 'categorical' });
    }

    // Fallback to numeric fields > 0
    const numeric = await MindfulnessMood.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          angry: { $sum: { $cond: [{ $gt: ['$angry', 0] }, 1, 0] } },
          sad: { $sum: { $cond: [{ $gt: ['$sad', 0] }, 1, 0] } },
          happy: { $sum: { $cond: [{ $gt: ['$happy', 0] }, 1, 0] } },
          calm: { $sum: { $cond: [{ $gt: ['$calm', 0] }, 1, 0] } },
          tired: { $sum: { $cond: [{ $gt: ['$tired', 0] }, 1, 0] } }
        }
      },
      { $project: { _id: 0, angry: 1, sad: 1, happy: 1, calm: 1, tired: 1 } }
    ]);

    if (numeric[0]) counts = numeric[0];
    res.json({ userId, counts, shape: 'numeric' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute counts' });
  }
});

// GET /api/moods/daily-mood?userId=... - for a specific user, returns one mood per day
// If categorical `mood` exists, it picks the latest entry per day (case-insensitive).
// If only numeric fields exist, it picks the mood with the highest numeric value for that day.
router.get('/daily-mood', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId || userId === 'all') {
      return res.status(400).json({ error: 'Provide a specific userId' });
    }

    const pipeline = [
      { $match: { userId } },
      { $addFields: { day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, lowerMood: { $toLower: '$mood' } } },
      { $sort: { date: -1, createdAt: -1 } },
      {
        $group: {
          _id: '$day',
          doc: { $first: '$$ROOT' }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          mood: {
            $cond: [
              { $in: ['$doc.lowerMood', ['angry','sad','happy','calm','tired']] },
              '$doc.lowerMood',
              {
                $let: {
                  vars: {
                    arr: [
                      { mood: 'angry', v: { $ifNull: ['$doc.angry', 0] } },
                      { mood: 'sad', v: { $ifNull: ['$doc.sad', 0] } },
                      { mood: 'happy', v: { $ifNull: ['$doc.happy', 0] } },
                      { mood: 'calm', v: { $ifNull: ['$doc.calm', 0] } },
                      { mood: 'tired', v: { $ifNull: ['$doc.tired', 0] } }
                    ]
                  },
                  in: {
                    $let: {
                      vars: { best: { $reduce: { input: '$$arr', initialValue: { mood: 'none', v: -1 }, in: { $cond: [{ $gt: ['$$this.v', '$$value.v'] }, '$$this', '$$value'] } } } },
                      in: '$$best.mood'
                    }
                  }
                }
              }
            ]
          }
        }
      },
      { $sort: { date: 1 } }
    ];

    const days = await MindfulnessMood.aggregate(pipeline);
    res.json({ userId, days });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute daily mood' });
  }
});

// GET /api/moods/entries?userId=...&limit=200 - all mood entries with timestamps for a user
// Supports categorical `mood` or numeric fields; returns a bestMood plus raw numeric values when available.
router.get('/entries', async (req, res) => {
  try {
    const { userId } = req.query;
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 1000);
    if (!userId || userId === 'all') return res.status(400).json({ error: 'Provide a specific userId' });

    const docs = await MindfulnessMood.find({ userId })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    const entries = docs.map(d => {
      const lower = (d.mood || '').toString().toLowerCase();
      let bestMood = null;
      if (['angry','sad','happy','calm','tired'].includes(lower)) {
        bestMood = lower;
      } else {
        const arr = [
          { mood: 'angry', v: Number(d.angry || 0) },
          { mood: 'sad', v: Number(d.sad || 0) },
          { mood: 'happy', v: Number(d.happy || 0) },
          { mood: 'calm', v: Number(d.calm || 0) },
          { mood: 'tired', v: Number(d.tired || 0) }
        ];
        bestMood = arr.reduce((a,b) => (b.v > a.v ? b : a), { mood: 'none', v: -1 }).mood;
      }
      return {
        date: d.date || d.createdAt,
        bestMood,
        moodRaw: d.mood || null,
        angry: d.angry ?? null,
        sad: d.sad ?? null,
        happy: d.happy ?? null,
        calm: d.calm ?? null,
        tired: d.tired ?? null
      };
    });

    res.json({ userId, count: entries.length, entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch mood entries' });
  }
});

export default router;
