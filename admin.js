// ===== WebSocket для реал-тайма =====
let ws = null;

function connectAdminWebSocket(userId) {
	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const wsUrl = `${protocol}//${window.location.host}`;
	
	console.log('Admin WebSocket: подключаемся к', wsUrl);
	ws = new WebSocket(wsUrl);
	
	ws.onopen = () => {
		console.log('Admin WebSocket: подключены');
		ws.send(JSON.stringify({ type: 'auth', userId, isAdmin: true }));
	};
	
	ws.onmessage = async (event) => {
		try {
			const msg = JSON.parse(event.data);
			console.log('Admin WebSocket сообщение:', msg);
			
			if (msg.type === 'adminUpdate') {
				// Обновления для админов
				switch (msg.updateType) {
					case 'userRegistered':
						console.log('📢 Новый пользователь зарегистрирован:', msg.data);
						await loadStats();
						await loadUsers();
						break;
						
					case 'userDeleted':
						console.log('📢 Пользователь удален:', msg.data);
						await loadStats();
						await loadUsers();
						break;
						
					case 'adminToggled':
						console.log('📢 Права администратора изменены:', msg.data);
						await loadStats();
						await loadUsers();
						break;
						
					case 'entryAdded':
					case 'waterAdded':
						console.log('📢 Данные обновлены у пользователя:', msg.userId);
						await loadStats();
						// Обновляем только статистику, не всех пользователей
						break;

					case 'ticketUpdate':
						console.log('🎫 Обновление тикетов');
						await loadTickets();
						if (currentTicketId) await loadTicketMessages(currentTicketId);
						break;
				}
			}
		} catch (e) {
			console.error('Admin WebSocket ошибка обработки сообщения:', e);
		}
	};
	
	ws.onerror = (err) => {
		console.error('Admin WebSocket ошибка:', err);
	};
	
	ws.onclose = () => {
		console.log('Admin WebSocket: отключены. Переподключение через 3 сек...');
		setTimeout(() => connectAdminWebSocket(userId), 3000);
	};
}

// ===== API ФУНКЦИИ =====
async function apiCall(endpoint, options = {}) {
	try {
		const response = await fetch(endpoint, {
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			},
			...options
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || 'Ошибка запроса');
		}

		return await response.json();
	} catch (err) {
		console.error('API Error:', err);
		throw err;
	}
}

// ===== ПРОВЕРКА ПРАВ =====
async function checkAdminAccess() {
	try {
		const data = await apiCall('/api/admin/check');
		if (!data.isAdmin) {
			alert('У вас нет прав администратора!');
			window.location.href = '/';
			return false;
		}
		return true;
	} catch (err) {
		alert('Ошибка проверки прав доступа');
		window.location.href = '/';
		return false;
	}
}

// ===== ЗАГРУЗКА ДАННЫХ =====
let allUsers = [];
let currentResetUserId = null;
let currentSort = { field: null, direction: 'asc' };
let tickets = [];
let currentTicketId = null;

async function loadStats() {
	try {
		const stats = await apiCall('/api/admin/stats');
		console.log('📊 Получена статистика:', stats);
		
		document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
		document.getElementById('adminCount').textContent = stats.adminCount || 0;
		document.getElementById('totalEntries').textContent = stats.totalEntries || 0;
		document.getElementById('totalWaterLogs').textContent = stats.totalWaterLogs || 0;
		document.getElementById('totalWeightLogs').textContent = stats.totalWeightLogs || 0;
		
		// Новое добавление
		const totalVisitsEl = document.getElementById('totalVisits');
		const registeredVisitsEl = document.getElementById('registeredVisits');
		const anonymousVisitsEl = document.getElementById('anonymousVisits');
		
		if (totalVisitsEl) {
			totalVisitsEl.textContent = stats.totalVisits || 0;
			console.log('✓ totalVisits установлен на:', stats.totalVisits || 0);
		} else {
			console.warn('⚠️ Элемент totalVisits не найден в DOM');
		}
		
		if (registeredVisitsEl) {
			registeredVisitsEl.textContent = stats.registeredVisits || 0;
			console.log('✓ registeredVisits установлен на:', stats.registeredVisits || 0);
		} else {
			console.warn('⚠️ Элемент registeredVisits не найден в DOM');
		}
		
		if (anonymousVisitsEl) {
			anonymousVisitsEl.textContent = stats.anonymousVisits || 0;
			console.log('✓ anonymousVisits установлен на:', stats.anonymousVisits || 0);
		} else {
			console.warn('⚠️ Элемент anonymousVisits не найден в DOM');
		}

		// Отображаем недавних пользователей
		const recentList = document.getElementById('recentUsersList');
		recentList.innerHTML = stats.recentUsers.map(user => `
			<div class="recent-user-item">
				<span class="recent-user-name">${escapeHtml(user.username)}</span>
				<span class="recent-user-date">${formatDate(user.created_at)}</span>
			</div>
		`).join('');
	} catch (err) {
		console.error('Ошибка загрузки статистики:', err);
	}
}

