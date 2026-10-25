import http from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(readFileSync(resolve(ROOT, 'data/seed.json'), 'utf8'));
const DAY = 86400000;
export function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
export function daysAway(date, current = today()) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NaN;
  const t = Date.parse(date + 'T00:00:00Z');
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== date) return NaN;
  return (t - Date.parse(current + 'T00:00:00Z')) / DAY;
}
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function text(value, name, min = 1, max = 500) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400, `${name} must contain ${min}–${max} characters.`);
  return value.trim();
}
function passwordInput(value, min = 1) {
  if (typeof value !== 'string' || value.length < min || value.length > 128) fail(400, `Password must contain ${min}�128 characters.`);
  return value;
}
function integer(value, name, min, max) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) fail(400, `${name} must be a whole number from ${min} to ${max}.`);
  return value;
}
function dateIn(value, min, max = Infinity) {
  const n = daysAway(value);
  if (!Number.isFinite(n) || n < min || n > max) fail(400, `Choose a valid date ${min}${max === Infinity ? ' or more' : '–' + max} days from today (IST).`);
  return value;
}
function hashPassword(password) { const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(password, salt, 64).toString('hex'); }
function passwordMatches(password, stored) { const [salt, hex] = stored.split(':'); return timingSafeEqual(Buffer.from(hex, 'hex'), scryptSync(password, salt, 64)); }
function tokenHash(token) { return createHash('sha256').update(token).digest('hex'); }

