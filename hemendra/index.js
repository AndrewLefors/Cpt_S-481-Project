const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyparser = require('body-parser');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const session = require('express-session');

const app = express();
app.use(bodyparser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run('CREATE TABLE users (username TEXT, password TEXT, role INTEGER)');
  db.run(`INSERT INTO users (username, password,role) VALUES 
    ('alice', '${bcrypt.hashSync('password123', saltRounds)}', '0'), 
    ('bob', '${bcrypt.hashSync('abc123', saltRounds)}', '1'),
    ('charlie', '${bcrypt.hashSync('secret', saltRounds)}', '2')`);

  db.run('CREATE TABLE tasks (task TEXT, due_date TEXT, username TEXT, description TEXT,status TEXT,assignedby TEXT)');
  db.run(`INSERT INTO tasks (task, due_date, username, description,status,assignedby) VALUES 
  ('Task 1', '2023-04-30', 'alice', 'Wash All Dishes with Detergent.','inprogress','alice'),
  ('Task 7', '2023-04-30', 'bob', 'Bring clothes back','inprogress','bob'),
  ('Task 2', '2023-05-15', 'alice', 'Dry Dishes on Holding Rack','todo','alice'),
  ('Task 3', '2023-05-01', 'bob', 'Supervise Alice','todo','bob')`);

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
          task: row.task,
          description: row.description,
          due_date: row.due_date,
          status: row.status
        }));
        res.render('dashboard', { username, tasks });
      }
    });
  }
});
app.get('/taskview', (req, res) => {
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
          task: row.task,
          description: row.description,
          due_date: row.due_date,
          status: row.status,
          assignedby:row.assignedby
        }));
        db.all('SELECT * FROM tasks WHERE assignedby = ?', [username], (err, rows) => {
          if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
          } else {
            const assignedby = rows.map(row => ({
              task: row.task,
              name:row.username,
              description: row.description,
              due_date: row.due_date,
              status: row.status
            }));
            res.render('taskview', { username, tasks,assignedby });
          }
        });
        
        
      }
    });
    
  }
});

// app.post('/addtask',(req,res)=>
// {  const { username } = req.session;
//    let role1,role2;
//    const{taskid,duedate,assignee,description}=req.body;
//    db.get('SELECT role FROM users WHERE username = ?', [assignee], (err, row) => {
//     if (err) {
//       res.redirect('/taskview');
//     }
//      else if(row) {role1=row.role;}
//   });
//   db.get('SELECT role FROM users WHERE username = ?', [username], (err, row) => {
//     if (err) {
//       res.redirect('/taskview');
//     }
//     else if (row)
//      {role2=row.role;
//       if(role1<=role2)
//       {db.get('SELECT count(*) as count FROM tasks WHERE task = ? AND username = ?', [taskid, username], (err, row) => {
//         if (err) {
//           // console.error(err.message);
//           // res.status(500).send('Internal Server Error');
//           res.redirect('/taskview');
//         } else {
//           const count = row.count;
//           if (count > 0) {
//             // task already exists
//             res.redirect('/taskview');
//           } else {
//             // insert new task
//             db.run(`INSERT INTO tasks (task, due_date, username, description,status) VALUES 
//               ('${taskid}', '${duedate}', '${assignee}', '${description}','todo')`);
//             res.redirect('/taskview');
//           }
//         }
//       });

//       //  db.run(`INSERT INTO tasks (task, due_date, username, description,status) VALUES 
//       // ('${taskid}', '${duedate}', '${assignee}', '${description}','todo')`);

//       }

//     }
//   });

//   res.redirect('/taskview');
// });

app.post('/addtask', (req, res) => {
  const { username } = req.session;
  let role1, role2;
  const { taskid, duedate, assignee, description } = req.body;

  db.get('SELECT role FROM users WHERE username = ?', [assignee], (err, row) => {
    if (err) {
      res.redirect('/taskview');
    }
    else if (row) {
      role1 = row.role;
    }
    else
    {
      return;
    }
  });

  db.get('SELECT role FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      res.redirect('/taskview');
    }
    else if (row) {
      role2 = row.role;

      if (role1 <role2 ||username==assignee) {
        db.get('SELECT count(*) as count FROM tasks WHERE task = ? AND username = ?', [taskid, username], (err, row) => {
          if (err) {
            res.redirect('/taskview');
          } else {
            const count = row.count;
            if (count > 0) {
              // task already exists
              db.run(`UPDATE tasks SET due_date = ?, username = ?, description = ?, status = ?,assignedby=? WHERE task = ? AND username = ?`,
                [duedate, assignee, description, 'todo',username, taskid, assignee], (err) => {
                  if (err) {
                    console.error(err.message);
                    res.status(500).send('Internal Server Error');
                  } else {
                    res.redirect('/taskview');
                  }
                });
            } else {
              // insert new task
              db.run(`INSERT INTO tasks (task, due_date, username, description, status,assignedby) 
                VALUES ('${taskid}', '${duedate}', '${assignee}', '${description}', 'todo','${username}')`, (err) => {
                if (err) {
                  res.redirect('/taskview');
                } else {
                  res.redirect('/taskview');
                }
              });
            }
          }
        });
      }
      else
      { res.redirect('/taskview');
        
        
      }
    }
  });
});

app.post('/changestatus',(req,res)=>{
  const { username } = req.session;
  const { taskid,status} = req.body;

  db.run(`UPDATE tasks SET status = ? WHERE task = ? AND username = ?`,
        [status, taskid, username], (err) => {
        if (err) {
          console.error(err.message);
          res.status(500).send('Internal Server Error');
        } else {
          res.redirect('/taskview');
        }
      });


});

app.post('/delete',(req,res)=>
{ const { taskid} = req.body;
  const { username } = req.session;

  db.run(`DELETE from tasks WHERE task = ? AND (username = ? OR assignedby=?)`,
        [taskid, username,username], (err) => {
        if (err) {
          console.error(err.message);
          res.status(500).send('Internal Server Error');
        } else {
          res.redirect('/taskview');
        }
      });
  
  
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
