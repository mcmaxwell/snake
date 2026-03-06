const { MongoClient } = require('mongodb');

let cachedClient = null;

async function getCollection() {
  if (!cachedClient) {
    cachedClient = new MongoClient(process.env.MONGODB_URI);
    await cachedClient.connect();
  }
  const db = cachedClient.db('snake');
  const collection = db.collection('running_dino_highscores');
  await collection.createIndex({ updated_at: -1 });
  return collection;
}

module.exports = async function handler(req, res) {
  try {
    const collection = await getCollection();
    const singletonId = 'global';

    if (req.method === 'GET') {
      const doc = await collection.findOne({ _id: singletonId });
      return res.status(200).json({
        daily_high: doc ? Number(doc.daily_high) || 0 : 0,
        all_time_high: doc ? Number(doc.all_time_high) || 0 : 0,
        daily_date: doc && typeof doc.daily_date === 'string' ? doc.daily_date : null,
        updated_at: doc ? doc.updated_at : null
      });
    }

    if (req.method === 'POST') {
      const { daily_high, all_time_high, daily_date, reset_all_time, reset_all_highs } = req.body || {};

      if (reset_all_highs === true) {
        const today = new Date().toISOString().slice(0, 10);
        const updateDoc = {
          _id: singletonId,
          daily_high: 0,
          all_time_high: 0,
          daily_date: today,
          updated_at: new Date()
        };

        await collection.updateOne(
          { _id: singletonId },
          { $set: updateDoc },
          { upsert: true }
        );

        return res.status(200).json(updateDoc);
      }

      if (reset_all_time === true) {
        const existing = await collection.findOne({ _id: singletonId });
        const today = new Date().toISOString().slice(0, 10);
        const updateDoc = {
          _id: singletonId,
          daily_high: existing ? Number(existing.daily_high) || 0 : 0,
          all_time_high: 0,
          daily_date: existing && typeof existing.daily_date === 'string' ? existing.daily_date : today,
          updated_at: new Date()
        };

        await collection.updateOne(
          { _id: singletonId },
          { $set: updateDoc },
          { upsert: true }
        );

        return res.status(200).json(updateDoc);
      }

      if (typeof daily_high !== 'number' || !Number.isInteger(daily_high) || daily_high < 0 || daily_high > 1000000000) {
        return res.status(400).json({ error: 'daily_high must be an integer between 0 and 1000000000' });
      }

      if (typeof all_time_high !== 'number' || !Number.isInteger(all_time_high) || all_time_high < 0 || all_time_high > 1000000000) {
        return res.status(400).json({ error: 'all_time_high must be an integer between 0 and 1000000000' });
      }

      if (typeof daily_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(daily_date)) {
        return res.status(400).json({ error: 'daily_date must be in YYYY-MM-DD format' });
      }

      const existing = await collection.findOne({ _id: singletonId });
      const existingDailyDate = existing && typeof existing.daily_date === 'string' ? existing.daily_date : null;
      const existingDailyHigh = existing ? Number(existing.daily_high) || 0 : 0;
      const existingAllTime = existing ? Number(existing.all_time_high) || 0 : 0;

      const mergedDaily = existingDailyDate === daily_date
        ? Math.max(existingDailyHigh, daily_high)
        : daily_high;
      const mergedAllTime = Math.max(existingAllTime, all_time_high);

      const updateDoc = {
        _id: singletonId,
        daily_high: mergedDaily,
        all_time_high: mergedAllTime,
        daily_date,
        updated_at: new Date()
      };

      await collection.updateOne(
        { _id: singletonId },
        { $set: updateDoc },
        { upsert: true }
      );

      return res.status(200).json(updateDoc);
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Running Dino highscore API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
