import express, {Request,Response,NextFunction} from 'express';
import path from 'path';
import {Access,HomeworkStore,Persistence,reconcileStudent} from './core';

export function homeworkRouter(config:{username:string;salt:string;verifier:string},persistence:Persistence) {
  const router=express.Router(), access=new Access(config), store=new HomeworkStore(persistence);
  router.use((req:Request,res:Response,next:NextFunction)=>{
    res.set({'Cache-Control':'private, no-store','Vary':'Authorization','X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});
    const key=access.authenticate(req.get('Authorization'));
    if (!key) {res.set('WWW-Authenticate','Basic realm="Homework", charset="UTF-8"');res.status(401).send('Authentication required');return;}
    res.locals.homeworkKey=key;
    next();
  });
  router.use(express.json({limit:'1mb'}));
  const route=(handler:(req:Request,res:Response)=>Promise<void>)=>(req:Request,res:Response)=>{
    handler(req,res).catch(error=>res.status(503).json({error:'Homework is temporarily unavailable. Please try again.',
      ...(error?.name==='HomeworkStorageError'?{code:'STORAGE_UNAVAILABLE',step:error.step,database_code:error.databaseCode,database_host:error.databaseHost}:{})}));
  };
  router.get('/api/tasks',route(async(_req,res)=>{res.json(await store.snapshot(res.locals.homeworkKey));}));
  router.post(['/api/complete','/api/ingest','/api/reconcile-student'],(req,res,next)=>{
    if (!req.is('application/json')) {res.status(415).json({error:'Expected JSON'});return;}
    const origin=req.get('Origin');
    if (origin && !['https://arnavnovia.com','https://api.arnavnovia.com','http://127.0.0.1:8765'].includes(origin)) {
      res.status(403).json({error:'Invalid origin'});return;
    }
    next();
  });
  router.post('/api/ingest',route(async(req,res)=>{
    try {const snapshot=await store.ingest(res.locals.homeworkKey,req.body);res.json({ok:true,tasks:snapshot.tasks.length,last_success:snapshot.sync.last_success});}
    catch(error) {if ((error as Error).message.startsWith('Invalid')) {res.status(400).json({error:'Invalid homework snapshot'});return;}throw error;}
  }));
  router.post('/api/complete',route(async(req,res)=>{
    if (typeof req.body?.id!=='string' || !/^[a-f0-9]{24}$/.test(req.body.id) || typeof req.body.done!=='boolean') {
      res.status(400).json({error:'Expected task id and done'});return;
    }
    const ok=await store.complete(res.locals.homeworkKey,req.body.id,req.body.done);
    res.status(ok?200:404).json({ok});
  }));
  router.post('/api/reconcile-student',route(async(req,res)=>{
    const {canonical,aliases}=req.body||{};
    if(typeof canonical!=='string'||!/^[a-f0-9]{64}$/.test(canonical)||!Array.isArray(aliases)||aliases.length>10||aliases.some(x=>typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x))){
      res.status(400).json({error:'Expected verified student aliases'});return;
    }
    const snapshot=await store.change(res.locals.homeworkKey,value=>reconcileStudent(value,canonical,aliases));
    res.json({ok:true,tasks:snapshot.tasks.length});
  }));
  router.get('/export.csv',route(async(_req,res)=>{
    const snapshot=await store.snapshot(res.locals.homeworkKey);
    const quote=(value:any)=>{
      let text=String(value??'');if (/^\s*[=+@-]/.test(text)) text="'"+text;
      return '"'+text.replace(/"/g,'""')+'"';
    };
    const rows=[['Child','Subject','Lesson date','Teacher','Homework','Done'],...snapshot.tasks.map(t=>[t.child,t.subject,t.lesson_date,t.teacher,t.body,t.done?'Yes':'No'])];
    res.type('text/csv; charset=utf-8').attachment('homework.csv').send('\ufeff'+rows.map(row=>row.map(quote).join(',')).join('\r\n'));
  }));
  const ui=path.resolve(__dirname,'../../homework-ui');
  router.get(['/','/index.html'],(_req,res)=>res.sendFile(path.join(ui,'index.html')));
  for (const file of ['app.js','style.css']) router.get('/'+file,(_req,res)=>res.sendFile(path.join(ui,file)));
  router.use((error:any,_req:Request,res:Response,_next:NextFunction)=>{
    res.status(error?.status===413?413:400).json({error:'Invalid request'});
  });
  router.use((_req,res)=>res.status(404).json({error:'Not found'}));
  return router;
}
