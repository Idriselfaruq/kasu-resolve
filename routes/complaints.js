const express = require('express');
const pool = require('../db');
const categories = require('../categories');
const { requireLogin, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Anyone can see the list of categories (for the form dropdown)
router.get('/categories', (req, res) => res.json(categories));

// Everything below this line needs a logged-in user
router.use(requireLogin);

// STUDENT: submit a complaint
router.post('/', async (req, res) => {
  try {
    const { category, title, description } = req.body;

    if (!category || !title || !description) {
      return res.status(400).json({ error: 'Please fill in all fields' });
    }
    if (!categories.includes(category)) {
      return res.status(400).json({ error: 'Choose a valid category' });
    }

    // Save with a temporary tracking ID first
    const temp = 'T' + Date.now() + Math.floor(Math.random() * 10);
    const [result] = await pool.query(
      'INSERT INTO complaints (tracking_id, user_id, category, title, description) VALUES (?, ?, ?, ?, ?)',
      [temp, req.user.id, category, title, description]
    );

    // Now build the real tracking ID from the new row's id
    const trackingId = 'KASU-' + new Date().getFullYear() + '-' + String(result.insertId).padStart(4, '0');
    await pool.query('UPDATE complaints SET tracking_id = ? WHERE id = ?', [trackingId, result.insertId]);

    res.status(201).json({ message: 'Complaint submitted', tracking_id: trackingId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
});

// STUDENT: see my own complaints
router.get('/mine', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, tracking_id, category, title, status, created_at FROM complaints WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
});
// ADMIN: counts for the dashboard cards
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT status, COUNT(*) AS total FROM complaints GROUP BY status');
    const stats = { total: 0, 'Pending': 0, 'In Progress': 0, 'Resolved': 0 };
    rows.forEach(r => {
      stats[r.status] = r.total;
      stats.total += r.total;
    });
    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
});

// ADMIN: see all complaints, with optional filters
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status, category } = req.query;
    const conditions = [];
    const values = [];
    if (status)   { conditions.push('c.status = ?');   values.push(status); }
    if (category) { conditions.push('c.category = ?'); values.push(category); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await pool.query(
      `SELECT c.id, c.tracking_id, c.category, c.title, c.status, c.created_at,
              u.full_name, u.matric_number
       FROM complaints c
       JOIN users u ON c.user_id = u.id
       ${where}
       ORDER BY c.created_at DESC`,
      values
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
});
// ONE complaint with its replies
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, u.full_name, u.matric_number, u.department
       FROM complaints c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const complaint = rows[0];
    if (req.user.role !== 'admin' && complaint.user_id !== req.user.id) {
      return res.status(403).json({ error: 'This is not your complaint' });
    }

    const [replies] = await pool.query(
      `SELECT r.message, r.created_at, u.full_name AS admin_name
       FROM responses r
       JOIN users u ON r.admin_id = u.id
       WHERE r.complaint_id = ?
       ORDER BY r.created_at ASC`,
      [req.params.id]
    );

    res.json({ complaint, replies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
});
// ADMIN: reply to a complaint, and optionally change its status
router.post('/:id/respond', requireAdmin, async (req, res) => {
  try {
    const { message, status } = req.body;
    const allowed = ['Pending', 'In Progress', 'Resolved'];

    if (!message) {
      return res.status(400).json({ error: 'Write a reply first' });
    }
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const [found] = await pool.query('SELECT id FROM complaints WHERE id = ?', [req.params.id]);
    if (found.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    await pool.query(
      'INSERT INTO responses (complaint_id, admin_id, message) VALUES (?, ?, ?)',
      [req.params.id, req.user.id, message]
    );
    if (status) {
      await pool.query('UPDATE complaints SET status = ? WHERE id = ?', [status, req.params.id]);
    }

    res.status(201).json({ message: 'Reply sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
});
// ADMIN: change the status only
router.put('/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Pending', 'In Progress', 'Resolved'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const [result] = await pool.query('UPDATE complaints SET status = ? WHERE id = ?', [status, req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    res.json({ message: 'Status updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  }
});
module.exports = router;