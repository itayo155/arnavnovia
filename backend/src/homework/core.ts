import {createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual} from 'crypto';

export type Task = {[key:string]:any; id:string; body:string; files:any[]; done:boolean};
export type Snapshot = {tasks:Task[]; sync:{[key:string]:any}};
export type Envelope = {iv:string; tag:string; ciphertext:string};
export interface Persistence {
  read(proof:string):Promise<{version:number; document:Envelope}|null>;
  write(expected:number, document:Envelope,proof:string):Promise<boolean>;
}

export class Access {
  constructor(private config:{username:string; salt:string; verifier:string}) {}
  authenticate(header:string|undefined):Buffer|null {
    try {
      if (!header?.startsWith('Basic ') || header.length>2048) return null;
      const decoded=Buffer.from(header.slice(6),'base64').toString('utf8');
      const colon=decoded.indexOf(':');
      if (decoded.slice(0,colon)!==this.config.username || colon<0) return null;
      const key=scryptSync(decoded.slice(colon+1),Buffer.from(this.config.salt,'base64'),32);
      const actual=createHash('sha256').update(key).digest();
      const expected=Buffer.from(this.config.verifier,'hex');
      return expected.length===actual.length && timingSafeEqual(actual,expected) ? key : null;
    } catch {return null;}
  }
}

export function seal(value:Snapshot,key:Buffer):Envelope {
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from('webtop-homework:v1'));
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return {iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')};
}
export function unseal(value:Envelope,key:Buffer):Snapshot {
  const cipher=createDecipheriv('aes-256-gcm',key,Buffer.from(value.iv,'base64'));
  cipher.setAAD(Buffer.from('webtop-homework:v1'));
  cipher.setAuthTag(Buffer.from(value.tag,'base64'));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(value.ciphertext,'base64')),cipher.final()]).toString('utf8'));
}

function fileSignature(files:any[]):string {
  return JSON.stringify(files.map(f=>[f.fileName,f.fileExtantion,f.fileSize?.size,f.fileSize?.sizeName,f.fileSize?.sizeType]).sort());
}
export function reconcileStudent(snapshot:Snapshot,canonical:string,aliases:string[]):Snapshot {
  const ids=new Set([canonical,...aliases]),groups=new Map<string,Task[]>(),untouched:Task[]=[];
  const ordered=[...snapshot.tasks].sort((a,b)=>String(a.first_seen||'').localeCompare(String(b.first_seen||''))||a.id.localeCompare(b.id));
  for(const task of ordered){
    if(!ids.has(task.child_id)){untouched.push(task);continue;}
    const key=JSON.stringify([task.subject,task.lesson_date,task.lesson_hour]);
    const group=groups.get(key)||[];group.push(task);groups.set(key,group);
  }
  for(const group of groups.values()){
    const original=group[0],latest=[...group].sort((a,b)=>String(b.last_seen||'').localeCompare(String(a.last_seen||''))||String(b.first_seen||'').localeCompare(String(a.first_seen||''))||b.id.localeCompare(a.id))[0];
    const signature=fileSignature(latest.files),matching=group.filter(t=>t.body===latest.body&&fileSignature(t.files)===signature);
    const completed=matching.filter(t=>t.done),done=completed.length>0;
    const changed=original.body!==latest.body||fileSignature(original.files)!==signature;
    const completedAt=completed.map(t=>String(t.completed_at||'')).sort().pop()||null;
    untouched.push({...latest,id:original.id,child_id:canonical,first_seen:original.first_seen,done,completed_at:completedAt,
      revised:done?0:changed?1:Math.max(...matching.map(t=>Number(t.revised)||0))});
  }
  return {...snapshot,tasks:untouched.sort((a,b)=>String(b.lesson_date).localeCompare(String(a.lesson_date))||String(a.subject).localeCompare(String(b.subject)))};
}
export function validateSnapshot(input:any):Snapshot {
  if (!input || !Array.isArray(input.tasks) || input.tasks.length>1000 || !input.sync || typeof input.sync!=='object') throw new Error('Invalid snapshot');
  if (input.sync.last_success && (typeof input.sync.last_success!=='string' || !Number.isFinite(Date.parse(input.sync.last_success)))) throw new Error('Invalid date');
  for (const task of input.tasks) {
    if (!task || !/^[a-f0-9]{24}$/.test(task.id) || !Array.isArray(task.files) || task.files.length>50 || typeof task.done!=='boolean') throw new Error('Invalid task');
    for (const field of ['child_id','child','subject','teacher','lesson_date','lesson_hour','body']) {
      if (typeof task[field]!=='string' || task[field].length>50000) throw new Error('Invalid field');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(task.lesson_date)) throw new Error('Invalid date');
  }
  return input;
}
export function mergeSnapshot(previous:Snapshot,incoming:Snapshot):Snapshot {
  if ((previous.sync.last_success||'')>(incoming.sync.last_success||'')) return previous;
  const tasks=new Map(previous.tasks.map(t=>[t.id,t]));
  for (const task of incoming.tasks) {
    const old=tasks.get(task.id);
    if (!old) {tasks.set(task.id,task);continue;}
    const changed=old.body!==task.body || fileSignature(old.files)!==fileSignature(task.files);
    tasks.set(task.id,{...task,done:changed?false:old.done,revised:changed?1:old.revised,completed_at:changed?null:old.completed_at});
  }
  return {tasks:[...tasks.values()].sort((a,b)=>String(b.lesson_date).localeCompare(String(a.lesson_date)) || String(a.subject).localeCompare(String(b.subject))),
    sync:{state:incoming.sync.state==='attention'?'attention':'ok',last_success:incoming.sync.last_success||null}};
}

export class HomeworkStore {
  constructor(private persistence:Persistence) {}
  async snapshot(key:Buffer):Promise<Snapshot> {
    const current=await this.persistence.read(createHmac('sha256',key).update('homework-storage-access').digest('hex'));
    return current ? unseal(current.document,key) : {tasks:[],sync:{}};
  }
  async change(key:Buffer, update:(value:Snapshot)=>Snapshot):Promise<Snapshot> {
    const proof=createHmac('sha256',key).update('homework-storage-access').digest('hex');
    for (let i=0;i<8;i++) {
      const current=await this.persistence.read(proof);
      const value=update(current ? unseal(current.document,key) : {tasks:[],sync:{}});
      if (await this.persistence.write(current?.version||0,seal(value,key),proof)) return value;
    }
    throw new Error('Concurrent update; retry');
  }
  async ingest(key:Buffer,incoming:Snapshot):Promise<Snapshot> {
    validateSnapshot(incoming);
    return this.change(key,previous=>mergeSnapshot(previous,incoming));
  }
  async complete(key:Buffer,id:string,done:boolean):Promise<boolean> {
    let found=false;
    await this.change(key,current=>({ ...current,tasks:current.tasks.map(t=>{
      if (t.id!==id) return t;
      found=true;
      return {...t,done,revised:0,completed_at:done?new Date().toISOString():null};
    })}));
    return found;
  }
}
