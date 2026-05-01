

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));

let users = {};
let predictions = {};
let correctAnswers = { Tampa: {}, ElPaso: {}, MexicoCity: {} };
const cities = ['Tampa', 'ElPaso', 'MexicoCity'];
const songs = [
  "134340",
  "2! 3!",
  "21st Century Girl",
  "24/7 = Heaven",
  "2nd Grade",
  "A Supplementary Story: You Never Walk Alone",
  "Airplane Pt. 2",
  "Am I Wrong",
  "Anpanman",
  "Answer: Love Myself",
  "Attack On Bangtan",
  "Autumn Leaves",
  "Best Of Me",
  "Black Swan",
  "Blood, Sweat and Tears",
  "Blue & Grey",
  "Born Singer",
  "Boy in Luv",
  "Boy With Luv",
  "Boyz With Fun",
  "Butterfly",
  "Could you turn off your cellphone?",
  "Coffee",
  "Converse High",
  "Crystal Snow",
  "Cypher Pt. 1",
  "Cypher Pt. 2",
  "Cypher Pt. 3",
  "Cypher Pt. 4",
  "Danger",
  "Ddaeng",
  "Dimple",
  "Dis-ease",
  "DNA",
  "Don’t Leave Me",
  "Dope",
  "Embarassed",
  "Film Out",
  "Fly To My Room",
  "For You",
  "For Youth",
  "Go Go",
  "Heartbeat",
  "Hip Hop Phile",
  "Hold Me Tight",
  "Home",
  "House of Cards",
  "I Need U",
  "I’m Fine",
  "If I Ruled The World",
  "Jump",
  "Just One Day",
  "Let Go",
  "Let Me Know",
  "Life Goes On",
  "Lights",
  "Like",
  "Like Pt. 2",
  "Look Here",
  "Lost",
  "Love is not over",
  "Love Maze",
  "Louder Than Bombs",
  "Ma City",
  "Magic Shop",
  "Make It Right",
  "Mikrokosmos",
  "Miss Right",
  "Moving On",
  "My Universe",
  "N.O",
  "No More Dream",
  "Not Today",
  "ON",
  "One More Night",
  "Outro: Her",
  "Outro: Tear",
  "Outro: Wings",
  "Paldogangsan",
  "Paradise",
  "Path",
  "Permission To Dance",
  "Pied Piper",
  "Rain",
  "Run",
  "Save Me",
  "Sea",
  "Silver Spoon",
  "So What",
  "Spine Breaker",
  "Spring Day",
  "Stay",
  "Stay Gold",
  "Take Two",
  "Telepathy",
  "The Planet",
  "The Truth Untold",
  "The stars",
  "Tomorrow",
  "UGH!",
  "Wake Up",
  "We Are Bulletproof Pt.1",
  "War of Hormone",
  "We are Bulletproof: The Eternal",
  "We Are Bulletproof Pt.2",
  "We On",
  "Whalien 52",
  "Where You From",
  "Wishing on a star",
  "Yet To Come",
  "Young Forever",
  "Your Eyes Tell",
  "Zero O’ Clock"
];
const adminUsername = 'adminmeatman';
const blockedUsername = 'adminmeatman';

const crypto = require('crypto');
const https = require('https');

// Firebase Web API key (from firebase.js)
// Used with Firebase Identity Toolkit REST API to sign up/sign in users.
// Firebase Auth handles password hashing/encryption internally.
const FIREBASE_API_KEY = 'AIzaSyAQ6IyV5AlgEmMgGAHbyFzak3g2czYFIr0';

function isAdmin(req) {
  return req.session && req.session.isAdmin;
}

function isLoggedIn(req) {
  return req.session && req.session.user;
}

function fakeEmailForUsername(username) {
  const normalized = String(username).trim().toLowerCase();
  const hashHex = crypto.createHash('sha256').update(normalized).digest('hex');
  const prefix = hashHex.slice(0, 24);
  return `${prefix}@bts-guesser.app`;
}

