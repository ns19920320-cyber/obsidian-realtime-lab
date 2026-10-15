export function parsePairing(params){
 let url;try{url=new URL(params.url);}catch{throw Error('Invalid connection URL');}
 if(!['ws:','wss:'].includes(url.protocol)||!url.hostname||url.username||url.password||url.hash||url.search)throw Error('Invalid connection URL');
 if(typeof params.token!=='string'||params.token.length<32||params.token.length>512)throw Error('Invalid pairing token');
 return {url:url.toString(),token:params.token};
}
