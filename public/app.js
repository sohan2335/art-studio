// Plain JavaScript: state holds data, render functions display it, API calls save changes.
const $ = selector => document.querySelector(selector);
const profilePage = location.pathname === '/profile.html';
const homePage = location.pathname === '/' || location.pathname === '/index.html';
const state = { user:null, catalog:null, activity:null, search:'', availability:'all' };
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => new Intl.NumberFormat('en-IN', {style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
const studio = () => state.user?.role === 'studio';
const modal = $('#modal');
let toastTimer;
function toast(message) { const el=$('#toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,5000); }
async function api(path, options={}) {
  let response;
  try { response=await fetch('/api'+path, {credentials:'same-origin', ...options, headers:{'Content-Type':'application/json',...options.headers}, body:options.body===undefined?undefined:JSON.stringify(options.body)}); }
  catch { throw new Error('Cannot reach the studio. Check your connection and try again.'); }
  let data;try { data=await response.json(); } catch { throw new Error('The server returned an unexpected response. Please try again.'); }
  if(!response.ok){ if(response.status===401&&state.user&&path!=='/login'){clearSession();toast('Your session has expired. Please log in again.');} const e=new Error(data.error||'Unable to complete this action.');e.status=response.status;throw e; }return data;
}
function clearSession(){
  state.user=null;state.catalog=null;state.activity=null;
  if(modal.open)modal.close();
  if($('#dashboard-content'))$('#dashboard-content').innerHTML='';
  renderAccount();renderGallery();renderForms();
}
function setModal(title,content) { $('#modal-title').textContent=title;$('#modal-content').innerHTML=content;if(!modal.open)modal.showModal(); }
$('#close-modal').onclick=()=>modal.close();
modal.addEventListener('click',event=>{if(event.target===modal){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();}});
function auth(mode='register') {
  const signup=mode==='register';
  setModal(signup?'Welcome to the studio.':'Good to see you again.',`<p class="modal-intro">${signup?'Create your customer account to collect art, book wall painting and request pottery.':'Log in as a customer or with your studio account.'}</p>
  <form id="auth-form" data-mode="${mode}">${signup?'<label>Your name<input name="name" autocomplete="name" minlength="2" maxlength="80" required></label>':''}
  <label>Email address<input name="email" type="email" autocomplete="email" maxlength="254" required></label>
  <label>Password<input name="password" type="password" autocomplete="${signup?'new-password':'current-password'}" minlength="${signup?8:1}" maxlength="128" required></label>
  ${signup?'<p class="form-help">Use at least 8 characters. Signup creates a customer account.</p>':''}<p class="form-error" role="alert"></p><button class="button dark" type="submit">${signup?'Create account':'Log in'} ↗</button></form>
  <p class="modal-switch">${signup?'Already have an account?':'New to Atelier?'} <button class="link-button" data-auth="${signup?'login':'register'}">${signup?'Log in':'Sign up'}</button></p>`);
}
function gate(title,description='Create a customer account or log in to continue.') {return `<div class="gate"><h3>${title}</h3><p>${description}</p><button class="button dark" data-auth="register">Sign up ↗</button> <button class="text-button" data-auth="login">Log in</button></div>`;}
const addDays=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
function delta(date){return (Date.parse(date+'T00:00:00Z')-Date.parse((state.activity?.today||state.catalog.today)+'T00:00:00Z'))/86400000;}
function status(value){return `<span class="status ${esc(value)}">${esc(value)}</span>`;}
function renderAccount(){
  $('#account').innerHTML=state.user?`<a class="user-label" href="/profile.html">${studio()?'Studio profile':'Profile'}</a><button class="button small" id="logout">Log out ↗</button>`:`<button class="text-button" data-auth="login">Log in</button><button class="button small" data-auth="register">Sign up ↗</button>`;
  if($('#join'))$('#join').hidden=!!state.user;
  if($('#dashboard'))$('#dashboard').hidden=!state.user;
  if($('.hero-signup'))$('.hero-signup').hidden=!!state.user;
  if($('#gallery-tools'))$('#gallery-tools').hidden=!state.user||homePage;
  if($('#add-painting'))$('#add-painting').hidden=!studio();
  if($('#dashboard-title'))$('#dashboard-title').textContent=studio()?'Studio activity':'My activity';
  if($('#dashboard-description'))$('#dashboard-description').textContent=studio()?'Review customer requests and manage the collection.':'Your paintings, wall bookings and pottery requests, all in one place.';
  if($('#profile-gate'))$('#profile-gate').hidden=!!state.user;
  if($('#profile-info')){
    $('#profile-info').hidden=!state.user;
    $('#profile-info').innerHTML=state.user?`<div class="profile-avatar" aria-hidden="true">${esc(state.user.name.slice(0,1).toUpperCase())}</div><div><p class="eyebrow">${studio()?'STUDIO / ADMIN ACCOUNT':'CUSTOMER ACCOUNT'}</p><h1>${esc(state.user.name)}</h1><p>${esc(state.user.email)}</p><p class="profile-role-note">${studio()?'Manage paintings and review all customer requests.':'Only your orders, bookings and pottery requests appear here.'}</p></div>`:'';
  }
}
function renderGallery(){
  const el=$('#gallery-content');if(!el)return;
  $('#collection-count').textContent=state.catalog?.paintings.length||12;
  if(!state.user||homePage){el.innerHTML=`<div class="art-grid">${[{id:'p-001',title:'Madhubani Peacock Garden',artist:'Meera Kumari',price:6500},{id:'p-005',title:'Kalamkari Tree of Life',artist:'Padma Reddy',price:9200},{id:'p-008',title:'Rajasthani Miniature: Courtyard at Dusk',artist:'Kishan Singh Rathore',price:15500}].map(p=>`<article class="painting-card"><div class="painting-picture"><img src="/images/${p.id}.jpg" loading="lazy" alt="Supplied sample image for ${esc(p.title)}"></div><h3>${esc(p.title)}</h3><p class="artist">${esc(p.artist)}</p><div class="painting-bottom"><strong>${money(p.price)}</strong>${homePage?'<a class="link-button" href="/collection.html">View collection ↗</a>':'<button class="link-button" data-auth="register">Sign up to explore ↗</button>'}</div></article>`).join('')}</div>${homePage?'<div class="gate"><h3>Your next favourite is waiting.</h3><p>Explore every painting and find a piece for your space.</p><a class="button dark" href="/collection.html">Browse the full collection ↗</a></div>':gate('Your next favourite is waiting.','Log in to see current availability and the full collection of 12 supplied paintings.')}`;return;}
  if(!state.catalog)return;
  const paintings=state.catalog.paintings.filter(p=>(state.availability==='all'||p.status===state.availability)&&`${p.title} ${p.artist} ${p.description}`.toLowerCase().includes(state.search.toLowerCase()));
  el.innerHTML=paintings.length?`<div class="art-grid fade-in">${paintings.map(p=>`<article class="painting-card"><div class="painting-picture"><img src="${esc(p.imageUrl)}" loading="lazy" alt="Supplied sample image for ${esc(p.title)}">${status(p.status)}</div><h3>${esc(p.title)}</h3><p class="artist">${esc(p.artist)}</p><div class="painting-bottom"><strong>${money(p.price)}</strong><button class="link-button" data-detail="${esc(p.id)}">View painting ↗</button>${studio()&&p.status==='available'?`<button class="link-button" data-edit-painting="${esc(p.id)}">Edit</button>`:''}</div></article>`).join('')}</div>`:'<div class="empty">No paintings match these filters. Try another title, artist or availability.</div>';
}
function renderForms(){
  const wall=$('#wall-form-container'),pottery=$('#pottery-form-container');
  if(!wall&&!pottery)return;
  if(homePage){
    if(wall)wall.innerHTML='<h3>Let’s make a little room for art.</h3><p>Take the next step on our wall painting page. Choose your date, tell us the size, and send your request.</p><a class="button" href="/wall-art.html">Book wall painting ↗</a>';
    if(pottery)pottery.innerHTML='<h3>A form. A colour. Your idea.</h3><p>Choose your pottery item and favourite glaze on our dedicated pottery page.</p><a class="button dark" href="/pottery.html">Create a pottery request ↗</a>';
    return;
  }
  if(!state.user){if(wall)wall.innerHTML=gate('A blank wall is a beginning.');if(pottery)pottery.innerHTML=gate('Something made for you.');return;}
  if(studio()){if(wall)wall.innerHTML='<h3>A space for the studio.</h3><p>Customers request wall dates here. Review all incoming bookings in your studio profile.</p><a class="button" href="/profile.html#bookings">Review bookings ↓</a>';if(pottery)pottery.innerHTML='<h3>From request to creation.</h3><p>Customers choose a form, glaze and date. Accept or decline their requests from the studio profile.</p><a class="button dark" href="/profile.html#pottery">Review pottery ↓</a>';return;}
  if(!state.catalog)return;
  const {today,rate,busyDates}=state.catalog;
  if($('#wall-rate'))$('#wall-rate').textContent=money(rate);
  if(wall)wall.innerHTML=`<h3>Tell us about your wall</h3><form id="wall-form"><div class="form-row"><label>Preferred date<input type="date" name="date" min="${addDays(today,7)}" max="${addDays(today,90)}" required></label><label>Wall size (sq ft)<input name="size" type="number" min="10" max="500" step="1" value="50" required></label></div><label>Full address<textarea name="address" minlength="5" maxlength="500" placeholder="Street, locality, city and postcode" required></textarea></label><p class="form-help">Choose a date 7–90 days ahead. Requests reserve the date while the studio reviews them.</p>${busyDates.length?`<p class="busy-note">Unavailable dates: ${busyDates.map(esc).join(', ')}</p>`:'<p class="form-help">All dates in the booking window are currently open.</p>'}<div class="estimate"><span>Estimated total<br><small>${money(rate)} × wall size</small></span><strong id="wall-total">${money(50*rate)}</strong></div><p class="form-error" role="alert"></p><button class="button" type="submit">Request wall painting ↗</button></form>`;
  if(pottery)pottery.innerHTML=`<h3>Your pottery request</h3>${potteryForm()}`;
}
function potteryForm(record){
  const c=state.catalog;
  return `<form id="${record?'edit-pottery-form':'pottery-form'}" ${record?`data-id="${esc(record.id)}"`:''}><label>Choose an item<select name="item_id" required>${c.potteryItems.map(x=>`<option value="${x.id}" ${record?.item_id===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><label>Choose a glaze<select name="glaze_id" required>${c.glazes.map(x=>`<option value="${x.id}" ${record?.glaze_id===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><div class="glaze-swatches" aria-hidden="true">${c.glazes.map(()=>'<span class="swatch"></span>').join('')}</div><div class="form-row"><label>Quantity<input name="quantity" type="number" min="1" max="12" step="1" value="${record?.quantity||1}" required></label><label>Needed by<input name="needed_by" type="date" min="${addDays(c.today,14)}" value="${esc(record?.needed_by||'')}" required></label></div><p class="form-help">Allow at least 14 days. This is a request for studio review; no payment is collected.</p><p class="form-error" role="alert"></p><button class="button dark" type="submit">${record?'Save changes':'Request pottery'} ↗</button></form>`;
}
function detail(id){const p=state.catalog.paintings.find(x=>x.id===id);if(!p)return;
  setModal('A closer look',`<img class="detail-image" src="${esc(p.imageUrl)}" alt="Supplied sample image for ${esc(p.title)}"><h3>${esc(p.title)}</h3><p class="fine">${esc(p.artist)}</p><p class="detail-copy">${esc(p.description)}</p>${status(p.status)}<div class="detail-footer"><strong class="detail-price">${money(p.price)}</strong>${!studio()&&p.status==='available'?`<button class="button dark" data-buy="${esc(p.id)}">Buy this painting ↗</button>`:studio()&&p.status==='available'?`<button class="button dark" data-edit-painting="${esc(p.id)}">Edit painting</button>`:'<span class="fine">This painting has a home.</span>'}</div><p class="fine">Buying creates an order. No real payment is taken. You can cancel a placed order from My activity.</p><p class="form-error" id="detail-error" role="alert"></p>`);
}
function paintingEditor(id){
  const p=id?state.catalog.paintings.find(x=>x.id===id):null;
  setModal(p?'Edit painting':'Add a painting',`<p class="modal-intro">Only available paintings can be edited. Choose an existing supplied image; uploads are outside the assignment scope.</p><form id="painting-form" data-id="${esc(id||'')}"><label>Title<input name="title" maxlength="240" value="${esc(p?.title||'')}" required></label><label>Artist<input name="artist" maxlength="100" value="${esc(p?.artist||'')}" required></label><label>Description<textarea name="description" maxlength="2000" required>${esc(p?.description||'')}</textarea></label><div class="form-row"><label>Price (INR)<input name="price" type="number" min="1" max="100000000" step="1" value="${p?.price||''}" required></label><label>Supplied image<select name="imageUrl">${Array.from({length:12},(_,i)=>`/images/p-${String(i+1).padStart(3,'0')}.jpg`).map(x=>`<option value="${x}" ${p?.imageUrl===x?'selected':''}>${x.split('/').pop()}</option>`).join('')}</select></label></div><p class="form-error" role="alert"></p><button class="button dark" type="submit">Save painting ↗</button></form>`);
}
function renderActivity(){
  if(!state.activity)return;
  $('#dashboard-content').innerHTML=['orders','bookings','pottery'].map(type=>{
    const names={orders:'Painting orders',bookings:'Wall bookings',pottery:'Pottery requests'};
    return `<div class="activity-group" id="${type}"><h3>${names[type]} <small>(${state.activity[type].length})</small></h3><div class="activity-list">${state.activity[type].length?state.activity[type].map(r=>{
      let title,description;
      if(type==='orders'){title=r.title;description=`${money(r.price)} · Order ${r.id.slice(0,8)}`;}
      if(type==='bookings'){title=`Wall painting · ${r.date}`;description=`${r.size} sq ft × ${money(r.rate)} = ${money(r.price)}`;}
      if(type==='pottery'){title=state.catalog.potteryItems.find(x=>x.id===r.item_id)?.name||r.item_id;description=`${state.catalog.glazes.find(x=>x.id===r.glaze_id)?.name||r.glaze_id} · ${r.quantity} ${r.quantity===1?'piece':'pieces'} · Needed ${r.needed_by}`;}
      let actions='';
      if(studio()&&r.status==='requested'&&type!=='orders'){actions=`<button class="action-button" data-record="${r.id}" data-type="${type}" data-action="${type==='bookings'?'confirmed':'accepted'}">${type==='bookings'?'Confirm booking':'Accept request'}</button><button class="action-button danger" data-record="${r.id}" data-type="${type}" data-action="declined">Decline</button>`;}
      if(!studio()){
        if(type==='pottery'&&r.status==='requested')actions=`<button class="action-button" data-edit-pottery="${r.id}">Edit request</button>`;
        const cancel=(type==='orders'&&r.status==='placed')||(type==='bookings'&&['requested','confirmed'].includes(r.status)&&delta(r.date)>=3)||(type==='pottery'&&r.status==='requested');
        if(cancel)actions+=`<button class="action-button danger" data-record="${r.id}" data-type="${type}" data-action="cancel">Cancel ${type==='orders'?'order':type==='bookings'?'booking':'request'}</button>`;
      }
      return `<article class="activity"><div><h4>${esc(title)}</h4><p>${esc(description)}</p>${type==='bookings'?`<p>${esc(r.address)}</p>`:''}${studio()?`<p>Customer: ${esc(r.customer_name)} · ${esc(r.customer_email)}</p>`:''}<p>Created ${esc(r.created.slice(0,10))}</p>${!studio()&&type==='bookings'&&['requested','confirmed'].includes(r.status)&&delta(r.date)<3?'<p>The cancellation window has closed.</p>':''}${actions?`<div class="actions">${actions}</div>`:''}</div><div>${status(r.status)}</div></article>`;
    }).join(''):`<div class="empty">${studio()?'No customer activity here yet.':'Nothing here yet. Visit the studio to explore paintings or make a request.'}</div>`}</div></div>`;
  }).join('');
}
async function loadCatalog(){
  if($('#gallery-content'))$('#gallery-content').innerHTML='<div class="loading">Opening the collection…</div>';
  for(const id of ['#wall-form-container','#pottery-form-container'])if($(id))$(id).innerHTML='<div class="loading">Loading studio options…</div>';
  try{state.catalog=await api('/catalog');renderGallery();renderForms();}
  catch(error){if($('#gallery-content'))$('#gallery-content').innerHTML=`<div class="error-state">${esc(error.message)}<br><button class="link-button" data-retry-catalog>Try again</button></div>`;for(const id of ['#wall-form-container','#pottery-form-container'])if($(id))$(id).innerHTML=`<div class="error-state">${esc(error.message)}<br><button class="link-button" data-retry-catalog>Try again</button></div>`;}
}
async function loadActivity(){
  if(!$('#dashboard-content'))return;
  $('#dashboard-content').innerHTML='<div class="loading">Loading your studio activity…</div>';
  try{state.activity=await api('/dashboard');if(state.catalog)renderActivity();else $('#dashboard-content').innerHTML='<div class="error-state">Studio options could not load. Use Refresh to try again.</div>';}
  catch(error){$('#dashboard-content').innerHTML=`<div class="error-state">${esc(error.message)}<br><button class="link-button" id="retry-activity">Try again</button></div>`;}
}
async function refresh(){if(homePage){renderGallery();renderForms();return;}await loadCatalog();if(state.user)await loadActivity();}
async function afterLogin(user){state.user=user;renderAccount();await refresh();}
document.addEventListener('input',event=>{if(event.target.id==='search'){state.search=event.target.value;renderGallery();}if(event.target.name==='size'&&event.target.closest('#wall-form'))$('#wall-total').textContent=money(Number(event.target.value)*state.catalog.rate);});
document.addEventListener('change',event=>{if(event.target.id==='availability'){state.availability=event.target.value;renderGallery();}if(event.target.name==='date'&&event.target.closest('#wall-form'))event.target.setCustomValidity(state.catalog.busyDates.includes(event.target.value)?'This date is already booked. Choose another date.':'');});
document.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.auth)return auth(button.dataset.auth);
  if(button.dataset.detail)return detail(button.dataset.detail);
  if(button.dataset.editPainting)return paintingEditor(button.dataset.editPainting);
  if(button.id==='add-painting')return paintingEditor();
  if(button.id==='refresh')return refresh();
  if(button.id==='retry-activity')return loadActivity();
  if(button.hasAttribute('data-retry-catalog'))return refresh();
  if(button.dataset.editPottery){const record=state.activity.pottery.find(x=>x.id===button.dataset.editPottery);return setModal('Edit pottery request',potteryForm(record));}
  if(button.id==='logout'){
    button.disabled=true;try{await api('/logout',{method:'POST',body:{}});clearSession();if(profilePage)location.href='/';else location.hash='home';toast('You’re logged out.');}catch(error){toast(error.message);}finally{button.disabled=false;}return;
  }
  if(button.dataset.buy){
    const painting=state.catalog.paintings.find(x=>x.id===button.dataset.buy);
    setModal('Make it yours?',`<p class="detail-copy">Place an order for <strong>${esc(painting.title)}</strong> at ${money(painting.price)}?</p><p class="fine">No payment is collected. The painting becomes unavailable to other customers. You can cancel the order in My activity.</p><button class="button dark" data-confirm-buy="${painting.id}">Place order ↗</button><p class="form-error" id="detail-error" role="alert"></p>`);return;
  }
  if(button.dataset.confirmBuy){
    button.disabled=true;try{await api('/orders',{method:'POST',body:{painting_id:button.dataset.confirmBuy}});modal.close();toast('Your painting order is placed.');location.href='/profile.html';}catch(error){$('#detail-error').textContent=error.message;if(error.status===409)await loadCatalog();}finally{button.disabled=false;}return;
  }
  if(button.dataset.record){
    const {record,type,action}=button.dataset;
    const verb={cancel:'Cancel',confirmed:'Confirm',accepted:'Accept',declined:'Decline'}[action];
    setModal(`${verb} this ${type==='orders'?'order':type==='bookings'?'booking':'request'}?`,`<p class="detail-copy">${action==='cancel'?'This action cancels the record. A cancelled painting or wall date becomes available again.':'The customer will see the updated status in their account.'}</p><button class="button dark" data-confirm-record="${record}" data-type="${type}" data-action="${action}">Yes, ${verb.toLowerCase()}</button><p class="form-error" id="detail-error" role="alert"></p>`);return;
  }
  if(button.dataset.confirmRecord){
    button.disabled=true;try{await api(`/${button.dataset.type}/${button.dataset.confirmRecord}`,{method:'PATCH',body:{action:button.dataset.action}});modal.close();toast('Status updated.');await refresh();}catch(error){$('#detail-error').textContent=error.message;}finally{button.disabled=false;}
  }
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!(form instanceof HTMLFormElement))return;event.preventDefault();
  const button=form.querySelector('button[type=submit]'),errorEl=form.querySelector('.form-error'),b=Object.fromEntries(new FormData(form));errorEl.textContent='';button.disabled=true;const original=button.textContent;button.textContent='Please wait…';
  try{
    if(form.id==='auth-form'){
      const data=await api('/'+form.dataset.mode,{method:'POST',body:b});modal.close();toast(`Welcome, ${data.user.name}.`);await afterLogin(data.user);if(studio()&&!profilePage)location.href='/profile.html';else if(homePage)location.href='/collection.html';
    }else if(form.id==='wall-form'){
      await api('/bookings',{method:'POST',body:{...b,size:Number(b.size)}});toast('Wall booking requested. The studio will review it.');await refresh();if(!profilePage)location.href='/profile.html';
    }else if(form.id==='pottery-form'||form.id==='edit-pottery-form'){
      const editing=form.id==='edit-pottery-form';await api('/pottery'+(editing?'/'+form.dataset.id:''),{method:editing?'PATCH':'POST',body:{...b,quantity:Number(b.quantity),...(editing?{action:'edit'}:{})}});if(editing)modal.close();toast(editing?'Pottery request updated.':'Pottery request sent to the studio.');await refresh();if(!profilePage)location.href='/profile.html';
    }else if(form.id==='painting-form'){
      const id=form.dataset.id;await api('/paintings'+(id?'/'+id:''),{method:id?'PATCH':'POST',body:{...b,price:Number(b.price)}});modal.close();toast('Painting saved.');await refresh();location.hash='gallery';
    }
  }catch(error){errorEl.textContent=error.message;if(error.status===409&&form.id==='wall-form'){const c=await api('/catalog').catch(()=>null);if(c)state.catalog=c;} }
  finally{button.disabled=false;button.textContent=original;}
});
async function start(){renderAccount();renderGallery();renderForms();try{const data=await api('/me');await afterLogin(data.user);}catch(error){if(error.status!==401)toast(error.message);}}
if(!profilePage&&location.hash==='#dashboard')location.replace('/profile.html');else start();