async function loadUsers() {
	try {
		const users = await apiCall('/api/admin/users');
		allUsers = users;
		renderUsersTable(users);
	} catch (err) {
		console.error('Ошибка загрузки пользователей:', err);
		document.getElementById('usersTableBody').innerHTML = `
			<tr><td colspan="8" style="text-align: center; color: var(--danger);">
				Ошибка загрузки: ${escapeHtml(err.message)}
			</td></tr>
		`;
	}
}

// ===== ТИКЕТЫ ПОДДЕРЖКИ =====
async function loadTickets() {
	try {
		console.log('📥 Загружаю тикеты...');
		const archiveBtn = document.querySelector('.toggle-btn.active[data-filter="archive"]');
		const showArchived = archiveBtn?.dataset.value === 'archived';
		const response = await apiCall(`/api/admin/support/tickets?archived=${showArchived}`);
		console.log('📦 Ответ сервера:', response);
		tickets = response;
		console.log('✓ Тикеты установлены в переменную:', tickets.length, 'штук');
		console.log('Содержимое tickets:', JSON.stringify(tickets, null, 2));
		renderTickets();
	} catch (err) {
		console.error('❌ Ошибка загрузки тикетов:', err);
		document.getElementById('ticketsList').innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
	}
}

async function loadTicketMessages(ticketId) {
	if (!ticketId) return;
	try {
		const messages = await apiCall(`/api/admin/support/tickets/${ticketId}/messages`);
		renderTicketMessages(messages);
	} catch (err) {
		console.error('Ошибка загрузки сообщений тикета:', err);
		document.getElementById('ticketMessages').innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
	}
}

function renderTickets() {
	const listEl = document.getElementById('ticketsList');
	const statusBtn = document.querySelector('.toggle-btn.active[data-filter="status"]');
	const filter = statusBtn?.dataset.value || 'all';
	const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);
	
	console.log('🎨 Рендеринг тикетов. Фильтр:', filter, 'Всего:', tickets.length, 'Отфильтрировано:', filtered.length);

	if (!filtered.length) {
		listEl.innerHTML = '<div class="empty-state">Тикетов пока нет</div>';
		console.warn('⚠️ Нет тикетов для отображения');
		return;
	}

	listEl.innerHTML = filtered.map(t => `
		<div class="ticket-card ${t.id === currentTicketId ? 'active' : ''}" onclick="selectTicket(${t.id})">
			<div class="subject">${escapeHtml(t.subject)}</div>
			<div class="meta">${escapeHtml(t.username || '')} • ${formatDate(t.updated_at)} • <span class="ticket-status-badge status-${t.status}">${statusLabel(t.status)}</span></div>
			${t.status === 'closed' && t.closed_by_admin_name ? `<div class="meta">Закрыл: ${escapeHtml(t.closed_by_admin_name)}</div>` : ''}
			${t.last_message ? `<div class="meta">${escapeHtml(t.last_sender_role === 'admin' ? 'Админ: ' : 'Юзер: ')}${escapeHtml(t.last_message.slice(0, 80))}</div>` : ''}
		</div>
	`).join('');
	console.log('✓ Отрендерено', filtered.length, 'тикетов');
}

function renderTicketMessages(messages = []) {
	const box = document.getElementById('ticketMessages');
	if (!messages.length) {
		box.innerHTML = '<div class="empty-state">Нет сообщений</div>';
		return;
	}
	box.innerHTML = messages.map(m => `
		<div class="ticket-message">
			<div class="${m.sender_role === 'admin' ? 'by-admin' : 'by-user'}">${m.sender_role === 'admin' ? 'Админ' : 'Пользователь'}${m.sender_name ? ': ' + escapeHtml(m.sender_name) : ''}</div>
			<div>${escapeHtml(m.message)}</div>
			<time>${formatDate(m.created_at)}</time>
		</div>
	`).join('');
	box.scrollTop = box.scrollHeight;
}

