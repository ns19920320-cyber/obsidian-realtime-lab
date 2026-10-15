import http from 'node:http';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import fs from 'node:fs';
import path from 'node:path';
import { timingSafeEqual,randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ROOM,encode,decode } from './client.mjs';
export async function createServer({dir,token,host='127.0.0.1',port=0}) {
 if(!token||token.length<32)throw Error('Token must contain at least 32 characters');
 fs.mkdirSync(dir,{recursive:true,mode:0o700});const stateFile=path.join(dir,'document.yjs');let exists=fs.existsSync(stateFile);const doc=new Y.Doc();if(exists)Y.applyUpdate(doc,new Uint8Array(fs.readFileSync(stateFile)));const text=doc.getText('content');
 const peers=new Set();let persistCount=0;
 function persist(){const next=stateFile+'.tmp';fs.writeFileSync(next,Y.encodeStateAsUpdate(doc),{mode:0o600});const fd=fs.openSync(next,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(next,stateFile);exists=true;persistCount++;}
 doc.on('update',(u,origin)=>{persist();for(const p of peers)if(p!==origin&&p.readyState===1)p.send(JSON.stringify({type:'update',update:encode(u)}));});
 const server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET'&&req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,peers:peers.size,version:'0.3.0'}));return;}
  res.writeHead(404);res.end();
 });
 const wss=new WebSocketServer({server,maxPayload:2*1024*1024,perMessageDeflate:false});
 wss.on('connection',ws=>{ws.alive=true;ws.on('pong',()=>ws.alive=true);const deadline=setTimeout(()=>ws.close(4401,'Authentication timeout'),5000);
  ws.on('message',raw=>{try{const m=JSON.parse(raw.toString());if(!peers.has(ws)){
    if(m.type!=='hello'||m.room!==ROOM||typeof m.token!=='string'||Buffer.byteLength(m.token)!==Buffer.byteLength(token)||!timingSafeEqual(Buffer.from(m.token),Buffer.from(token))){ws.close(4401,'Unauthorized');return;}
    clearTimeout(deadline);if(!exists){if(typeof m.seed!=='string'||m.seed.length>500000)throw Error('Invalid seed');Y.applyUpdate(doc,decode(m.state),ws);if(text.length===0&&m.seed)doc.transact(()=>text.insert(0,m.seed),ws);persist();}
    const update=Y.encodeStateAsUpdate(doc,decode(m.vector));peers.add(ws);ws.send(JSON.stringify({type:'welcome',update:encode(update),vector:encode(Y.encodeStateVector(doc))}));return;
   }
   if(m.type!=='update'||typeof m.update!=='string')throw Error('Invalid message');Y.applyUpdate(doc,decode(m.update),ws);ws.send(JSON.stringify({type:'ack'}));
  }catch{ws.send(JSON.stringify({type:'error',message:'Invalid message or storage failure'}));ws.close(1011,'Operation failed');}});
  ws.on('close',()=>{clearTimeout(deadline);peers.delete(ws);});ws.on('error',()=>{});
 });
 const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000);heartbeat.unref();
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
 return {port:server.address().port,doc,get persistCount(){return persistCount;},async close(){clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));doc.destroy();}};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const dir=process.env.LAB_DATA_DIR||path.resolve('work/server-data');fs.mkdirSync(dir,{recursive:true,mode:0o700});const tokenFile=path.join(dir,'token');let token=process.env.LAB_TOKEN;if(!token){if(!fs.existsSync(tokenFile))fs.writeFileSync(tokenFile,randomBytes(32).toString('hex'),{mode:0o600});token=fs.readFileSync(tokenFile,'utf8').trim();}
 const s=await createServer({dir,token,host:process.env.LAB_HOST||'127.0.0.1',port:Number(process.env.LAB_PORT||17236)});console.log(`Realtime Lab listening on port ${s.port}; token is stored in ${tokenFile}`);for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>s.close().then(()=>process.exit()));
}
