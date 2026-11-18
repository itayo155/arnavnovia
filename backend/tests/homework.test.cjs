const test=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes,scryptSync,createHash}=require('node:crypto');
const express=require('express');
const {Access,HomeworkStore,seal,unseal}=require('../dist/homework/core');
const {homeworkRouter}=require('../dist/homework/router');

const salt=randomBytes(16),password='fake-test-password',key=scryptSync(password,salt,32);
const config={username:'fake-user',salt:salt.toString('base64'),verifier:createHash('sha256').update(key).digest('hex')};
const authorization='Basic '+Buffer.from('fake-user:'+password).toString('base64');
const fixture=()=>({tasks:[{id:'a'.repeat(24),child_id:'fake-child',child:'ילד',subject:'חשבון',teacher:'מורה',lesson_date:'2026-11-18',lesson_hour:'2',body:'FAKE PRIVATE HOMEWORK',files:[{fileName:'sheet.pdf',fileUrl:'https://example.test/old-token'}],done:false,revised:0}],sync:{state:'ok',last_success:'2026-11-18T10:00:00Z'}});
class Memory {
 value=null;
 async read(){return this.value?structuredClone(this.value):null;}
 async write(expected,document){
  if((this.value?.version||0)!==expected)return false;
  this.value={version:expected+1,document:structuredClone(document)};return true;
 }
}

test('authentication fails closed and encryption hides homework and detects tampering',()=>{
 const access=new Access(config);
 for(const header of [undefined,'Bearer anything','Basic '+Buffer.from('fake-user:wrong').toString('base64'),'Basic invalid'])assert.equal(access.authenticate(header),null);
 assert.deepEqual(access.authenticate(authorization),key);
 const encrypted=seal(fixture(),key);
 assert.equal(JSON.stringify(encrypted).includes('PRIVATE'),false);
 assert.deepEqual(unseal(encrypted,key),fixture());
 assert.throws(()=>unseal(encrypted,randomBytes(32)));
 encrypted.tag=randomBytes(16).toString('base64');assert.throws(()=>unseal(encrypted,key));
});

test('collector updates preserve shared completion and renewed attachment URLs',async()=>{
 const store=new HomeworkStore(new Memory());
 await store.ingest(key,fixture());
 await store.complete(key,'a'.repeat(24),true);
 const incoming=fixture();incoming.tasks[0].files[0].fileUrl='https://example.test/new-token';
 await store.ingest(key,incoming);
 assert.equal((await store.snapshot(key)).tasks[0].done,true);
 incoming.tasks[0].body='FAKE EDITED HOMEWORK';await store.ingest(key,incoming);
 const task=(await store.snapshot(key)).tasks[0];assert.equal(task.done,false);assert.equal(task.revised,1);
});

test('optimistic persistence preserves concurrent completion and source updates',async()=>{
 const store=new HomeworkStore(new Memory());await store.ingest(key,fixture());
 const incoming=fixture();incoming.tasks.push({...incoming.tasks[0],id:'b'.repeat(24),body:'SECOND FAKE TASK'});
 await Promise.all([store.complete(key,'a'.repeat(24),true),store.ingest(key,incoming)]);
 const snapshot=await store.snapshot(key);assert.equal(snapshot.tasks.length,2);assert.equal(snapshot.tasks.find(t=>t.id==='a'.repeat(24)).done,true);
 const older=fixture();older.sync.last_success='2026-11-17T00:00:00Z';older.tasks[0].body='OLD';
 await store.ingest(key,older);assert.equal((await store.snapshot(key)).tasks[0].body,'FAKE PRIVATE HOMEWORK');
});

test('all hosted resources require Basic auth; source updates and completion work through HTTP',async()=>{
 const app=express();app.use('/homework',homeworkRouter(config,new Memory()));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base=`http://127.0.0.1:${server.address().port}/homework`;
 try{
  for(const path of ['', '/index.html','/app.js','/style.css','/api/tasks','/export.csv','/api/ingest','/api/complete']){
   const response=await fetch(base+path,{method:path==='/api/ingest'?'POST':'GET'});
   assert.equal(response.status,401,path);assert.match(response.headers.get('www-authenticate'),/^Basic /);
   assert.match(response.headers.get('cache-control'),/no-store/);
  }
  const headers={Authorization:authorization,'Content-Type':'application/json'};
  assert.equal((await fetch(base+'/api/ingest',{method:'POST',headers,body:JSON.stringify(fixture())})).status,200);
  const page=await fetch(base,{headers});assert.equal(page.status,200);assert.equal((await page.text()).includes('sync-button'),false);
  assert.equal((await fetch(base+'/api/complete',{method:'POST',headers:{...headers,Origin:'https://evil.test'},body:JSON.stringify({id:'a'.repeat(24),done:true})})).status,403);
  assert.equal((await fetch(base+'/api/complete',{method:'POST',headers:{...headers,Origin:'https://arnavnovia.com'},body:JSON.stringify({id:'a'.repeat(24),done:true})})).status,200);
  const snapshot=await (await fetch(base+'/api/tasks',{headers})).json();assert.equal(snapshot.tasks[0].done,true);
  assert.equal((await fetch(base+'/api/sync',{method:'POST',headers,body:'{}'})).status,404);
  const bad=await fetch(base+'/api/ingest',{method:'POST',headers,body:'{'});assert.equal(bad.status,400);assert.deepEqual(await bad.json(),{error:'Invalid request'});
 }finally{await new Promise(r=>server.close(r));}
});