function firebaseAuthRestRequest(path, email, password) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ email, password, returnSecureToken: true });
    const options = {
      method: 'POST',
      hostname: 'identitytoolkit.googleapis.com',
      path: `${path}?key=${FIREBASE_API_KEY}`,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
          return;
        }
        try {
          const parsed = JSON.parse(body);
          const msg = parsed && parsed.error && parsed.error.message ? parsed.error.message : 'Firebase Auth error';
          reject(new Error(msg));
        } catch {
          reject(new Error('Firebase Auth error'));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function firebaseSignUp(email, password) {
  return firebaseAuthRestRequest('/v1/accounts:signUp', email, password);
}

function firebaseSignIn(email, password) {
  return firebaseAuthRestRequest('/v1/accounts:signInWithPassword', email, password);
}


function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getRanking(user) {
  const sorted = Object.entries(users).sort((a,b)=>b[1].points-a[1].points);
  const index = sorted.findIndex(([u,p])=>u===user);
  if (index === -1) return 'Not ranked';
  const rank = index + 1;
  const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
  return `${rank}${suffix} place`;
}

function getPredictionMatchInfo(pred, corr) {
  const remaining = [corr.song1, corr.song2];
  const matched = [false, false];
  ['song1', 'song2'].forEach((key, index) => {
    const guess = pred[key];
    const matchIndex = remaining.indexOf(guess);
    if (matchIndex !== -1) {
      matched[index] = true;
      remaining.splice(matchIndex, 1);
    }
  });
  const matchCount = matched.filter(Boolean).length;
  const points = matchCount === 2 ? 30 : matchCount === 1 ? 15 : 5;
  return { matched, matchCount, points };
}

function getUserAnswers(user) {
  let answers = [];
  for (let city of cities) {
    const corr = correctAnswers[city] || {};
    const pred = predictions[user] && predictions[user][city];
    if (!pred) {
      if (corr.song1 && corr.song2) {
        answers.push(`<li>${city} - No prediction ❌ ❌ (0 points)</li>`);
      } else {
        answers.push(`<li>${city} - No prediction (pending)</li>`);
      }
      continue;
    }
    if (!corr.song1 || !corr.song2) {
      answers.push(`<li>${city} - ${capitalize(pred.song1)}, ${capitalize(pred.song2)} (pending)</li>`);
      continue;
    }
    const { matched, points } = getPredictionMatchInfo(pred, corr);
    const s1Emoji = matched[0] ? '✔️' : '❌';
    const s2Emoji = matched[1] ? '✔️' : '❌';
    answers.push(`<li>${city} - ${capitalize(pred.song1)} ${s1Emoji}, ${capitalize(pred.song2)} ${s2Emoji} (${points} points)</li>`);
  }
  return answers.join('');
}

try {
  users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
} catch (e) {}
try {
  predictions = JSON.parse(fs.readFileSync('predictions.json', 'utf8'));
} catch (e) {}
try {
  correctAnswers = JSON.parse(fs.readFileSync('correct.json', 'utf8'));
} catch (e) {}

function saveData() {
  fs.writeFileSync('users.json', JSON.stringify(users));
  fs.writeFileSync('predictions.json', JSON.stringify(predictions));
  fs.writeFileSync('correct.json', JSON.stringify(correctAnswers));
}

function calculatePoints() {
  for (let user in users) {
    users[user].points = 0;
  }
  for (let user in predictions) {
    for (let city of cities) {
      if (predictions[user][city]) {
        let pred = predictions[user][city];
        let corr = correctAnswers[city];
        if (corr.song1 && corr.song2) {
          const { points } = getPredictionMatchInfo(pred, corr);
          users[user].points += points;
        }
      }
    }
  }
}

app.get('/', (req, res) => {
  if (!isLoggedIn(req)) {
    res.send(`
      <h1>Login</h1>
      <form method="post" action="/login">
        Username: <input name="username"><br>
        Password: <input name="password" type="password"><br>
        <button type="submit">Login</button>
      </form>
      <h1>Register</h1>
      <form method="post" action="/register">
        Username: <input name="username"><br>
        Password: <input name="password" type="password"><br>
        <button type="submit">Register</button>
      </form>
    `);
  } else if (isAdmin(req)) {
    res.send(`
      <a href="/logout" style="position: absolute; top: 10px; right: 10px;"><button>Logout</button></a>
      <h1>Admin Panel</h1>
      <p>Logged in as admin: ${req.session.user}</p>
      <h2>Set correct answers for each city</h2>
      <a href="/admin/Tampa"><button>Set Tampa</button></a>
      <a href="/admin/ElPaso"><button>Set El Paso</button></a>
      <a href="/admin/MexicoCity"><button>Set Mexico City</button></a>
    `);
  } else {
    const normalizedBlocked = blockedUsername.toLowerCase();
    let leaderboard = Object.entries(users)
      .filter(([u]) => String(u).toLowerCase() !== normalizedBlocked)
      .sort((a,b)=> (b[1].points || 0) - (a[1].points || 0))
      .slice(0,30)
      .map(([u,p], index)=>`<tr><td>${index+1}</td><td>${u}</td><td>${p.points || 0}</td></tr>`).join('');
    res.send(`
      <a href="/logout" style="position: absolute; top: 10px; right: 10px;"><button>Logout</button></a>
      <h1>Leaderboard</h1>
      <table border="1" cellpadding="5" cellspacing="0">
        <tr><th>Rank</th><th>Username</th><th>Points</th></tr>
        ${leaderboard}
      </table>
      <h2>Cities</h2>
      <a href="/predict/Tampa"><button>Tampa</button></a>
      <a href="/predict/ElPaso"><button>El Paso</button></a>
      <a href="/predict/MexicoCity"><button>Mexico City</button></a>
      <h2>My Statistics</h2>
      <p>Username: ${req.session.user}</p>
      <p>Total Points: ${users[req.session.user].points || 0}</p>
      <p>Ranking: ${getRanking(req.session.user)}</p>
      <p><a href="/answers">Click here to see your full answers.</a></p>
    `);
  }
});

app.post('/login', async (req, res) => {
  let { username, password } = req.body;

  if (String(username).toLowerCase() === blockedUsername.toLowerCase() && String(username).toLowerCase() !== adminUsername.toLowerCase()) {
    return res.send('Invalid');
  }

  const email = fakeEmailForUsername(username);

  try {
    await firebaseSignIn(email, password);

    // Ensure local user exists for leaderboard/points
    if (!users[username]) users[username] = { points: 0 };
    if (typeof users[username].points !== 'number') users[username].points = 0;
    saveData();

    req.session.user = username;
    req.session.isAdmin = String(username).toLowerCase() === adminUsername.toLowerCase();
    return res.redirect('/');
  } catch (e) {
    return res.send('Invalid');
  }
});

app.post('/register', async (req, res) => {
  let { username, password } = req.body;

  if (String(username).toLowerCase() === blockedUsername.toLowerCase() && String(username).toLowerCase() !== adminUsername.toLowerCase()) {
    return res.send('Invalid');
  }

  const email = fakeEmailForUsername(username);

  try {
    await firebaseSignUp(email, password);

    // Create local profile for leaderboard/points (NO password stored)
    if (!users[username]) {
      users[username] = { points: 0 };
    } else if (typeof users[username].points !== 'number') {
      users[username].points = 0;
    }

    saveData();
    return res.redirect('/');
  } catch (e) {
    return res.send('Exists');
  }
});



app.get('/predict/:city', (req, res) => {
  if (!isLoggedIn(req) || isAdmin(req)) return res.redirect('/');
  if (String(req.session.user).toLowerCase() === blockedUsername.toLowerCase()) return res.redirect('/');
  let city = req.params.city;
  if (!cities.includes(city)) return res.send('Invalid');
  const current = correctAnswers[city] || {};
  const locked = current.song1 && current.song2;
  if (locked) {
    const pred = predictions[req.session.user] && predictions[req.session.user][city];
    if (pred) {
      const { matched, points } = getPredictionMatchInfo(pred, current);
      const s1Emoji = matched[0] ? '✔️' : '❌';
      const s2Emoji = matched[1] ? '✔️' : '❌';
      res.send(`
        <h1>Your Prediction for ${city}</h1>
        <p>${capitalize(pred.song1)} ${s1Emoji}, ${capitalize(pred.song2)} ${s2Emoji}</p>
        <p>${points} points</p>
        <h3>Correct Answers:</h3>
        <p>${capitalize(current.song1)}, ${capitalize(current.song2)}</p>
        <a href="/">Back</a>
      `);
    } else {
      res.send(`
        <h1>${city}</h1>
        <p>You did not make a prediction for this city.</p>
        <h3>Correct Answers:</h3>
        <p>${capitalize(current.song1)}, ${capitalize(current.song2)}</p>
        <a href="/">Back</a>
      `);
    }
  } else {
    res.send(`
      <h1>Put your surprise songs prediction for ${city}</h1>
      <form method="post" action="/predict/${city}">
        Surprise Song 1: <select name="song1">
          ${songs.map(s => `<option>${s}</option>`).join('')}
        </select><br>
        Surprise Song 2: <select name="song2">
          ${songs.map(s => `<option>${s}</option>`).join('')}
        </select><br>
        <button type="submit">Submit</button>
      </form>
      <a href="/">Back</a>
    `);
  }
});

app.post('/predict/:city', (req, res) => {
  if (!isLoggedIn(req) || isAdmin(req)) return res.redirect('/');
  if (String(req.session.user).toLowerCase() === blockedUsername.toLowerCase()) return res.redirect('/');
  let city = req.params.city;
  if (!cities.includes(city)) return res.send('Invalid');
  const current = correctAnswers[city] || {};
  if (current.song1 && current.song2) {
    return res.send('Predictions are locked for this city.');
  }
  let user = req.session.user;
  if (!predictions[user]) predictions[user] = {};
  predictions[user][city] = req.body;
  saveData();
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

function requireAdmin(req, res, next) {
  if (!isAdmin(req)) {
    return res.redirect('/');
  }
  next();
}

app.get('/admin/:city', requireAdmin, (req, res) => {
  let city = req.params.city;
  if (!cities.includes(city)) return res.send('Invalid');
  const current = correctAnswers[city] || {};
  const firstTime = !(current.song1 && current.song2);
  const confirmMessage = firstTime
    ? 'Are you sure? You can only do this once. Click OK to lock in this answer, or Cancel to stay on this page.'
    : 'Are you sure you want to change? Click OK to apply the new answer, or Cancel to stay on this page.';
  res.send(`
    <h1>Set Correct for ${city}</h1>
    ${!firstTime ? `<p>Current locked answer: ${current.song1}, ${current.song2}</p>` : ''}
    <form method="post" action="/admin/${city}" onsubmit="return confirm('${confirmMessage}')">
      Song1: <select name="song1">
        ${songs.map(s => `<option ${current.song1 === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select><br>
      Song2: <select name="song2">
        ${songs.map(s => `<option ${current.song2 === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select><br>
      <button type="submit">Set</button>
    </form>
    <a href="/">Back</a>
  `);
});

app.post('/admin/:city', requireAdmin, (req, res) => {
  let city = req.params.city;
  if (!cities.includes(city)) return res.send('Invalid');
  correctAnswers[city] = req.body;
  calculatePoints();
  saveData();
  res.redirect('/');
});

app.get('/answers', (req, res) => {
  if (!isLoggedIn(req) || isAdmin(req)) return res.redirect('/');
  let answers = [];
  for (let city of cities) {
    const corr = correctAnswers[city] || {};
    const pred = predictions[req.session.user] && predictions[req.session.user][city];
    if (!pred) {
      if (corr.song1 && corr.song2) {
        answers.push(`${city} - No predictions (0 points)`);
      } else {
        answers.push(`${city} - No prediction (pending)`);
      }
      continue;
    }
    if (!corr.song1 || !corr.song2) {
      answers.push(`${city} - ${capitalize(pred.song1)}, ${capitalize(pred.song2)} (pending)`);
      continue;
    }
    const { matched, points } = getPredictionMatchInfo(pred, corr);
    const s1Emoji = matched[0] ? '✔️' : '❌';
    const s2Emoji = matched[1] ? '✔️' : '❌';
    answers.push(`${city} - ${capitalize(pred.song1)} ${s1Emoji}, ${capitalize(pred.song2)} ${s2Emoji} (${points} points)`);
  }
  res.send(`
    <a href="/" style="position: absolute; top: 10px; right: 10px;"><button>Back</button></a>
    <h1>Your Full Answers</h1>
    <pre>${answers.join('\n')}</pre>
  `);
});

app.listen(3000, () => console.log('Running on 3000'));
