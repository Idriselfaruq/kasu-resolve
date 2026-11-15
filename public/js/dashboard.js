const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

// 1. If nobody is logged in, send them to the login page
if (!token || !user) {
  window.location.href = '/index.html';
}

const msg = document.getElementById('msg');
const rows = document.getElementById('complaintRows');
const categorySelect = document.getElementById('categorySelect');

document.getElementById('studentName').textContent = user ? user.full_name : '';

// 2. Log out: throw away the token and go back to login
document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/index.html';
});

// Helper: talk to the server with our token attached
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    }
  });
  if (response.status === 401) {
    localStorage.clear();
    window.location.href = '/index.html';
  }
  return response.json();
}

// 3. Fill the category dropdown
async function loadCategories() {
  const categories = await api('/api/complaints/categories');
  categories.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    categorySelect.appendChild(option);
  });
}

// Status colours match the KASU palette
const statusColours = {
  'Pending':     { bg: '#D02010', text: '#fff' },
  'In Progress': { bg: '#F0C800', text: '#202020' },
  'Resolved':    { bg: '#009030', text: '#fff' }
};

// 4. Fill the "My complaints" table
async function loadComplaints() {
  const list = await api('/api/complaints/mine');
  rows.innerHTML = '';

  if (list.length === 0) {
    rows.innerHTML = '<tr><td colspan="4" class="text-muted">You have not submitted any complaints yet.</td></tr>';
    return;
  }

  list.forEach(c => {
    const tr = document.createElement('tr');
    const colour = statusColours[c.status];

    [c.tracking_id, c.title, c.category].forEach(text => {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    });

    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.style.background = colour.bg;
    badge.style.color = colour.text;
    badge.textContent = c.status;
    statusCell.appendChild(badge);
    tr.appendChild(statusCell);
    const actionCell = document.createElement('td');
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn btn-sm btn-kasu';
    viewBtn.textContent = 'View';
    viewBtn.addEventListener('click', () => openComplaint(c.id));
    actionCell.appendChild(viewBtn);
    tr.appendChild(actionCell);
    rows.appendChild(tr);
  });
}

// 5. Submit a new complaint
document.getElementById('complaintForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));

  const result = await api('/api/complaints', {
    method: 'POST',
    body: JSON.stringify(data)
  });

  if (result.tracking_id) {
    msg.className = 'alert alert-success';
    msg.textContent = 'Complaint submitted. Your tracking ID is ' + result.tracking_id;
    form.reset();
    loadComplaints();
  } else {
    msg.className = 'alert alert-danger';
    msg.textContent = result.error;
  }
});
const modal = new bootstrap.Modal(document.getElementById('complaintModal'));

async function openComplaint(id) {
  const data = await api('/api/complaints/' + id);
  if (data.error) {
    alert(data.error);
    return;
  }
  const c = data.complaint;

  document.getElementById('modalTitle').textContent = c.tracking_id + ': ' + c.title;
  document.getElementById('modalCategory').textContent = c.category;
  document.getElementById('modalStatus').textContent = c.status;
  document.getElementById('modalDescription').textContent = c.description;

  const box = document.getElementById('modalReplies');
  box.innerHTML = '';
  if (data.replies.length === 0) {
    box.textContent = 'No replies yet. We will respond as soon as possible.';
  } else {
    data.replies.forEach(r => {
      const p = document.createElement('p');
      p.className = 'border-start border-3 ps-2';
      p.textContent = r.admin_name + ': ' + r.message;
      box.appendChild(p);
    });
  }

  modal.show();
}
// Run when the page opens
if (token) {
  loadCategories();
  loadComplaints();
}