function statusLabel(status) {
	switch (status) {
		case 'open': return 'Открыт';
		case 'in_progress': return 'В работе';
		case 'resolved': return 'Исправлен';
		case 'closed': return 'Закрыт';
		default: return status;
	}
}

async function selectTicket(id) {
	currentTicketId = id;
	const ticket = tickets.find(t => t.id === id);
	if (ticket) {
		document.getElementById('ticketSubject').textContent = ticket.subject;
		document.getElementById('ticketMeta').textContent = `${ticket.username || 'Пользователь'} • ${statusLabel(ticket.status)}`;
		document.getElementById('ticketStatusSelect').value = ticket.status;
	}
	renderTickets();
	await loadTicketMessages(id);
}

async function saveTicketStatus() {
	if (!currentTicketId) return;
	const status = document.getElementById('ticketStatusSelect').value;
	await apiCall(`/api/admin/support/tickets/${currentTicketId}/status`, {
		method: 'POST',
		body: JSON.stringify({ status })
	});
	tickets = tickets.map(t => t.id === currentTicketId ? { ...t, status } : t);
	renderTickets();
}

async function archiveCurrentTicket() {
	if (!currentTicketId) return;
	const currentTicket = tickets.find(t => t.id === currentTicketId);
	if (!currentTicket) return;

	const isArchived = currentTicket.archived;
	const newStatus = !isArchived;
	const confirmMsg = newStatus ? 'Архивировать этот тикет?' : 'Разархивировать этот тикет?';
	
	if (!confirm(confirmMsg)) return;

	try {
		await apiCall(`/api/admin/support/tickets/${currentTicketId}/archive`, {
			method: 'POST',
			body: JSON.stringify({ archived: newStatus })
		});
		
		// Обновляем локально
		tickets = tickets.map(t => t.id === currentTicketId ? { ...t, archived: newStatus ? 1 : 0 } : t);
		
		// Перезагружаем список
		await loadTickets();
		console.log('✓ Тикет ' + (newStatus ? 'архивирован' : 'разархивирован'));
	} catch (err) {
		alert('Ошибка: ' + err.message);
	}
}

async function sendTicketReply() {
	if (!currentTicketId) return;
	const text = document.getElementById('ticketReplyInput').value.trim();
	if (!text) return;
	await apiCall(`/api/admin/support/tickets/${currentTicketId}/messages`, {
		method: 'POST',
		body: JSON.stringify({ message: text })
	});
	document.getElementById('ticketReplyInput').value = '';
	await loadTicketMessages(currentTicketId);
}

async function loadUserDetails(userId) {
	try {
		const user = await apiCall(`/api/admin/users/${userId}`);
		showUserDetailsModal(user);
	} catch (err) {
		alert('Ошибка загрузки деталей пользователя: ' + err.message);
	}
}

