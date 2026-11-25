/* 管理端 API 封装 + 全局状态 */
(function () {
  const BASE = 'https://appointment-354184-7-1541041395.sh.run.tcloudbase.com/api/admin/v1';
  const TOKEN_KEY = 'salon_admin_token';
  const USER_KEY = 'salon_admin_user';
  const STORE_KEY = 'salon_admin_store';

  const state = Vue.reactive({
    token: localStorage.getItem(TOKEN_KEY) || '',
    user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
    store: JSON.parse(localStorage.getItem(STORE_KEY) || 'null'),
    toasts: [],
    loading: 0
  });

  function toast(message, type) {
    const id = Date.now() + Math.random();
    state.toasts.push({ id: id, message: message, type: type || 'ok' });
    setTimeout(() => {
      const i = state.toasts.findIndex((t) => t.id === id);
      if (i >= 0) state.toasts.splice(i, 1);
    }, 2600);
  }

  function setAuth(token, user, store) {
    state.token = token || '';
    state.user = user || null;

    if (store) {
      state.store = store;
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } else if (!token) {
      // 退出登录时一并清除门店缓存
      state.store = null;
    }

    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }

  /** 门店信息变更（改名/改地址等）后同步缓存与侧栏展示 */
  function updateStoreCache(patch) {
    if (!state.store) state.store = {};
    Object.assign(state.store, patch);
    localStorage.setItem(STORE_KEY, JSON.stringify(state.store));
  }

  async function request(path, options) {
    options = options || {};
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers.Authorization = 'Bearer ' + state.token;

    state.loading++;
    let res;
    try {
      res = await fetch(BASE + path, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });
    } catch (e) {
      state.loading--;
      toast('网络连接失败，请检查服务是否运行', 'err');
      throw e;
    }
    state.loading--;

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (res.status === 401) {
      setAuth('', null, null);
      toast('登录已过期，请重新登录', 'err');
      const err = new Error('unauthorized');
      err.code = 1002;
      throw err;
    }

    if (!data || data.code !== 0) {
      const msg = (data && data.message) || '请求失败';
      if (!options.silent) toast(msg, 'err');
      const err = new Error(msg);
      err.code = data && data.code;
      throw err;
    }
    return data.data;
  }

  /** 带鉴权下载 CSV（fetch 拿 blob 再触发下载，避免 window.open 带不上 token） */
  async function downloadCsv(path, filename) {
    const headers = {};
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    let res;
    try {
      res = await fetch(BASE + path, { headers });
    } catch (e) {
      toast('网络连接失败', 'err');
      return;
    }
    if (!res.ok) {
      let msg = '导出失败';
      try {
        const j = await res.json();
        msg = j.message || msg;
      } catch (e) {
        if (res.status === 403) msg = '无导出权限（需店长及以上）';
      }
      toast(msg, 'err');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    toast('已开始下载');
  }

  const api = {
    // 认证
    login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
    me: () => request('/auth/me'),
    changePassword: (oldPassword, newPassword) =>
      request('/auth/password', { method: 'PUT', body: { oldPassword, newPassword } }),

    // 看板
    dashboard: (date) => request('/dashboard' + (date ? '?date=' + date : '')),

    // 预约
    appointments: (q) => request('/appointments?' + new URLSearchParams(clean(q)).toString()),
    appointment: (id) => request('/appointments/' + id),
    appointmentAction: (id, action) => request('/appointments/' + id + '/' + action, { method: 'POST' }),
    cancelAppointment: (id, reason) =>
      request('/appointments/' + id + '/cancel', { method: 'POST', body: { reason } }),
    rescheduleAppointment: (id, date, startTime) =>
      request('/appointments/' + id + '/reschedule', { method: 'POST', body: { date, startTime } }),
    createAppointment: (body) => request('/appointments', { method: 'POST', body }),
    slots: (date, serviceId) => request('/slots?date=' + date + '&serviceId=' + serviceId),
    exportAppointments: (q) => {
      const p = new URLSearchParams(clean(q)).toString();
      return downloadCsv('/appointments/export?' + p, '预约明细_' + (q.from || '') + '_' + (q.to || '') + '.csv');
    },
    exportCustomers: (q) => {
      const p = new URLSearchParams(clean(q)).toString();
      return downloadCsv('/customers/export?' + p, '客户名单.csv');
    },
    runReminders: () => request('/reminder-jobs/run', { method: 'POST' }),

    // 客户
    customers: (q) => request('/customers?' + new URLSearchParams(clean(q)).toString()),
    customer: (id) => request('/customers/' + id),
    updateCustomer: (id, body) => request('/customers/' + id, { method: 'PUT', body }),
    revealPhone: (id) => request('/customers/' + id + '/phone'),

    // 统计
    stats: (from, to) => request('/stats?from=' + from + '&to=' + to),

    // 服务项目
    services: () => request('/services'),
    createService: (body) => request('/services', { method: 'POST', body }),
    updateService: (id, body) => request('/services/' + id, { method: 'PUT', body }),
    toggleService: (id, field, value) =>
      request('/services/' + id + '/toggle', { method: 'PATCH', body: { field, value } }),
    deleteService: (id) => request('/services/' + id, { method: 'DELETE' }),

    // 营业设置
    businessHours: () => request('/settings/business-hours'),
    saveBusinessHours: (week) => request('/settings/business-hours', { method: 'PUT', body: { week } }),
    saveStoreSettings: (body) => request('/settings/store', { method: 'PUT', body }),
    specialDates: () => request('/settings/special-dates'),
    addSpecialDate: (body) => request('/settings/special-dates', { method: 'POST', body }),
    removeSpecialDate: (id) => request('/settings/special-dates/' + id, { method: 'DELETE' }),

    // 提醒
    reminderRules: () => request('/reminder-rules'),
    saveReminderRule: (body) => request('/reminder-rules', { method: 'POST', body }),
    toggleReminderRule: (id, enabled) =>
      request('/reminder-rules/' + id + '/toggle', { method: 'PATCH', body: { enabled } }),
    deleteReminderRule: (id) => request('/reminder-rules/' + id, { method: 'DELETE' }),
    reminderJobs: (q) => request('/reminder-jobs?' + new URLSearchParams(clean(q)).toString()),
    retryReminderJob: (id) => request('/reminder-jobs/' + id + '/retry', { method: 'POST' }),

    // 二维码
    qrcodes: () => request('/qrcodes'),
    createQrcode: (body) => request('/qrcodes', { method: 'POST', body }),
    toggleQrcode: (id, status) => request('/qrcodes/' + id, { method: 'PATCH', body: { status } }),
    deleteQrcode: (id) => request('/qrcodes/' + id, { method: 'DELETE' }),
    qrcodeStats: (id) => request('/qrcodes/' + id + '/stats'),

    // 账号与审计
    users: () => request('/users'),
    createUser: (body) => request('/users', { method: 'POST', body }),
    updateUser: (id, body) => request('/users/' + id, { method: 'PUT', body }),
    auditLogs: (page) => request('/audit-logs?page=' + (page || 1) + '&size=30')
  };

  function clean(obj) {
    const out = {};
    Object.keys(obj || {}).forEach((k) => {
      const v = obj[k];
      if (v !== undefined && v !== null && v !== '') out[k] = v;
    });
    return out;
  }

  // 通用工具
  const util = {
    today() {
      const d = new Date();
      const p = (n) => (n < 10 ? '0' + n : '' + n);
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    },
    addDays(date, n) {
      const d = new Date(date.replace(/-/g, '/') + ' 00:00:00');
      d.setDate(d.getDate() + n);
      const p = (x) => (x < 10 ? '0' + x : '' + x);
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    },
    weekday(date) {
      return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][
        new Date(date.replace(/-/g, '/') + ' 00:00:00').getDay()
      ];
    },
    mmdd(date) {
      const p = (date || '').split('-');
      return p[1] + '/' + p[2];
    },
    friendlyDay(date) {
      const t = util.today();
      if (date === t) return '今天';
      if (date === util.addDays(t, 1)) return '明天';
      if (date === util.addDays(t, -1)) return '昨天';
      return util.weekday(date);
    },
    money(v) {
      return v === null || v === undefined ? '—' : '¥' + Number(v).toFixed(0);
    },
    statusTag(status) {
      return (
        {
          1: 'tag-orange',
          2: 'tag-green',
          3: 'tag-blue',
          4: 'tag-gray',
          5: 'tag-red',
          6: 'tag-purple'
        }[status] || 'tag-gray'
      );
    },
    roleName(role) {
      return { 1: '管理员', 2: '店长', 3: '店员' }[role] || '未知';
    }
  };

  window.AdminAPI = api;
  window.AdminState = state;
  window.AdminToast = toast;
  window.AdminUtil = util;
  window.AdminSetAuth = setAuth;
  window.AdminUpdateStore = updateStoreCache;
})();
