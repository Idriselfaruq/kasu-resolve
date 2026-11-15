const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

// REGISTER: create a new student account
router.post('/register', async (req, res) => {
  try {
    const { full_name, matric_number, email, faculty, department, password } = req.body;

    if (!full_name || !matric_number || !email || !password) {
      return res.status(400).json({ error: 'Please fill in all required fields' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ? OR matric_number = ?',
      [email, matric_number]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email or matric number already exists' });
    }

    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (full_name, matric_number, email, faculty, department, password) VALUES (?, ?, ?, ?, ?, ?)',
      [full_name, matric_number, email, faculty, department, hash]
    );

    res.status(201).json({ message: 'Account created. You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
});

// LOGIN: check credentials and give back a token
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Enter your email and password' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      token,
      user: { id: user.id, full_name: user.full_name, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
});

module.exports = router;