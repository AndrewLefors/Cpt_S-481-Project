const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyparser = require('body-parser');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const session = require('express-session');
const now = new Date();
const isoDateTime = now.toISOString().slice(0, 19).replace('T', ' '); // returns a string in ISO 8601 format

const app = express();
app.use(bodyparser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run('CREATE TABLE users (username TEXT, password TEXT, role INTEGER,supervisor TEXT,department TEXT,team TEXT,email TEXT,designation TEXT)');
  db.run(`INSERT INTO users (username, password,role,supervisor,department,team,email,designation) VALUES 
    ('alice', '${bcrypt.hashSync('password123', saltRounds)}', '0','bob','IT','team2','alice@wsu.edu','tech assistant'), 
    ('bob', '${bcrypt.hashSync('abc123', saltRounds)}', '1','charlie','IT','team5','bob@wsu.edu','tech manager'),
    ('charlie', '${bcrypt.hashSync('secret', saltRounds)}', '2','','IT','','charlie@wsu.edu','Department Head')`);

  db.run('CREATE TABLE tasks (task TEXT, due_date TEXT, username TEXT, description TEXT,status TEXT,assignedby TEXT)');
  db.run(`INSERT INTO tasks (task, due_date, username, description,status,assignedby) VALUES 
  ('Task 1', '2023-04-30', 'alice', 'Wash All Dishes with Detergent.','inprogress','alice'),
  ('Task 7', '2023-04-30', 'bob', 'Bring clothes back','inprogress','bob'),
  ('Task 2', '2023-05-15', 'alice', 'Dry Dishes on Holding Rack','need-approval','bob'),
  ('Task 3', '2023-05-01', 'bob', 'Supervise Alice','todo','bob')`);

  db.run('CREATE TABLE messages (sender TEXT, receiver TEXT,content TEXT,time DATETIME)');
  

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
    db.all(`SELECT * FROM tasks WHERE username = ? ORDER BY due_date LIMIT 10`, [username], (err, rows) => {
      if (err) {
        console.error(err.message);
        res.status(500).send('Internal Server Error');
      } else {
        const topTasks = rows.map(row => ({
          task: row.task,
          description: row.description,
          due_date: row.due_date,
          status: row.status
        }));

        db.all(`SELECT status, COUNT(*) as count FROM tasks WHERE username = ? GROUP BY status`, [username], (err, rows) => {
          if (err) {
            console.error(err.message);
            res.status(500).send('Internal Server Error');
          } else {
            const taskCounts = {};
            rows.forEach(row => {
              taskCounts[row.status] = row.count;
            });

            res.render('dashboard', { username, topTasks, taskCounts });
          }
        });
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

app.get('/directory', (req, res) => {
  const { username } = req.session;
  if (!username) {
    res.redirect('/');
  } else {
    db.all('SELECT * FROM users', (err, rows) => {
      if (err) {
        console.error(err.message);
        res.status(500).send('Internal Server Error');
      } else {
        const users = rows.map(row => ({
          name:row.username,
          department:row.department,
          team:row.team,
          email:row.email,
          Level:row.role,
          designation:row.designation 
        }));
        res.render('directory', { username, users });
      }
    });
  }
});

app.post('/changestatus',(req,res)=>{
  const { username } = req.session;
  const { taskid,status} = req.body;
 if(!status=="completed")
 { db.run(`UPDATE tasks SET status = ? WHERE task = ? AND username = ?`,
        [status, taskid, username], (err) => {
        if (err) {
          console.error(err.message);
          res.status(500).send('Internal Server Error');
        } else {
          res.redirect('/taskview');
        }
      });
 }
 else
{
  db.run(`UPDATE tasks SET status = ? WHERE task = ? AND ((status=? AND assignedby= ?) OR username=?)`,
      [status, taskid,"need-approval",username,username], (err) => {
      if (err) {
        console.error(err.message);
        res.status(500).send('Internal Server Error');
      } else {
        res.redirect('/taskview');
      }
    });
  
  
  }
});

app.post('/filter',(req,res)=>{
  const { username } = req.session;
  const { keyword} = req.body;
 
  db.all('SELECT * FROM users WHERE username LIKE ? OR team LIKE ? OR department LIKE ? OR email LIKE ? OR role LIKE ? OR designation LIKE ?', [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`],
         (err,rows) => {
        if (err) {
          console.error(err.message);
          res.status(500).send('Internal Server Error');
        } else if (rows.length) {
          console.log(rows);
          const users = rows.map(row => ({
          name:row.username,
          department:row.department,
          team:row.team,
          email:row.email,
          Level:row.role,
          designation:row.designation 
        }));
        res.render('directory', { username, users });
         
        }
        else
        {
          res.redirect('/directory');
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

app.get('/message', (req, res) => {
  const { username } = req.session;
  if (!username) {
    res.redirect('/');
  } else {
    db.all('SELECT * FROM messages WHERE sender=? OR receiver=?',[username,username], (err, rows) => {
      if (err) {
        console.error(err.message);
        res.status(500).send('Internal Server Error');
      } else {
        const messages = rows.map(row => ({
          sender:row.sender,
          receiver:row.receiver,
          content:row.content,
          time:row.time,
           
        }));
        messages.reverse()
        
        res.render('message', {username, messages});
      }
    });
  }
});

app.post('/sendmessage',(req,res)=>
{ const {receiver,message} = req.body;
  const { username } = req.session;

  db.run(`INSERT INTO messages (sender, receiver,content,time) 
                VALUES ('${username}', '${receiver}', '${message}', '${isoDateTime}')`, (err) => {
                if (err) {
                  res.redirect('/message');
                } else {
                  res.redirect('/message');
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
