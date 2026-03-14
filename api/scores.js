const { MongoClient } = require('mongodb');

let cachedClient = null;

async function getCollection() {
  if (!cachedClient) {
    cachedClient = new MongoClient(process.env.MONGODB_URI);
    await cachedClient.connect();
  }
  const db = cachedClient.db('snake');
  const collection = db.collection('leaderboard');
  await collection.createIndex({ player_name: 1, score: -1, created_at: 1 });
  await collection.createIndex({ score: -1, created_at: 1 });
  return collection;
}

module.exports = async function handler(req, res) {
  try {
    const collection = await getCollection();

    if (req.method === 'GET') {
      const limitParam = parseInt(req.query.limit) || 10;
      const limit = Math.min(Math.max(limitParam, 1), 100);

      // Keep only each player's best historical score in leaderboard output.
      const scores = await collection.aggregate([
        { $sort: { score: -1, created_at: 1 } },
        {
          $group: {
            _id: '$player_name',
            score: { $first: '$score' },
            created_at: { $first: '$created_at' }
          }
        },
        {
          $project: {
            _id: 0,
            player_name: '$_id',
            score: 1,
            created_at: 1
          }
        },
        { $sort: { score: -1, created_at: 1 } },
        { $limit: limit }
      ]).toArray();

      return res.status(200).json(scores);
    }

    if (req.method === 'POST') {
      const { player_name, score } = req.body;

      if (!player_name || typeof player_name !== 'string') {
        return res.status(400).json({ error: 'player_name is required' });
      }

      const trimmed = player_name.trim();
      if (trimmed.length < 1 || trimmed.length > 20 || !/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        return res.status(400).json({ error: 'player_name must be 1-20 alphanumeric characters (underscores allowed)' });
      }

      if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 1000000) {
        return res.status(400).json({ error: 'score must be an integer between 0 and 1000000' });
      }

      const existing = await collection
        .find(
          { player_name: trimmed },
          { projection: { _id: 1, score: 1, created_at: 1 } }
        )
        .sort({ score: -1, created_at: 1 })
        .limit(1)
        .next();

      let storedScore = score;
      let improved = true;

      if (existing) {
        if (score > existing.score) {
          await collection.updateOne(
            { _id: existing._id },
            {
              $set: {
                score,
                created_at: new Date()
              }
            }
          );
        } else {
          storedScore = existing.score;
          improved = false;
        }
      } else {
        await collection.insertOne({
          player_name: trimmed,
          score,
          created_at: new Date()
        });
      }

      const rankResult = await collection.aggregate([
        { $sort: { score: -1, created_at: 1 } },
        {
          $group: {
            _id: '$player_name',
            score: { $first: '$score' }
          }
        },
        { $match: { score: { $gt: storedScore } } },
        { $count: 'count' }
      ]).toArray();
      const rank = rankResult[0] ? rankResult[0].count : 0;

      return res.status(201).json({
        player_name: trimmed,
        score: storedScore,
        improved,
        rank: rank + 1
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
