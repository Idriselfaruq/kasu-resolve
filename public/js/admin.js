const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

// Only logged-in admins may be here
if (!token || !user) {
  window.location.href = '/index.html';
} else if (user.role !== 'admin') {
  window.location.href = '/dashboard.html';
}

const rows = document.getElementById('complaintRows');
const filterStatus = document.getElementById('filterStatus');
const filterCategory = document.getElementById('filterCategory');

document.getElementById('adminName').textContent = user ? user.full_name : '';

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/index.html';
});

// Same helper as the student page: talk to the server with our token
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

const statusColours = {
  'Pending':     { bg: '#D02010', text: '#fff' },
  'In Progress': { bg: '#F0C800', text: '#202020' },
  'Resolved':    { bg: '#009030', text: '#fff' }
};

// Fill the four boxes at the top
async function loadStats() {
  const stats = await api('/api/complaints/stats');
  document.getElementById('statTotal').textContent = stats.total;
  document.getElementById('statPending').textContent = stats['Pending'];
  document.getElementById('statProgress').textContent = stats['In Progress'];
  document.getElementById('statResolved').textContent = stats['Resolved'];
}

// Fill the category filter dropdown
async function loadCategories() {
  const categories = await api('/api/complaints/categories');
  categories.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    filterCategory.appendChild(option);
  });
}

// Fill the table, using whatever filters are selected
async function loadComplaints() {
  const params = new URLSearchParams();
  if (filterStatus.value) params.append('status', filterStatus.value);
  if (filterCategory.value) params.append('category', filterCategory.value);

  const list = await api('/api/complaints?' + params.toString());
  rows.innerHTML = '';

  if (list.length === 0) {
    rows.innerHTML = '<tr><td colspan="7" class="text-muted">No complaints match.</td></tr>';
    return;
  }

  list.forEach(c => {
    const tr = document.createElement('tr');

    [c.tracking_id, c.full_name, c.matric_number, c.title, c.category].forEach(text => {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    });

    const colour = statusColours[c.status];
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
let currentId = null;
const modal = new bootstrap.Modal(document.getElementById('complaintModal'));

async function openComplaint(id) {
  currentId = id;
  const data = await api('/api/complaints/' + id);
  if (data.error) {
    alert(data.error);
    return;
  }
  const c = data.complaint;

  document.getElementById('modalTitle').textContent = c.tracking_id + ': ' + c.title;
  document.getElementById('modalStudent').textContent = c.full_name + ' (' + c.matric_number + ')';
  document.getElementById('modalCategory').textContent = c.category;
  document.getElementById('modalStatus').textContent = c.status;
  document.getElementById('modalDescription').textContent = c.description;

  const box = document.getElementById('modalReplies');
  box.innerHTML = '';
  if (data.replies.length === 0) {
    box.textContent = 'No replies yet.';
  } else {
    data.replies.forEach(r => {
      const p = document.createElement('p');
      p.className = 'border-start border-3 ps-2';
      p.textContent = r.admin_name + ': ' + r.message;
      box.appendChild(p);
    });
  }

  document.getElementById('replyText').value = '';
  document.getElementById('replyStatus').value = '';
  modal.show();
}
document.getElementById('sendReplyBtn').addEventListener('click', async () => {
  const message = document.getElementById('replyText').value.trim();
  const status = document.getElementById('replyStatus').value;
  const modalMsg = document.getElementById('modalMsg');

  const result = await api('/api/complaints/' + currentId + '/respond', {
    method: 'POST',
    body: JSON.stringify({ message, status })
  });

  if (result.error) {
    modalMsg.className = 'alert alert-danger';
    modalMsg.textContent = result.error;
    return;
  }

  modalMsg.className = 'd-none';
  await openComplaint(currentId);
  loadStats();
  loadComplaints();
});
// Reload the table whenever a filter changes
filterStatus.addEventListener('change', loadComplaints);
filterCategory.addEventListener('change', loadComplaints);

// Run when the page opens (only for admins)
if (token && user && user.role === 'admin') {
  loadStats();
  loadCategories();
  loadComplaints();
}