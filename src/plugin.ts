import {Plugin,PluginSettingTab,Setting,Notice,TFile,MarkdownView,App,Modal} from 'obsidian';
import {Compartment,EditorState,StateEffect} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {yCollab} from 'y-codemirror.next';
import * as Y from 'yjs';
import {LabClient,encode} from './client.mjs';
import {isIsolatedVault,initializeIsolatedVault} from './isolation.mjs';
import {parsePairing} from './pairing.mjs';
const NOTE='实时协作测试.md';
interface Settings {url:string;token:string;state:string;enabled:boolean;}
const defaults:Settings={url:'ws://127.0.0.1:17236',token:'',state:'',enabled:false};
export default class RealtimeLab extends Plugin {
 settings:Settings=defaults;client:LabClient|null=null;status!:HTMLElement;bindings=new Map<EditorView,Compartment>();saveTimer:number|undefined;diskTimer:number|undefined;refreshTimer:number|undefined;diskQueue:Promise<void>=Promise.resolve();active=false;unloaded=false;
 async onload(){this.settings={...defaults,...await this.loadData()};this.status=this.addStatusBarItem();this.status.setText('Realtime Lab：未连接');this.addSettingTab(new LabSettings(this.app,this));
 this.addCommand({id:'initialize',name:'初始化当前独立测试库',callback:()=>void this.initializeLab()});
 this.registerObsidianProtocolHandler('realtime-lab',params=>{void this.importConnection(params);});
 this.addCommand({id:'start',name:'连接独立协作测试',callback:()=>void this.start()});
 this.addCommand({id:'stop',name:'断开协作测试',callback:()=>this.stop()});
 this.addCommand({id:'open-note',name:'打开实时协作测试笔记',callback:()=>void this.openNote()});
 this.registerEvent(this.app.workspace.on('layout-change',()=>this.scheduleRefresh()));
 this.registerDomEvent(document,'visibilitychange',()=>{if(!document.hidden)this.client?.connect();});
 this.app.workspace.onLayoutReady(()=>{if(this.settings.enabled)void this.start();});
 }
 async initializeLab(){
  if(!this.app.vault.getName().startsWith('Realtime-Lab-')){new Notice('请先新建名称以 Realtime-Lab- 开头的独立测试库。现有库不会被修改。');return;}
  if((this.app as App & {plugins?:{enabledPlugins?:Set<string>}}).plugins?.enabledPlugins?.has('obsidian-livesync')){new Notice('请在不启用 LiveSync 的独立测试库操作。');return;}
  try{await initializeIsolatedVault(this.app.vault);}catch{new Notice('测试标记创建失败，请检查库目录权限。');return;}await this.openNote();new Notice('独立测试库已初始化，现在可以配置连接。');
 }
 async importConnection(params:Record<string,string>){
  if(!await this.allowed()){new Notice('请先打开并初始化独立测试库，再导入连接。');return;}
  let pairing:{url:string;token:string};try{pairing=parsePairing(params);}catch{new Notice('配对信息无效，请检查服务器地址和令牌。');return;}const url=new URL(pairing.url);
  const confirm=new Modal(this.app);confirm.titleEl.setText('导入独立测试库连接');confirm.contentEl.createEl('p',{text:'将把本测试笔记连接到 '+url.origin+'。请核对这是自己的服务器。'});
  new Setting(confirm.contentEl).addButton(b=>b.setButtonText('取消').onClick(()=>confirm.close())).addButton(b=>b.setButtonText('确认并连接').setCta().onClick(async()=>{this.stop();if(this.settings.state&&this.settings.url!==pairing.url){const file=this.app.vault.getAbstractFileByPath(NOTE);if(file instanceof TFile)await this.app.vault.create('realtime-lab-before-repair-'+Date.now()+'.md',await this.app.vault.read(file));this.settings.state='';}this.settings.url=pairing.url;this.settings.token=pairing.token;this.settings.enabled=true;await this.saveSettings();confirm.close();await this.start();}));confirm.open();
 }
 async allowed(){return isIsolatedVault(this.app.vault);}
 async openNote(){if(!await this.allowed()){new Notice('仅允许名称以 Realtime-Lab- 开头且含测试标记的独立库。');return;}let file=this.app.vault.getAbstractFileByPath(NOTE);if(!file)file=await this.app.vault.create(NOTE,'# 实时协作测试\n\n');if(file instanceof TFile)await this.app.workspace.getLeaf(false).openFile(file);}
 scheduleRefresh(){if(this.unloaded)return;window.clearTimeout(this.refreshTimer);this.refreshTimer=window.setTimeout(()=>this.refresh(),0);}
 async start(){this.stop();if(!await this.allowed()){new Notice('已阻止：当前不是独立测试库。');return;}
 if(!/^wss?:\/\//.test(this.settings.url)||this.settings.token.length<32){new Notice('请先设置 WebSocket 地址及至少 32 字符的令牌。');return;}
 if((this.app as App & {plugins?:{enabledPlugins?:Set<string>}}).plugins?.enabledPlugins?.has('obsidian-livesync')){new Notice('测试库启用了 LiveSync，请先关闭它再启动本插件。');return;}
 await this.openNote();const file=this.app.vault.getAbstractFileByPath(NOTE);if(!(file instanceof TFile))return;const seed=await this.app.vault.read(file);this.active=true;
 const client=new LabClient({url:this.settings.url,token:this.settings.token,state:this.settings.state||undefined,seed,
 onStatus:(s:string)=>this.status.setText('Realtime Lab：'+s),
 onReady:()=>{this.refresh();this.scheduleDisk();},
 onPersist:(state:string)=>{this.settings.state=state;window.clearTimeout(this.saveTimer);this.saveTimer=window.setTimeout(()=>void this.saveSettings(),200);this.scheduleDisk();}});
 this.client=client;
 // A known CRDT snapshot preserves offline operations. External file edits are deliberately
 // not replayed as full-document replacements: that would erase concurrent remote edits.
 if(this.settings.state&&seed!==client.text.toString()){const backup='realtime-lab-local-backup-'+Date.now()+'.md';await this.app.vault.create(backup,seed);new Notice('文件与同步快照不同，已另存本机副本：'+backup);}
 this.refresh();client.connect();
 }
 refresh(){if(!this.active||!this.client)return;const seen=new Set<EditorView>();for(const leaf of this.app.workspace.getLeavesOfType('markdown')){const view=leaf.view;if(!(view instanceof MarkdownView))continue;
 // Obsidian documents this bridge for editor extensions; CodeMirror packages stay external.
 const cm=(view.editor as unknown as {cm?:EditorView}).cm;if(!cm)continue;
 if(view.file?.path!==NOTE){if(this.bindings.has(cm)){cm.dispatch({effects:this.bindings.get(cm)!.reconfigure([])});this.bindings.delete(cm);}continue;}
 seen.add(cm);if(this.bindings.has(cm))continue;const compartment=new Compartment();this.bindings.set(cm,compartment);
 const content=this.client.text.toString();if(this.client.ready){cm.dispatch({changes:{from:0,to:cm.state.doc.length,insert:content},effects:StateEffect.appendConfig.of(compartment.of(yCollab(this.client.text,null,{undoManager:new Y.UndoManager(this.client.text)})))});}else{cm.dispatch({effects:StateEffect.appendConfig.of(compartment.of(EditorState.readOnly.of(true)))});}
 }
 // Replace initial read-only guards with CRDT bindings exactly once after handshake.
 if(this.client.ready)for(const cm of seen){if(cm.state.facet(EditorState.readOnly)){const c=this.bindings.get(cm)!;cm.dispatch({changes:{from:0,to:cm.state.doc.length,insert:this.client.text.toString()},effects:c.reconfigure(yCollab(this.client.text,null,{undoManager:new Y.UndoManager(this.client.text)}))});}}
 for(const [cm,c] of this.bindings)if(!seen.has(cm)){try{cm.dispatch({effects:c.reconfigure([])});}catch{}this.bindings.delete(cm);}
 }
 scheduleDisk(){window.clearTimeout(this.diskTimer);this.diskTimer=window.setTimeout(()=>{const client=this.client;if(!client?.ready)return;this.diskQueue=this.diskQueue.then(async()=>{if(this.client!==client||!this.active)return;const open=this.app.workspace.getLeavesOfType('markdown').some(l=>l.view instanceof MarkdownView&&l.view.file?.path===NOTE);if(open)return;const f=this.app.vault.getAbstractFileByPath(NOTE);if(f instanceof TFile&&await this.app.vault.read(f)!==client.text.toString())await this.app.vault.modify(f,client.text.toString());}).catch(()=>{new Notice('测试笔记写入失败，请保留当前内容。');});},300);}
 async saveSettings(){await this.saveData(this.settings);}
 stop(){this.active=false;window.clearTimeout(this.refreshTimer);window.clearTimeout(this.diskTimer);window.clearTimeout(this.saveTimer);if(this.client){this.settings.state=encode(Y.encodeStateAsUpdate(this.client.doc));this.client.close();this.client=null;void this.saveSettings();}for(const [cm,c]of this.bindings){try{cm.dispatch({effects:c.reconfigure([])});}catch{}}this.bindings.clear();this.status?.setText('Realtime Lab：已断开');}
 onunload(){this.unloaded=true;this.stop();}
}
class LabSettings extends PluginSettingTab {constructor(app:App,private plugin:RealtimeLab){super(app,plugin);}display(){const {containerEl}=this;containerEl.empty();containerEl.createEl('h2',{text:'Realtime Lab · 独立测试'});containerEl.createEl('p',{text:'仅同步「实时协作测试.md」。首次连接前暂时只读。请勿在其他同步软件中打开此测试库。令牌保存在本机插件配置中。'});
 new Setting(containerEl).setName('初始化独立测试库').setDesc('仅接受名称以 Realtime-Lab- 开头的库；创建测试标记和测试笔记。').addButton(b=>b.setButtonText('初始化').onClick(()=>void this.plugin.initializeLab()));
 new Setting(containerEl).setName('服务器 WebSocket 地址').addText(t=>t.setValue(this.plugin.settings.url).onChange(async v=>{this.plugin.settings.url=v.trim();await this.plugin.saveSettings();}));
 new Setting(containerEl).setName('访问令牌').addText(t=>{t.inputEl.type='password';t.setValue(this.plugin.settings.token).onChange(async v=>{this.plugin.settings.token=v.trim();await this.plugin.saveSettings();});});
 new Setting(containerEl).setName('打开测试库时自动连接').addToggle(t=>t.setValue(this.plugin.settings.enabled).onChange(async v=>{this.plugin.settings.enabled=v;await this.plugin.saveSettings();}));
 new Setting(containerEl).setName('连接测试').addButton(b=>b.setButtonText('连接并打开测试笔记').onClick(()=>void this.plugin.start()));
 new Setting(containerEl).setName('断开').addButton(b=>b.setButtonText('断开').onClick(()=>this.plugin.stop()));}}
