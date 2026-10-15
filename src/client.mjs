import * as Y from 'yjs';
export const encode = bytes => { let s=''; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s); };
export const decode = s => Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export const ROOM='realtime-lab-v1';
export class LabClient {
  constructor({url,token,WebSocketImpl=globalThis.WebSocket,state,onStatus=(_status)=>{},onReady=()=>{},onPersist=(_state)=>{},seed=''}) {
    this.url=url;this.token=token;this.WS=WebSocketImpl;this.onStatus=onStatus;this.onReady=onReady;this.onPersist=onPersist;this.seed=seed;
    this.doc=new Y.Doc();if(state)Y.applyUpdate(this.doc,decode(state),'restore');this.text=this.doc.getText('content');this.ready=false;this.stopped=false;this.retry=0;this.pending=0;
    this.listener=(u,origin)=>{this.onPersist(encode(Y.encodeStateAsUpdate(this.doc)));if(origin!=='remote'&&this.ready&&this.ws?.readyState===1){this.send({type:'update',update:encode(u)});this.pending++;this.onStatus('同步中');}};
    this.doc.on('update',this.listener);
  }
  send(m){if(this.ws?.readyState===1)this.ws.send(JSON.stringify(m));}
  connect(){
    if(this.stopped||this.ws?.readyState===0||this.ws?.readyState===1)return;
    this.onStatus('连接中'); const ws=new this.WS(this.url);this.ws=ws;
    ws.onopen=()=>{this.send({type:'hello',token:this.token,room:ROOM,vector:encode(Y.encodeStateVector(this.doc)),state:encode(Y.encodeStateAsUpdate(this.doc)),seed:this.seed});};
    ws.onmessage=e=>{try{const m=JSON.parse(e.data.toString());if(m.type==='welcome'){Y.applyUpdate(this.doc,decode(m.update),'remote');this.send({type:'update',update:encode(Y.encodeStateAsUpdate(this.doc,decode(m.vector)))});this.ready=true;this.retry=0;this.onStatus('已连接');this.onReady();}
      else if(m.type==='update')Y.applyUpdate(this.doc,decode(m.update),'remote');else if(m.type==='ack'){this.pending=Math.max(0,this.pending-1);this.onStatus(this.pending?'同步中':'已同步');}else if(m.type==='error'){this.onStatus('错误：'+m.message);}}catch{this.onStatus('协议错误');ws.close();}};
    ws.onerror=()=>this.onStatus('网络错误');
    ws.onclose=e=>{if(this.ws!==ws)return;this.ready=false;this.pending=0;if(this.stopped)return;if(e.code===4401){this.onStatus('认证失败，请检查令牌');return;}this.onStatus('离线，等待重连');this.timer=setTimeout(()=>this.connect(),Math.min(10000,500*2**this.retry++));};
  }
  close(){this.stopped=true;clearTimeout(this.timer);this.ws?.close();this.doc.off('update',this.listener);}
}