// ===== ОТОБРАЖЕНИЕ ТАБЛИЦЫ =====
function renderUsersTable(users) {
	const tbody = document.getElementById('usersTableBody');
	const grid = document.getElementById('usersGridMobile');
	
	if (!users || users.length === 0) {
		const emptyMsg = `
			<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">
				Пользователи не найдены
			</td></tr>
		`;
		tbody.innerHTML = emptyMsg;
		grid.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px;">Пользователи не найдены</div>`;
		return;
	}

	// Десктопная версия - таблица
	tbody.innerHTML = users.map(user => `
		<tr>
			<td>${user.id}</td>
			<td><strong>${escapeHtml(user.username)}</strong></td>
			<td>${user.gender === 'female' ? '♀️ Девушка' : '♂️ Парень'}</td>
			<td>${user.email || '<span style="color: var(--text-muted);">нет</span>'}</td>
			<td>${formatDate(user.created_at)}</td>
			<td>${(user.entries_count || 0) + (user.water_logs_count || 0) + (user.weight_logs_count || 0)}</td>
			<td>
				<span class="user-role ${user.is_admin ? 'admin' : 'user'}">
					${user.is_admin ? 'Админ' : 'Пользователь'}
				</span>
			</td>
			<td>
				<div class="action-buttons">
					<button class="btn-action view" onclick="loadUserDetails(${user.id})">
						👁️ Детали
					</button>
					<button class="btn-action toggle" onclick="toggleAdmin(${user.id})">
						🔐 ${user.is_admin ? 'Снять админа' : 'Сделать админом'}
					</button>
					<button class="btn-action reset" onclick="showResetPasswordModal(${user.id}, '${escapeHtml(user.username)}')">
						🔑 Сбросить пароль
					</button>
					<button class="btn-action delete" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')">
						🗑️ Удалить
					</button>
				</div>
			</td>
		</tr>
	`).join('');
	
	// Мобильная версия - карточки
	grid.innerHTML = users.map(user => `
		<div class="user-card">
			<div class="user-card-header">
				<div class="user-card-title">
					<div class="user-card-username">${escapeHtml(user.username)}</div>
					<div class="user-card-id">ID: ${user.id}</div>
				</div>
				<span class="user-card-role ${user.is_admin ? 'admin' : 'user'}">
					${user.is_admin ? 'Админ' : 'Пользователь'}
				</span>
			</div>
			
			<div class="user-card-info">
				<div class="user-card-info-row">
					<span class="user-card-info-label">Пол:</span>
					<span class="user-card-info-value">${user.gender === 'female' ? '♀️ Девушка' : '♂️ Парень'}</span>
				</div>
				${user.email ? `<div class="user-card-info-row"><span class="user-card-info-label">Email:</span><span class="user-card-info-value">${escapeHtml(user.email)}</span></div>` : ''}
				<div class="user-card-info-row">
					<span class="user-card-info-label">Регистрация:</span>
					<span class="user-card-info-value">${formatDate(user.created_at)}</span>
				</div>
				<div class="user-card-info-row">
					<span class="user-card-info-label">Всего логов:</span>
					<span class="user-card-info-value">${(user.entries_count || 0) + (user.water_logs_count || 0) + (user.weight_logs_count || 0)}</span>
				</div>
			</div>
			
			<div class="user-card-actions">
				<button class="user-card-action-btn secondary" onclick="loadUserDetails(${user.id})">
					👁️ Детали
				</button>
				<button class="user-card-action-btn warning" onclick="toggleAdmin(${user.id})">
					🔐 ${user.is_admin ? 'Снять' : 'Админ'}
				</button>
				<button class="user-card-action-btn secondary" onclick="showResetPasswordModal(${user.id}, '${escapeHtml(user.username)}')">
					🔑 Пароль
				</button>
				<button class="user-card-action-btn danger" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')">
					🗑️ Удалить
				</button>
			</div>
		</div>
	`).join('');
}

// ===== СОРТИРОВКА =====
function sortUsers(field) {
	// Определяем направление сортировки
	if (currentSort.field === field) {
		currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
	} else {
		currentSort.field = field;
		currentSort.direction = 'asc';
	}
	
	// Сортируем массив пользователей
	const sorted = [...allUsers].sort((a, b) => {
		let aVal = a[field];
		let bVal = b[field];
		
		// Специальная обработка для разных типов данных
		if (field === 'created_at') {
			aVal = new Date(aVal).getTime();
			bVal = new Date(bVal).getTime();
		} else if (field === 'username') {
			aVal = (aVal || '').toLowerCase();
			bVal = (bVal || '').toLowerCase();
		} else if (field === 'gender') {
			aVal = aVal === 'female' ? 0 : 1;
			bVal = bVal === 'female' ? 0 : 1;
		} else if (field === 'is_admin') {
			aVal = aVal ? 1 : 0;
			bVal = bVal ? 1 : 0;
		} else if (field === 'total_logs') {
			// Вычисляем общее количество логов
			aVal = (a.entries_count || 0) + (a.water_logs_count || 0) + (a.weight_logs_count || 0);
			bVal = (b.entries_count || 0) + (b.water_logs_count || 0) + (b.weight_logs_count || 0);
		} else if (field === 'entries_count' || field === 'water_logs_count') {
			aVal = aVal || 0;
			bVal = bVal || 0;
		}
		
		if (currentSort.direction === 'asc') {
			return aVal > bVal ? 1 : -1;
		} else {
			return aVal < bVal ? 1 : -1;
		}
	});
	
	// Обновляем визуальные индикаторы
	document.querySelectorAll('.users-table th.sortable').forEach(th => {
		th.classList.remove('sort-asc', 'sort-desc');
		if (th.dataset.sort === field) {
			th.classList.add(`sort-${currentSort.direction}`);
		}
	});
	
	// Перерисовываем таблицу
	renderUsersTable(sorted);
}

