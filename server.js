const express = require('express');
const fs = require('fs');
const app = express();

app.use(express.json());

// Получить все данные кроме скриптов
app.get('/api/database', (req, res) => {
  const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));
  res.json(db);
});

// Сохранить все данные кроме скриптов
app.post('/api/database', (req, res) => {
  const data = req.body; // Ожидаем { users, bookmarks, settings, ... }
  // Не сохраняем scripts!
  delete data.scripts;
  fs.writeFileSync('database.json', JSON.stringify(data, null, 2));
  res.json({ success: true });
});

app.listen(3000, () => console.log('Server started on port 3000'));
