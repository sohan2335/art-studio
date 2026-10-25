import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {createStudio,today,daysAway} from '../server.js';
const future=n=>{const d=new Date(today()+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};

test('Dates use calendar days and reject impossible dates',()=>{
  assert.equal(daysAway('2026-11-01','2026-10-31'),1);
  assert.ok(Number.isNaN(daysAway('2026-02-30')));
  assert.ok(Number.isNaN(daysAway('tomorrow')));
});

test('Full assignment lifecycle, permissions, conflicts and boundary conditions',async t=>{
  const adminPassword=randomBytes(18).toString('base64url');
  const app=createStudio({dbPath:':memory:',studioPassword:adminPassword});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const base=`http://127.0.0.1:${app.server.address().port}`;
  t.after(async()=>{await new Promise(r=>app.server.close(r));app.db.close();});
  const agent=()=>({cookie:''});const alice=agent(),bob=agent(),admin=agent(),guest=agent();
  async function req(who,path,method='GET',body,extra={}){
    const response=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json',Cookie:who.cookie,...extra},body:body===undefined?undefined:JSON.stringify(body)});
    if(response.headers.get('set-cookie'))who.cookie=response.headers.get('set-cookie').split(';')[0];
    return {status:response.status,data:await response.json()};
  }
  const register=(a,name,email)=>req(a,'/register','POST',{name,email,password:'Testpass123!'});
  await t.test('Unauthenticated requests, validation and role escalation',async()=>{
    assert.equal((await req(guest,'/catalog')).status,401);
    assert.equal((await req(guest,'/orders','POST',{painting_id:'p-001'})).status,401);
    assert.equal((await req(guest,'/register','POST',{name:'X',email:'bad',password:'123'})).status,400);
    assert.equal((await req(guest,'/register','POST',{name:'Hacker',email:'h@x.com',password:'password',role:'studio'})).status,403);
    assert.equal((await register(alice,'Alice','alice@example.com')).status,200);
    assert.equal((await register(bob,'Bob','bob@example.com')).status,200);
    assert.equal((await register(guest,'Duplicate','ALICE@example.com')).status,409);
    assert.equal((await req(admin,'/login','POST',{email:'studio@artstudio.in',password:'wrong'})).status,401);
    assert.equal((await req(admin,'/login','POST',{email:'studio@artstudio.in',password:adminPassword})).data.user.role,'studio');
    assert.equal((await req(alice,'/me')).data.user.name,'Alice');
    assert.equal((await req(alice,'/bookings','POST',{},{Origin:'https://another-site.example'})).status,403);
    const catalog=(await req(alice,'/catalog')).data;
    assert.equal(catalog.paintings.length,12);assert.equal(catalog.rate,150);assert.equal(catalog.potteryItems.length,5);assert.equal(catalog.glazes.length,6);
    assert.equal(JSON.stringify(catalog).includes(adminPassword),false);
  });
  let order,booking,pottery;
  await t.test('Painting purchase race, ownership and cancellation release',async()=>{
    const results=await Promise.all([req(alice,'/orders','POST',{painting_id:'p-001'}),req(bob,'/orders','POST',{painting_id:'p-001'})]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
    const owner=results[0].status===200?alice:bob,other=owner===alice?bob:alice;
    order=results.find(x=>x.status===200).data.id;
    assert.equal((await req(other,'/orders/'+order)).status,404);
    assert.equal((await req(other,'/orders/'+order,'PATCH',{action:'cancel'})).status,404);
    assert.equal((await req(admin,'/orders/'+order,'PATCH',{action:'cancel'})).status,403);
    assert.equal((await req(owner,'/orders/'+order,'PATCH',{action:'cancel'})).status,200);
    assert.equal((await req(owner,'/orders/'+order,'PATCH',{action:'cancel'})).status,409);
    assert.equal((await req(other,'/orders','POST',{painting_id:'p-001'})).status,200);
    assert.equal((await req(admin,'/orders','POST',{painting_id:'p-002'})).status,403);
    assert.equal((await req(alice,'/orders','POST',{painting_id:'p-004'})).status,409);
  });
  await t.test('Studio manages available paintings only',async()=>{
    const painting={title:'Test painting',artist:'Test artist',description:'Test description',price:500,imageUrl:'/images/p-002.jpg'};
    assert.equal((await req(alice,'/paintings','POST',painting)).status,403);
    assert.equal((await req(admin,'/paintings','POST',{...painting,price:0})).status,400);
    assert.equal((await req(admin,'/paintings','POST',{...painting,imageUrl:'https://unsafe.example/a.jpg'})).status,400);
    const added=await req(admin,'/paintings','POST',painting);assert.equal(added.status,200);
    assert.equal((await req(admin,'/paintings/'+added.data.id,'PATCH',{...painting,title:'Edited painting'})).status,200);
    await req(alice,'/orders','POST',{painting_id:added.data.id});
    assert.equal((await req(admin,'/paintings/'+added.data.id,'PATCH',painting)).status,409);
  });
  await t.test('Wall size/date boundaries, unique active date and snapshot price',async()=>{
    const b={date:future(7),size:10,address:'123 Test Street, Hyderabad'};
    assert.equal((await req(admin,'/bookings','POST',b)).status,403);
    for(const value of [9,501,10.5])assert.equal((await req(alice,'/bookings','POST',{...b,size:value})).status,400);
    for(const date of [future(6),future(91),'2026-02-30'])assert.equal((await req(alice,'/bookings','POST',{...b,date})).status,400);
    const results=await Promise.all([req(alice,'/bookings','POST',b),req(bob,'/bookings','POST',b)]);
    assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
    booking=results.find(x=>x.status===200).data.id;
    const owner=results[0].status===200?alice:bob,other=owner===alice?bob:alice;
    assert.equal((await req(owner,'/bookings/'+booking)).data.record.price,1500);
    assert.equal((await req(other,'/bookings/'+booking)).status,404);
    assert.equal((await req(other,'/bookings/'+booking,'PATCH',{action:'cancel'})).status,404);
    assert.equal((await req(admin,'/bookings/'+booking,'PATCH',{action:'cancel'})).status,403);
    assert.equal((await req(owner,'/bookings/'+booking,'PATCH',{action:'confirmed'})).status,403);
    assert.equal((await req(admin,'/bookings/'+booking,'PATCH',{action:'confirmed'})).status,200);
    assert.equal((await req(admin,'/bookings/'+booking,'PATCH',{action:'declined'})).status,409);
    assert.equal((await req(owner,'/bookings/'+booking,'PATCH',{action:'cancel'})).status,200);
    const next=await req(alice,'/bookings','POST',b);assert.equal(next.status,200);
    assert.equal((await req(admin,'/bookings/'+next.data.id,'PATCH',{action:'declined'})).status,200);
    assert.equal((await req(bob,'/bookings','POST',b)).status,200);
    assert.equal((await req(alice,'/bookings','POST',{...b,date:future(90),size:500})).status,200);
    const edge=await req(alice,'/bookings','POST',{...b,date:future(20)});
    app.db.prepare('UPDATE bookings SET date=? WHERE id=?').run(future(2),edge.data.id);
    assert.equal((await req(alice,'/bookings/'+edge.data.id,'PATCH',{action:'cancel'})).status,409);
    app.db.prepare('UPDATE bookings SET date=? WHERE id=?').run(future(3),edge.data.id);
    assert.equal((await req(alice,'/bookings/'+edge.data.id,'PATCH',{action:'cancel'})).status,200);
  });
  await t.test('Pottery validation, edits, ownership and final-state restrictions',async()=>{
    const b={item_id:'i-01',glaze_id:'g-01',quantity:1,needed_by:future(14)};
    assert.equal((await req(admin,'/pottery','POST',b)).status,403);
    for(const patch of [{quantity:0},{quantity:13},{quantity:1.5},{item_id:'bad'},{glaze_id:'bad'},{needed_by:future(13)}])assert.equal((await req(alice,'/pottery','POST',{...b,...patch})).status,400);
    pottery=(await req(alice,'/pottery','POST',b)).data.id;
    assert.equal((await req(bob,'/pottery/'+pottery)).status,404);
    assert.equal((await req(admin,'/pottery/'+pottery,'PATCH',{action:'cancel'})).status,403);
    assert.equal((await req(alice,'/pottery/'+pottery,'PATCH',{action:'accepted'})).status,403);
    assert.equal((await req(bob,'/pottery/'+pottery,'PATCH',{action:'edit',...b})).status,404);
    assert.equal((await req(alice,'/pottery/'+pottery,'PATCH',{action:'edit',...b,quantity:12})).status,200);
    assert.equal((await req(admin,'/pottery/'+pottery,'PATCH',{action:'accepted'})).status,200);
    assert.equal((await req(alice,'/pottery/'+pottery,'PATCH',{action:'cancel'})).status,409);
    assert.equal((await req(alice,'/pottery/'+pottery,'PATCH',{action:'edit',...b})).status,409);
    assert.equal((await req(admin,'/pottery/'+pottery,'PATCH',{action:'declined'})).status,409);
    const cancelled=(await req(bob,'/pottery','POST',b)).data.id;
    assert.equal((await req(bob,'/pottery/'+cancelled,'PATCH',{action:'cancel'})).status,200);
    const declined=(await req(bob,'/pottery','POST',b)).data.id;
    assert.equal((await req(admin,'/pottery/'+declined,'PATCH',{action:'declined'})).status,200);
  });
  await t.test('Private dashboards, password hashes and logout',async()=>{
    const a=(await req(alice,'/dashboard')).data,b=(await req(bob,'/dashboard')).data,all=(await req(admin,'/dashboard')).data;
    const aid=(await req(alice,'/me')).data.user.id;
    for(const list of Object.values(a).filter(Array.isArray))assert.ok(list.every(x=>x.user_id===aid));
    assert.equal(all.orders.length,a.orders.length+b.orders.length);
    assert.ok(all.orders.length>0);assert.equal(JSON.stringify(all).includes('password'),false);
    const hash=app.db.prepare("SELECT password FROM users WHERE email='alice@example.com'").get().password;assert.notEqual(hash,'Testpass123!');assert.ok(hash.includes(':'));
    assert.equal((await req(alice,'/logout','POST',{})).status,200);
    assert.equal((await req(alice,'/me')).status,401);
  });
});