// ===== ДЕЙСТВИЯ С ПОЛЬЗОВАТЕЛЯМИ =====
async function toggleAdmin(userId) {
	if (!confirm('Вы уверены, что хотите изменить права администратора?')) return;

	try {
		const result = await apiCall(`/api/admin/users/${userId}/toggle-admin`, {
			method: 'POST'
		});
		alert(result.message);
		await loadUsers();
		await loadStats();
	} catch (err) {
		alert('Ошибка: ' + err.message);
	}
}

async function deleteUser(userId, username) {
	if (!confirm(`Вы уверены, что хотите удалить пользователя "${username}"?\n\nВСЕ его данные будут удалены БЕЗВОЗВРАТНО!`)) return;

	try {
		const result = await apiCall(`/api/admin/users/${userId}`, {
			method: 'DELETE'
		});
		alert(result.message);
		await loadUsers();
		await loadStats();
	} catch (err) {
		alert('Ошибка: ' + err.message);
	}
}

function showResetPasswordModal(userId, username) {
	currentResetUserId = userId;
	document.getElementById('resetPasswordUsername').textContent = username;
	document.getElementById('newPasswordInput').value = '';
	document.getElementById('resetPasswordModal').style.display = 'flex';
}

async function resetPassword() {
	const newPassword = document.getElementById('newPasswordInput').value;
	
	if (!newPassword || newPassword.length < 4) {
		alert('Пароль должен быть не менее 4 символов');
		return;
	}

	try {
		const result = await apiCall(`/api/admin/users/${currentResetUserId}/reset-password`, {
			method: 'POST',
			body: JSON.stringify({ newPassword })
		});
		alert(result.message);
		document.getElementById('resetPasswordModal').style.display = 'none';
	} catch (err) {
		alert('Ошибка: ' + err.message);
	}
}

// ===== МОДАЛЬНЫЕ ОКНА =====
function showUserDetailsModal(user) {
	const content = document.getElementById('userDetailsContent');
	const avatarHtml = user.avatar 
		? `<img src="${escapeHtml(user.avatar)}" alt="Avatar" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 16px; border: 2px solid var(--accent);">` 
		: `<div style="width: 80px; height: 80px; border-radius: 50%; background: var(--bg-tertiary); display: flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px; border: 2px solid var(--border);">${user.username.charAt(0).toUpperCase()}</div>`;
	content.innerHTML = `
		<div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 20px;">
			${avatarHtml}
		</div>
		<div class="detail-row">
			<span class="detail-label">ID:</span>
			<span class="detail-value">${user.id}</span>
		</div>
		<div class="detail-row">
			<span class="detail-label">Логин:</span>
			<span class="detail-value">${escapeHtml(user.username)}</span>
		</div>
		<div class="detail-row">
			<span class="detail-label">Пол:</span>
			<span class="detail-value">${user.gender === 'female' ? '♀️ Девушка' : '♂️ Парень'}</span>
		</div>
		<div class="detail-row">
			<span class="detail-label">Email:</span>
			<span class="detail-value">${user.email || 'не указан'}</span>
		</div>
		<div class="detail-row">
			<span class="detail-label">Роль:</span>
			<span class="detail-value">
				<span class="user-role ${user.is_admin ? 'admin' : 'user'}">
					${user.is_admin ? 'Администратор' : 'Пользователь'}
				</span>
			</span>
		</div>
		<div class="detail-row">
			<span class="detail-label">Дата регистрации:</span>
			<span class="detail-value">${formatDate(user.created_at)}</span>
		</div>
		<div class="detail-row">
			<span class="detail-label">Всего записей:</span>
			<span class="detail-value">${user.entries_count || 0}</span>
		</div>
		<div class="detail-row">
			<span class="detail-label">Логов воды:</span>
			<span class="detail-value">${user.water_logs_count || 0}</span>
		</div>
		<div class="detail-row">
			<span class="detail-label">Последняя запись:</span>
			<span class="detail-value">${user.last_entry ? formatDate(user.last_entry) : 'нет записей'}</span>
		</div>
		<div class="detail-row">
			<span class="detail-label">Последний лог воды:</span>
			<span class="detail-value">${user.last_water_log ? formatDate(user.last_water_log) : 'нет логов'}</span>
		</div>
	`;
	document.getElementById('userDetailsModal').style.display = 'flex';
}

