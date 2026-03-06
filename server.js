const express = require('express');
const path = require('path');
const scoresHandler = require('./api/scores');
const runningDinoHighscoresHandler = require('./api/running-dino-highscores');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.all('/api/scores', (req, res) => scoresHandler(req, res));
app.all('/api/running-dino-highscores', (req, res) => runningDinoHighscoresHandler(req, res));

app.listen(PORT, () => {
  console.log(`Snake server running at http://localhost:${PORT}`);
});