export function createStudio({ dbPath = process.env.DB_PATH || resolve(ROOT, 'data/studio.sqlite'), studioPassword = process.env.STUDIO_PASSWORD } = {}) {
  let initialStudioPassword;
  if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('customer','studio')));
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS paintings(id TEXT PRIMARY KEY,title TEXT NOT NULL,artist TEXT NOT NULL,description TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>0),imageUrl TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('available','sold')));
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),painting_id TEXT NOT NULL REFERENCES paintings(id),price INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('placed','cancelled')),created TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_order ON orders(painting_id) WHERE status='placed';
    CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),date TEXT NOT NULL,size INTEGER NOT NULL CHECK(size BETWEEN 10 AND 500),address TEXT NOT NULL,rate INTEGER NOT NULL,price INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('requested','confirmed','declined','cancelled')),created TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_date ON bookings(date) WHERE status IN ('requested','confirmed');
    CREATE TABLE IF NOT EXISTS pottery(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),item_id TEXT NOT NULL,glaze_id TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 12),needed_by TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('requested','accepted','declined','cancelled')),created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  function transaction(fn) { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } }
  transaction(() => {
    if (!get("SELECT 1 FROM metadata WHERE key='seeded'")) {
      for (const p of seed.paintings) run('INSERT INTO paintings VALUES(?,?,?,?,?,?,?)', p.id, p.title, p.artist, p.description, p.price, '/' + p.imageUrl, p.status);
      run("INSERT INTO metadata VALUES('seeded','1')");
    }
    if (!get("SELECT id FROM users WHERE role='studio'")) {
      initialStudioPassword = studioPassword || randomBytes(18).toString('base64url');
      run('INSERT INTO users VALUES(?,?,?,?,?)', randomUUID(), 'Studio team', process.env.STUDIO_EMAIL || seed.studioAccount.email, hashPassword(initialStudioPassword), 'studio');
    }
  });
  const attempts = new Map();
  function throttle(req, kind) {
    const now = Date.now(), key = req.socket.remoteAddress + ':' + kind;
    if (attempts.size > 1000) for (const [k,v] of attempts) if (now > v.until) attempts.delete(k);
    const entry = attempts.get(key);
    if (!entry || now > entry.until) attempts.set(key, { count: 1, until: now + 60000 });
    else if (++entry.count > 30) fail(429, 'Too many attempts. Please wait one minute.');
  }
  async function body(req) {
    if ((req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') fail(415, 'Send JSON data.');
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size <= 24000) chunks.push(chunk); }
    if (size > 24000) fail(413, 'The request is too large.');
    const data = Buffer.concat(chunks).toString('utf8');
    try { const value = JSON.parse(data); if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Invalid JSON object.'); return value; } catch (e) { if (e.status) throw e; fail(400, 'Invalid JSON.'); }
  }
  function user(req) {
    const token = /(?:^|;\s*)studio_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
    if (!token) fail(401, 'Please log in to continue.');
    const u = get('SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?', tokenHash(token), Date.now());
    if (!u) fail(401, 'Your session has expired. Please log in again.');
    return u;
  }
  function role(u, wanted) { if (u.role !== wanted) fail(403, 'Your account cannot perform this action.'); }
  function owned(table, id, u) { const row = get(`SELECT * FROM ${table} WHERE id=?`, id); if (!row || (u.role === 'customer' && row.user_id !== u.id)) fail(404, 'Record not found.'); return row; }
  function session(res, id) {
    const token = randomBytes(32).toString('hex');
    run('DELETE FROM sessions WHERE expires<=?', Date.now());
    run('INSERT INTO sessions VALUES(?,?,?)', tokenHash(token), id, Date.now() + 7 * DAY);
    res.setHeader('Set-Cookie', `studio_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.COOKIE_SECURE === 'true' ? '; Secure' : ''}`);
  }
  function paintingInput(b) {
    const imageUrl = text(b.imageUrl, 'Image', 1, 100);
    if (!/^\/images\/p-0(?:0[1-9]|1[0-2])\.jpg$/.test(imageUrl)) fail(400, 'Choose one of the supplied painting images.');
    return [text(b.title, 'Title', 1, 240), text(b.artist, 'Artist', 1, 100), text(b.description, 'Description', 1, 2000), integer(b.price, 'Price', 1, 100000000), imageUrl];
  }
  function potteryInput(b) {
    if (!seed.potteryItems.some(x => x.id === b.item_id)) fail(400, 'Choose a valid pottery item.');
    if (!seed.glazes.some(x => x.id === b.glaze_id)) fail(400, 'Choose a valid glaze.');
    return [b.item_id, b.glaze_id, integer(b.quantity, 'Quantity', 1, 12), dateIn(b.needed_by, 14)];
  }
  async function api(req, res, path) {
    const method = req.method;
    if (['POST','PATCH','DELETE'].includes(method)) {
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) fail(403, 'This request came from another website.');
    }
    if (path === '/api/register' && method === 'POST') {
      throttle(req, 'register'); const b = await body(req);
      if (b.role && b.role !== 'customer') fail(403, 'Only customer signup is available.');
      const name = text(b.name, 'Name', 2, 80), email = text(b.email, 'Email', 3, 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
      const password = passwordInput(b.password, 8);
      if (get('SELECT id FROM users WHERE email=?', email)) fail(409, 'An account already uses this email. Please log in.');
      const id = randomUUID();run('INSERT INTO users VALUES(?,?,?,?,?)', id, name, email, hashPassword(password), 'customer');session(res, id);
      return { user: { id, name, email, role: 'customer' } };
    }
    if (path === '/api/login' && method === 'POST') {
      throttle(req, 'login'); const b = await body(req);
      const email = text(b.email, 'Email', 3, 254).toLowerCase(), password = passwordInput(b.password);
      const u = get('SELECT * FROM users WHERE email=?', email);
      if (!u) { scryptSync(password, 'dummy-login-salt', 64); fail(401, 'Email or password is incorrect.'); }
      if (!passwordMatches(password, u.password)) fail(401, 'Email or password is incorrect.');
      session(res, u.id); return { user: { id:u.id, name:u.name, email:u.email, role:u.role } };
    }
    const u = user(req);
    if (path === '/api/me' && method === 'GET') return { user:u };
    if (path === '/api/logout' && method === 'POST') {
      const token = /studio_session=([a-f0-9]{64})/.exec(req.headers.cookie || '')?.[1];run('DELETE FROM sessions WHERE token=?', tokenHash(token));
      res.setHeader('Set-Cookie', 'studio_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return { ok:true };
    }
    if (path === '/api/catalog' && method === 'GET') return { paintings:all('SELECT * FROM paintings ORDER BY rowid'), potteryItems:seed.potteryItems, glazes:seed.glazes, rate:seed.mural.ratePerSqFt, currency:seed.currency, today:today(), busyDates:all("SELECT date FROM bookings WHERE status IN ('requested','confirmed')").map(x=>x.date) };
    if (path === '/api/dashboard' && method === 'GET') {
      const filter=u.role==='studio'?'':' WHERE r.user_id=?',args=u.role==='studio'?[]:[u.id];
      const list=(table,extra='',joins='')=>all(`SELECT r.*,u.name AS customer_name,u.email AS customer_email ${extra} FROM ${table} r JOIN users u ON u.id=r.user_id ${joins}${filter} ORDER BY r.created DESC`,...args);
      return { orders:list('orders',',p.title,p.imageUrl', 'JOIN paintings p ON p.id=r.painting_id'), bookings:list('bookings'), pottery:list('pottery'), today:today() };
    }
    let match;
    if (path === '/api/paintings' && method === 'POST') {
      role(u,'studio');const values=paintingInput(await body(req)),id=randomUUID();run("INSERT INTO paintings VALUES(?,?,?,?,?,?,'available')",id,...values);return { id };
    }
    if ((match=/^\/api\/paintings\/([^/]+)$/.exec(path)) && method === 'PATCH') {
      role(u,'studio');const values=paintingInput(await body(req));
      const changed=run("UPDATE paintings SET title=?,artist=?,description=?,price=?,imageUrl=? WHERE id=? AND status='available'",...values,match[1]).changes;
      if (!changed) { if (!get('SELECT id FROM paintings WHERE id=?',match[1])) fail(404,'Painting not found.');fail(409,'Only an available painting can be edited.'); }return {ok:true};
    }
    if (path === '/api/orders' && method === 'POST') {
      role(u,'customer');const b=await body(req),id=randomUUID();
      return transaction(()=>{
        const painting=get('SELECT * FROM paintings WHERE id=?',text(b.painting_id,'Painting ID',1,80));if(!painting)fail(404,'Painting not found.');
        if(painting.status!=='available')fail(409,'This painting has just sold. Please choose another.');
        run("UPDATE paintings SET status='sold' WHERE id=?",painting.id);
        run("INSERT INTO orders VALUES(?,?,?,?,'placed',?)",id,u.id,painting.id,painting.price,new Date().toISOString());return {id};
      });
    }
    if (path === '/api/bookings' && method === 'POST') {
      role(u,'customer');const b=await body(req),date=dateIn(b.date,7,90),size=integer(b.size,'Wall size',10,500),address=text(b.address,'Address',5,500),id=randomUUID();
      return transaction(()=>{
        if(get("SELECT id FROM bookings WHERE date=? AND status IN ('requested','confirmed')",date))fail(409,'This date has just been taken. Choose another date.');
        run("INSERT INTO bookings VALUES(?,?,?,?,?,?,?,'requested',?)",id,u.id,date,size,address,seed.mural.ratePerSqFt,size*seed.mural.ratePerSqFt,new Date().toISOString());return {id};
      });
    }
    if (path === '/api/pottery' && method === 'POST') {role(u,'customer');const values=potteryInput(await body(req)),id=randomUUID();run("INSERT INTO pottery VALUES(?,?,?,?,?,?,'requested',?)",id,u.id,...values,new Date().toISOString());return {id};}
    if ((match=/^\/api\/(orders|bookings|pottery)\/([^/]+)$/.exec(path))) {
      const [,table,id]=match;
      if(method==='GET')return {record:owned(table,id,u)};
      if(method==='PATCH'){
        const b=await body(req);
        return transaction(()=>{
          const record=owned(table,id,u);
          if(b.action==='cancel'){
            role(u,'customer');
            if(table==='orders'){
              if(record.status!=='placed')fail(409,'Only a placed order can be cancelled.');
              run("UPDATE orders SET status='cancelled' WHERE id=?",id);run("UPDATE paintings SET status='available' WHERE id=?",record.painting_id);
            } else if(table==='bookings'){
              if(!['requested','confirmed'].includes(record.status))fail(409,'This booking is no longer active.');
              if(daysAway(record.date)<3)fail(409,'Bookings can only be cancelled until 3 days before the date.');
              run("UPDATE bookings SET status='cancelled' WHERE id=?",id);
            } else {
              if(record.status!=='requested')fail(409,'Only a requested pottery order can be cancelled.');run("UPDATE pottery SET status='cancelled' WHERE id=?",id);
            }
          } else if(b.action==='edit') {
            role(u,'customer');if(table!=='pottery')fail(400,'Only pottery requests can be edited.');if(record.status!=='requested')fail(409,'This pottery request has already been reviewed.');
            run('UPDATE pottery SET item_id=?,glaze_id=?,quantity=?,needed_by=? WHERE id=?',...potteryInput(b),id);
          } else {
            role(u,'studio');const allowed=table==='bookings'?['confirmed','declined']:table==='pottery'?['accepted','declined']:[];
            if(!allowed.includes(b.action))fail(400,'Choose a valid studio action.');if(record.status!=='requested')fail(409,'This request has already been reviewed.');
            run(`UPDATE ${table} SET status=? WHERE id=?`,b.action,id);
          }return {ok:true};
        });
      }
    }
    fail(404,'Page or action not found.');
  }
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    try{
      const pathname=new URL(req.url,'http://localhost').pathname;
      if(pathname.startsWith('/api/')){
        res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
        const result=await api(req,res,pathname);res.end(JSON.stringify(result));return;
      }
      if(!['GET','HEAD'].includes(req.method))fail(405,'Method not allowed.');
      let decoded;try{decoded=decodeURIComponent(pathname==='/'?'/index.html':pathname);}catch{fail(400,'Invalid page address.');}
      const publicRoot=resolve(ROOT,'public'),file=resolve(publicRoot,'.'+decoded);
      if(!file.startsWith(publicRoot+'/')&&!file.startsWith(publicRoot+'\\'))fail(404,'File not found.');
      let bytes;try{bytes=readFileSync(file);}catch{fail(404,'File not found.');}
      res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');
      res.end(req.method==='HEAD'?undefined:bytes);
    }catch(error){res.statusCode=error.status||500;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:error.status?error.message:'Something went wrong. Please try again.'}));if(!error.status)console.error(error);}
  });
  return {server,db,initialStudioPassword};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=createStudio();const port=Number(process.env.PORT||8788),host=process.env.HOST||'127.0.0.1';
  app.server.listen(port,host,()=>console.log(`Art studio ready at http://${host}:${port}`));
  if(app.initialStudioPassword)console.log(`Initial studio login: ${process.env.STUDIO_EMAIL || seed.studioAccount.email}\nInitial studio password: ${app.initialStudioPassword}\nSave this locally. It is shown only when the studio account is first created.`);
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.server.close(()=>{app.db.close();process.exit(0);}));
}
