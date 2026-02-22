const { MongoClient } = require('mongodb');

let cachedClient = null;

async function getCollection() {
  if (!cachedClient) {
    cachedClient = new MongoClient(process.env.MONGODB_URI);
    await cachedClient.connect();
  }
  const db = cachedClient.db('snake');
  const collection = db.collection('leaderboard');
  await collection.createIndex({ score: -1, created_at: 1 });
  return collection;
}

module.exports = async function handler(req, res) {
  try {
    const collection = await getCollection();

    if (req.method === 'GET') {
      const limitParam = parseInt(req.query.limit) || 10;
      const limit = Math.min(Math.max(limitParam, 1), 100);

      const scores = await collection
        .find({}, { projection: { _id: 0, player_name: 1, score: 1, created_at: 1 } })
        .sort({ score: -1, created_at: 1 })
        .limit(limit)
        .toArray();

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

      const doc = {
        player_name: trimmed,
        score,
        created_at: new Date()
      };

      await collection.insertOne(doc);

      const rank = await collection.countDocuments({ score: { $gt: score } });

      return res.status(201).json({
        player_name: trimmed,
        score,
        created_at: doc.created_at,
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
