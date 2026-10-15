export async function isIsolatedVault(vault){
 if(!vault.getName().startsWith('Realtime-Lab-'))return false;
 try{return JSON.parse(await vault.adapter.read('realtime-lab.json')).isolatedLab===true;}catch{return false;}
}
export async function initializeIsolatedVault(vault){
 if(!vault.getName().startsWith('Realtime-Lab-'))throw Error('Not an isolated test vault');
 await vault.adapter.write('realtime-lab.json',JSON.stringify({isolatedLab:true,version:1}));
}
