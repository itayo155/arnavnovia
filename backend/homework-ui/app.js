const $ = s => document.querySelector(s);
const basePath = location.pathname === '/homework' || location.pathname.startsWith('/homework/') ? '/homework' : '';
$('.export').href = basePath + '/export.csv';
let data = {tasks: [], sync: {}}, child = '', loading = false;
let lastSnapshot = '';
const dateFormat = new Intl.DateTimeFormat('he-IL', {day:'numeric', month:'short', timeZone:'Asia/Jerusalem'});
const calendarDateFormat = new Intl.DateTimeFormat('en-CA', {year:'numeric', month:'2-digit', day:'2-digit', timeZone:'Asia/Jerusalem'});
$('#today').textContent = new Intl.DateTimeFormat('he-IL', {weekday:'long', day:'numeric', month:'long', timeZone:'Asia/Jerusalem'}).format(new Date());

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function linkedText(node, text) {
  let offset = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>]+/g)) {
    node.append(document.createTextNode(text.slice(offset, match.index)));
    const a = el('a', '', match[0]);
    a.href = match[0]; a.target = '_blank'; a.rel = 'noreferrer noopener';
    node.append(a); offset = match.index + match[0].length;
  }
  node.append(document.createTextNode(text.slice(offset)));
}
async function post(url, body) {
  const r = await fetch(basePath + url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  if (!r.ok) throw new Error('לא הצלחנו לשמור. נסו שוב.');
  return r.json();
}
function render() {
  const children = [...new Map(data.tasks.map(t => [t.child_id, t.child])).entries()];
  const childNodes = [['', 'כולם'], ...children].map(([id, name]) => {
    const button = el('button', id === child ? 'active' : '', name);
    button.setAttribute('aria-pressed', id === child);
    button.onclick = () => {child = id; render();};
    return button;
  });
  $('#children').replaceChildren(...childNodes);
  const days = $('#time-range').value;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - (Number(days) || 0));
  const cutoffDate = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(cutoff);
  const scope = data.tasks.filter(t => (!child || t.child_id === child) && (days === 'all' || t.lesson_date >= cutoffDate));
  const open = scope.filter(t => !t.done).length;
  $('#remaining').textContent = open;
  $('#progress').style.width = `${scope.length ? (scope.length-open)/scope.length*100 : 0}%`;
  $('#progress-label').textContent = scope.length ? `${scope.length-open} מתוך ${scope.length} הושלמו` : 'מתחילים בצעד קטן';
  const query = $('#search').value.trim().toLocaleLowerCase();
  const tasks = scope.filter(t => ($('#show-done').checked || !t.done) &&
    `${t.child} ${t.subject} ${t.teacher} ${t.body}`.toLocaleLowerCase().includes(query));
  $('#list-count').textContent = `(${tasks.length})`;
  $('#tasks').replaceChildren(...tasks.map(t => {
    const row = el('article', 'task' + (t.done ? ' done' : ''));
    const checkbox = el('input', 'task-check'); checkbox.type = 'checkbox'; checkbox.checked = t.done;
    checkbox.setAttribute('aria-label', `סימון ${t.subject} של ${t.child} כהושלם`);
    checkbox.onchange = async () => {
      checkbox.disabled = true;
      try {await post('/api/complete', {id:t.id, done:checkbox.checked}); await refresh();}
      catch (e) {checkbox.checked = t.done; $('#sync-detail').textContent = e.message;}
      finally {checkbox.disabled = false;}
    };
    const identity = el('div', 'task-identity');
    identity.append(el('h3', 'subject', t.subject), el('span', 'child-label', t.child));
    const content = el('div', 'task-content'), body = el('p', 'task-body');
    linkedText(body, t.body); content.append(body);
    const meta = el('p', 'task-meta', t.teacher ? `מורה: ${t.teacher}` : '');
    if (t.files.length) {
      const attachments = el('div', 'attachments');
      t.files.forEach((file, index) => {
        try {
          const url = new URL(file.fileUrl);
          if (url.origin !== 'https://webtopserver.smartschool.co.il' || url.pathname !== '/server/api/stream/GetFile') return;
          const link = el('a', 'attachment', `↗ קובץ מצורף ${index+1} ${file.fileExtantion || ''}`);
          link.href = url.href; link.target = '_blank'; link.rel = 'noreferrer noopener'; attachments.append(link);
        } catch (_) { /* Unknown attachment formats remain available in Webtop. */ }
      });
      content.append(attachments);
    }
    if (t.revised) meta.append(el('span', 'revised', 'המשימה עודכנה'));
    content.append(meta);
    const date = new Date(t.lesson_date + 'T12:00:00+02:00');
    const when = el('div', 'task-date', !isNaN(date) ? dateFormat.format(date) : t.lesson_date);
    when.append(el('div', '', `תאריך השיעור · ${t.lesson_hour}`));
    row.append(checkbox, identity, content, when);
    return row;
  }));
  $('#empty').hidden = tasks.length > 0;
  $('#empty-title').textContent = !data.tasks.length ? 'מקום לכל שיעורי הבית' : query ? 'לא נמצאו משימות' : open === 0 ? 'הכול מסומן. זמן לשחק.' : 'אין משימות בתצוגה הזאת';
  $('#empty-detail').textContent = !data.tasks.length ? 'שיעורי הבית יופיעו כאן לאחר העדכון הבא.' : query ? 'אפשר לנסות מילה אחרת או לבחור את כל הילדים.' : 'אפשר להציג גם משימות שהושלמו, או לחזור לאחר העדכון הבא.';
  renderSyncStatus();
}
function renderSyncStatus(now = new Date()) {
  const sync = data.sync, busy = sync.state === 'syncing';
  const lastSuccess = sync.last_success ? new Date(sync.last_success) : null;
  const hasLastSuccess = lastSuccess !== null && Number.isFinite(lastSuccess.getTime());
  const stale = hasLastSuccess && calendarDateFormat.format(lastSuccess) < calendarDateFormat.format(now);
  $('.sync-status').classList.toggle('stale', stale);
  $('#status-dot').classList.toggle('attention', stale || sync.state === 'attention');
  $('#sync-label').textContent = busy ? 'שיעורי הבית מתעדכנים' : sync.state === 'attention' ? 'העדכון מתעכב' : stale ? 'שיעורי הבית לא עודכנו היום' : sync.state === 'ok' ? 'שיעורי הבית מעודכנים' : 'ממתינים לעדכון הראשון';
  const last = hasLastSuccess ? `איסוף מוצלח אחרון: ${new Intl.DateTimeFormat('he-IL', {dateStyle:'short', timeStyle:'short', timeZone:'Asia/Jerusalem'}).format(lastSuccess)}` : 'עדיין לא בוצע איסוף מוצלח';
  $('#sync-detail').textContent = `${last} · המידע מתעדכן אוטומטית`;
}
async function refresh() {
  if (loading) return;
  // Refresh the calendar warning even when the server data is unchanged or offline.
  renderSyncStatus();
  loading = true;
  try {
    const response = await fetch(basePath + '/api/tasks');
    if (!response.ok) throw new Error();
    const next = await response.json(), serialized = JSON.stringify(next);
    if (serialized !== lastSnapshot) {data = next; lastSnapshot = serialized; render();}
  } catch (_) {$('#sync-label').textContent = 'החיבור ללוח נותק'; $('#sync-detail').textContent = 'המשימות השמורות נשארות כאן. ננסה להתחבר שוב בקרוב.';}
  finally {loading = false;}
}
$('#search').oninput = render;
$('#show-done').onchange = render;
$('#time-range').onchange = render;
refresh(); setInterval(refresh, 4000);
