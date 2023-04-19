const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const saltRounds = 10;
const session = require('express-session');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run('CREATE TABLE users (username TEXT, password TEXT, role INTEGER)');
  db.run(`INSERT INTO users (username, password) VALUES 
    ('alice', '${bcrypt.hashSync('password123', saltRounds)}', '0'), 
    ('bob', '${bcrypt.hashSync('abc123', saltRounds)}', '1'),
    ('charlie', '${bcrypt.hashSync('secret', saltRounds)}', '2')`);

  db.run('CREATE TABLE tasks (task TEXT, due_date TEXT, username TEXT, description TEXT)');
  db.run(`INSERT INTO tasks (task, due_date, username, description) VALUES 
  ('Task 1', '2023-04-30', 'alice', 'Wash All Dishes with Detergent.'),
  ('Task 2', '2023-05-15', 'alice', 'Dry Dishes on Holding Rack'),
  ('Task 3', '2023-05-01', 'bob', 'Supervise Alice')`);

});

app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'my-secret-key',
  resave: false,
  saveUninitialized: false
}));

app.get('/', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT password FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error(err.message);
      res.status(500).send('Internal Server Error');
    } else if (!row) {
      res.status(401).send('Invalid username or password');
    } else {
      const hash = row.password;
      bcrypt.compare(password, hash, (err, result) => {
        if (err) {
          console.error(err.message);
          res.status(500).send('Internal Server Error');
        } else if (!result) {
          res.status(401).send('Invalid username or password');
        } else {
          req.session.username = username;
          res.redirect('/dashboard');
        }
      });
    }
  });
});

app.get('/dashboard', (req, res) => {
    const { username } = req.session;
    if (!username) {
      res.redirect('/');
    } else {
      db.all('SELECT * FROM tasks WHERE username = ?', [username], (err, rows) => {
        if (err) {
          console.error(err.message);
          res.status(500).send('Internal Server Error');
        } else {
          const tasks = rows.map(row => ({
            id: row.id,
            task: row.task,
            description: row.description,
            dueDate: row.due_date,
            completed: row.completed
          }));
          res.render('dashboard', { username, tasks });
        }
      });
    }
  });

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
    }
    res.redirect('/');
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