// ===== ПОИСК =====
function setupSearch() {
	const searchInput = document.getElementById('searchUsers');
	searchInput.addEventListener('input', (e) => {
		const query = e.target.value.toLowerCase().trim();
		
		if (!query) {
			renderUsersTable(allUsers);
			return;
		}

		const filtered = allUsers.filter(user => {
			return user.username.toLowerCase().includes(query) ||
			       (user.email && user.email.toLowerCase().includes(query)) ||
			       user.id.toString().includes(query);
		});

		renderUsersTable(filtered);
	});
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

function formatDate(dateString) {
	if (!dateString) return 'н/д';
	
	// Нормализация временной метки: если сервер вернул строку без таймзоны ("YYYY-MM-DD HH:mm:ss"),
	// добавляем 'Z', чтобы трактовать её как UTC и затем показать в локальном времени пользователя.
	let date;
	if (typeof dateString === 'string') {
		const hasTZ = /[zZ]|[+-]\d\d:?\d\d/.test(dateString);
		date = new Date(hasTZ ? dateString : `${dateString}Z`);
	} else {
		date = new Date(dateString);
	}
	
	// Получаем локальный часовой пояс пользователя
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	
	return date.toLocaleString('ru-RU', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
async function init() {
	// Проверка прав доступа
	const hasAccess = await checkAdminAccess();
	if (!hasAccess) return;

	// Загружаем информацию о текущем пользователе
	let currentUserId = null;
	try {
		const me = await apiCall('/api/me');
		document.getElementById('currentAdminName').textContent = me.username;
		currentUserId = me.id;
		
		// Подключаемся к WebSocket для реал-тайм обновлений
		connectAdminWebSocket(currentUserId);
	} catch (err) {
		console.error('Ошибка получения текущего пользователя:', err);
	}

	// Загружаем данные
	await Promise.all([
		loadStats(),
		loadUsers(),
		loadTickets()
	]);

	// Настраиваем поиск
	setupSearch();

	// Обработчики кнопок
	document.getElementById('logoutBtn').addEventListener('click', async () => {
		try {
			await apiCall('/api/logout', { method: 'POST' });
			window.location.href = '/';
		} catch (err) {
			alert('Ошибка выхода: ' + err.message);
		}
	});

	// Модальные окна
	document.getElementById('closeUserDetailsModal').addEventListener('click', () => {
		document.getElementById('userDetailsModal').style.display = 'none';
	});

	document.getElementById('closeResetPasswordModal').addEventListener('click', () => {
		document.getElementById('resetPasswordModal').style.display = 'none';
	});

	// Тикеты - обработчики переключателей
	document.querySelectorAll('.toggle-btn[data-filter="status"]').forEach(btn => {
		btn.addEventListener('click', () => {
			// Убираем active со всех кнопок статуса
			document.querySelectorAll('.toggle-btn[data-filter="status"]').forEach(b => b.classList.remove('active'));
			// Добавляем active на кликнутую
			btn.classList.add('active');
			renderTickets();
		});
	});

	document.querySelectorAll('.toggle-btn[data-filter="archive"]').forEach(btn => {
		btn.addEventListener('click', () => {
			// Убираем active со всех кнопок архива
			document.querySelectorAll('.toggle-btn[data-filter="archive"]').forEach(b => b.classList.remove('active'));
			// Добавляем active на кликнутую
			btn.classList.add('active');
			loadTickets();
		});
	});

	document.getElementById('saveTicketStatusBtn')?.addEventListener('click', saveTicketStatus);
	document.getElementById('archiveTicketBtn')?.addEventListener('click', archiveCurrentTicket);
	document.getElementById('sendTicketReplyBtn')?.addEventListener('click', sendTicketReply);

	document.getElementById('confirmResetPasswordBtn').addEventListener('click', resetPassword);

	document.getElementById('cancelResetPasswordBtn').addEventListener('click', () => {
		document.getElementById('resetPasswordModal').style.display = 'none';
	});

	// Закрытие модального окна по клику на overlay
	document.getElementById('userDetailsModal').addEventListener('click', (e) => {
		if (e.target.id === 'userDetailsModal') {
			e.target.style.display = 'none';
		}
	});

	document.getElementById('resetPasswordModal').addEventListener('click', (e) => {
		if (e.target.id === 'resetPasswordModal') {
			e.target.style.display = 'none';
		}
	});
	
	// Обработчики сортировки
	document.querySelectorAll('.users-table th.sortable').forEach(th => {
		th.addEventListener('click', () => {
			sortUsers(th.dataset.sort);
		});
	});
}

// Запуск после загрузки DOM
document.addEventListener('DOMContentLoaded', init);
