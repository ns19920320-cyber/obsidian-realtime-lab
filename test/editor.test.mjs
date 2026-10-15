import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {EditorState} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {yCollab,yUndoManagerKeymap} from 'y-codemirror.next';
import * as Y from 'yjs';
const dom=new JSDOM('<!doctype html><body></body>',{pretendToBeVisual:true});
for(const key of ['window','document','MutationObserver','HTMLElement','Node','Window'])globalThis[key]=dom.window[key];
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame.bind(dom.window);
function pair(t){const a=new Y.Doc(),b=new Y.Doc();a.getText('content').insert(0,'初始');Y.applyUpdate(b,Y.encodeStateAsUpdate(a));const outgoingA=[],outgoingB=[];a.on('update',(u,o)=>{if(o!=='remote')outgoingA.push(u);});b.on('update',(u,o)=>{if(o!=='remote')outgoingB.push(u);});const undoA=new Y.UndoManager(a.getText('content'));
 const av=new EditorView({state:EditorState.create({doc:'初始',extensions:[yCollab(a.getText('content'),null,{undoManager:undoA})]}),parent:document.body});const bv=new EditorView({state:EditorState.create({doc:'初始',extensions:[yCollab(b.getText('content'),null)]}),parent:document.body});t.after(()=>{av.destroy();bv.destroy();a.destroy();b.destroy();});return{a,b,av,bv,undoA,flush(){for(const u of outgoingA.splice(0))Y.applyUpdate(b,u,'remote');for(const u of outgoingB.splice(0))Y.applyUpdate(a,u,'remote');}};}
test('actual CodeMirror bindings merge simultaneous editor transactions',t=>{const p=pair(t);p.av.dispatch({changes:{from:1,insert:'手机'}});p.bv.dispatch({changes:{from:1,insert:'电脑'}});p.flush();assert.equal(p.av.state.doc.toString(),p.bv.state.doc.toString());assert.match(p.av.state.doc.toString(),/手机/);assert.match(p.av.state.doc.toString(),/电脑/);});
test('remote insertion maps laptop cursor instead of resetting it',t=>{const p=pair(t);p.bv.dispatch({selection:{anchor:2}});p.av.dispatch({changes:{from:0,insert:'字'}});p.flush();assert.equal(p.bv.state.selection.main.head,3);assert.equal(p.bv.state.doc.toString(),'字初始');});
test('local undo preserves the other device input',t=>{const p=pair(t);p.av.dispatch({changes:{from:0,insert:'甲'}});p.flush();p.bv.dispatch({changes:{from:p.bv.state.doc.length,insert:'乙'}});p.flush();p.undoA.undo();p.flush();assert.equal(p.av.state.doc.toString(),'初始乙');assert.equal(p.bv.state.doc.toString(),'初始乙');});
test('Chinese composition-style incremental replacements reach the other editor',t=>{const p=pair(t);p.av.dispatch({changes:{from:2,insert:'n'},userEvent:'input.type.compose'});p.av.dispatch({changes:{from:2,to:3,insert:'ni'},userEvent:'input.type.compose'});p.av.dispatch({changes:{from:2,to:4,insert:'你'},userEvent:'input.type.compose'});p.flush();assert.equal(p.bv.state.doc.toString(),'初始你');});
