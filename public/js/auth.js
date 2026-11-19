const msg = document.getElementById('msg');

function showMessage(text, type) {
  msg.className = 'alert alert-' + type;
  msg.textContent = text;
}

async function sendToServer(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const result = await response.json();
  return { ok: response.ok, result };
}

const registerForm = document.getElementById('registerForm');
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(registerForm));
    try {
      const { ok, result } = await sendToServer('/api/auth/register', data);
      if (ok) {
        showMessage(result.message, 'success');
        registerForm.reset();
      } else {
        showMessage(result.error, 'danger');
      }
    } catch (err) {
      showMessage('Could not reach the server. Is it running?', 'danger');
    }
  });
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(loginForm));
    try {
      const { ok, result } = await sendToServer('/api/auth/login', data);
      if (ok) {
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        if (result.user.role === 'admin') {
          window.location.href = '/admin.html';
        } else {
          window.location.href = '/dashboard.html';
        }
      } else {
        showMessage(result.error, 'danger');
      }
    } catch (err) {
      showMessage('Could not reach the server. Is it running?', 'danger');
    }
  });
}

const showBox = document.getElementById('showPassword');
if (showBox) {
  showBox.addEventListener('change', () => {
    const field = document.querySelector('input[name="password"]');
    field.type = showBox.checked ? 'text' : 'password';
  });
}