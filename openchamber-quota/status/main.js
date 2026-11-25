(()=>{var E="openchamber.sdk",T=1;var et=`
:root {
  /* Quiet at rest like the app's own thumbs; hover gives a clear grab target. */
  --oc-scrollbar-thumb: color-mix(in srgb, var(--oc-muted, currentColor) 18%, transparent);
  --oc-scrollbar-thumb-hover: color-mix(in srgb, var(--oc-muted, currentColor) 36%, transparent);
  scrollbar-gutter: stable;
}
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
:hover, [data-oc-scrolling] {
  scrollbar-color: var(--oc-scrollbar-thumb) transparent;
}
/* Chromium's standard scrollbar properties otherwise override its pseudo-elements. */
@supports selector(::-webkit-scrollbar) {
  *, :hover, [data-oc-scrolling] { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
    min-width: 24px;
    min-height: 24px;
  }
  :hover::-webkit-scrollbar-thumb, [data-oc-scrolling]::-webkit-scrollbar-thumb { background: var(--oc-scrollbar-thumb); }
  ::-webkit-scrollbar-thumb:hover { background: var(--oc-scrollbar-thumb-hover); }
  ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
}
@media (forced-colors: active) {
  *, :hover, [data-oc-scrolling] { scrollbar-color: auto; }
  ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb:hover { background: CanvasText; }
}
`;function so(e){let r=e.documentElement;if(r.hasAttribute("data-oc-scrollbar-activity"))return;r.setAttribute("data-oc-scrollbar-activity","");let s=new WeakMap;e.addEventListener("scroll",(i)=>{let d=i.target===e?r:i.target;if(!(d instanceof Element))return;if(!d.hasAttribute("data-oc-scrolling"))d.setAttribute("data-oc-scrolling","");let S=s.get(d);if(S!==void 0)clearTimeout(S);s.set(d,setTimeout(()=>{s.delete(d),d.removeAttribute("data-oc-scrolling")},1000))},{capture:!0,passive:!0})}var _r=`(${so.toString()})(document);`;var tt=128,ot=65536;var ge=128;var xe=65536;var rt=8000,nt=192000,st=120000;var io=(e)=>{let r=[],s=0,i=0;return{push:(d)=>{r.push(d),i+=d.length;while(i-s>e&&r.length>1){let S=r.shift();i-=S?.length??0,s=0}},pull:(d)=>{let S=0;while(S<d.length&&r.length>0){let b=r[0],m=Math.min(d.length-S,b.length-s);if(d.set(b.subarray(s,s+m),S),S+=m,s+=m,s>=b.length)r.shift(),i-=b.length,s=0}d.fill(0,S)},clear:()=>{r.length=0,s=0,i=0},get size(){return i-s}}};var uo=/^[a-z][a-z0-9-]{0,39}$/;var ao=(e)=>Object(e)===e&&!Array.isArray(e),it=(e,r)=>Object.keys(e).every((s)=>r.includes(s)),co=(e)=>String(e)===e&&e.length>=1&&e.length<=60,lo=(e)=>String(e)===e&&e.length>=1&&e.length<=80,_o=(e)=>{if(!Array.isArray(e)||e.length>4)return!1;let r=new Set;for(let s of e){if(!ao(s)||!uo.test(s.id)||!co(s.label))return!1;if(s.disabled!==void 0&&s.disabled!==!0&&s.disabled!==!1)return!1;if(r.has(s.id))return!1;if(r.add(s.id),s.kind==="button"){if(!it(s,["kind","id","label","disabled"]))return!1;continue}if(s.kind!=="select"||!it(s,["kind","id","label","value","options","disabled"]))return!1;if(!lo(s.value)||!Array.isArray(s.options)||s.options.length<1||s.options.length>16)return!1;let i=new Set;for(let d of s.options){if(!ao(d)||!it(d,["value","label"])||!lo(d.value)||!co(d.label)||i.has(d.value))return!1;i.add(d.value)}if(!i.has(s.value))return!1}return!0};var po=["{id}","{segment}","{segments+}"];var Zr=new Set(po);var Eo=["turn-finished","turn-failed","permission-asked","question-asked","turn-started","session-created","session-archived","session-deleted"];var tn=new Set(Eo);var be=20000000,Ce=256;var at=(e)=>("bytes"in e)?e.bytes.byteLength:e.content.length,To=(e,r)=>{if(e.path!==r.path||e.readOnly!==r.readOnly)return!1;if(e.encoding==="text"||r.encoding==="text")return e.encoding==="text"&&r.encoding==="text"&&e.content===r.content;if(e.bytes.byteLength!==r.bytes.byteLength)return!1;for(let s=0;s<e.bytes.byteLength;s+=1)if(e.bytes[s]!==r.bytes[s])return!1;return!0};var So=/^[A-Za-z0-9_-]{1,80}$/;var fo=["left","right","top","bottom"];var Ao=(e,r=0,s={remaining:16000})=>{if(--s.remaining<0||r>=32)return!1;if(e===null)return!0;let i=Array.isArray(e)?e:Object(e)===e?Object.values(e):[];for(let d of i)if(!Ao(d,r+1,s))return!1;return!0},ct=(e)=>{if(e===null||e===!0||e===!1)return!0;if(Array.isArray(e))return Object.keys(e).every((r)=>/^(0|[1-9]\d*)$/.test(r)&&Number(r)<e.length)&&e.every(ct);if(Object(e)===e){let r=Object.getPrototypeOf(e);return(r===null||r===Object.prototype)&&Object.values(e).every(ct)}return String(e)===e||Number.isFinite(e)},lt=(e)=>{try{if(String(e.id)!==e.id||!So.test(e.id)||!Number.isFinite(e.anchor.x)||Math.abs(e.anchor.x)>1e5||!Number.isFinite(e.anchor.y)||Math.abs(e.anchor.y)>1e5||!Number.isFinite(e.anchor.width)||!Number.isFinite(e.anchor.height)||e.anchor.width<=0||e.anchor.height<=0||e.anchor.width>1e5||e.anchor.height>1e5||!Number.isInteger(e.width)||e.width<160||e.width>640||!Number.isInteger(e.height)||e.height<48||e.height>480||e.side!==void 0&&!fo.includes(e.side)||e.focus!==void 0&&e.focus!==!0&&e.focus!==!1||!Ao(e.data)||!ct(e.data))return!1;return JSON.stringify(e.data).length<=16000}catch{return!1}};var Oo=/^[0-9a-f]{7,64}$/i,Ro=(e)=>Oo.test(e),dt=255,ho=(e,r,s)=>({openCommit:(i)=>Ro(i)?e({channel:E,v:T,type:"open-commit",id:r(),payload:{sha:i}}):s("Commit id must be 7 to 64 hex characters."),openWalkthrough:({base:i})=>{let d=i.trim();if(!d||d.length>dt)return s(`Base must contain 1 to ${dt} characters.`);return e({channel:E,v:T,type:"open-walkthrough",id:r(),payload:{base:d}})}});var _t=2000;var Io=["file","directory","other","missing"],pt=(e)=>Boolean(e&&"sessionId"in e),Et=(e)=>Boolean(e&&"sent"in e&&!("sessionId"in e));var Ue=500,Me=32000,go=16000,xo=128,bo=200,Co=2000,Uo=16000,Mo=80,ko=200,No=16000;var yo=2000;var Tt=20000,ke=1024,Ne=2000000;var ye=64000,ve=8000,St=4000;var ft=960000;var vo=999,Lo=1e4,_e=500,Po=["HOST_UNAVAILABLE","HOST_TIMEOUT","HOST_REJECTED","DISCONNECTED","DISABLED","BAD_PATH","NO_INTEGRATION","NO_SERVICE","SERVICE_FAILED","REQUEST_FAILED","RESPONSE_TOO_LARGE","NO_SESSION","SESSION_BUSY","NOT_GRANTED","NO_DIRECTORY","NOT_FOUND","FILE_TOO_LARGE","DENIED","NO_MODEL","MODEL_FAILED","UNSUPPORTED"],wo=["stopped","starting","ready","failed"],Er=new Set(Po),Do=(e)=>Er.has(e),Go=(e)=>e&&Do(e)?e:"HOST_REJECTED",te=(e)=>{if(e===void 0)return!1;if(e===null||e===!0||e===!1)return!0;if(String(e)===e)return!0;if(Number(e)===e)return Number.isFinite(e);if(Array.isArray(e))return e.every(te);if(Object(e)===e)return Object.values(e).every(te);return!1},Xo=(e)=>te(e)&&JSON.stringify(e).length<=No,mo=(e)=>e?.trim().slice(0,ko)??"",oe=(e)=>{let r=e.id.trim().slice(0,xo),s=e.title.trim().slice(0,bo),i=e.url.trim().slice(0,Co),d=e.text?.trim().slice(0,Uo),S=e.author?.trim().slice(0,Mo),b=e.kind==="pull"?"pull":"issue",m={providerId:e.providerId.trim(),id:r,title:s||r,url:i,kind:b};if(d)m.text=d;if(S)m.author=S;if(b==="pull"){let w=mo(e.branches?.head),X=mo(e.branches?.base);if(w&&X)m.branches={head:w,base:X}}if(Xo(e.data))m.data=e.data;return m},At=(e)=>{let r=oe(e);if(e.projectId)r.projectId=e.projectId;if(e.navigation)r.navigation=e.navigation;if(e.worktree)r.worktree=e.worktree;return r},Ot=(e)=>{let r={text:e.text.trim().slice(0,go)};if(e.send)r.send=!0;return r},Rt=(e)=>{if(e===null||!Number.isFinite(e))return null;return Math.min(vo,Math.max(0,Math.round(e)))},ht=(e)=>{if(!Number.isFinite(e))return 0;return Math.min(Lo,Math.max(0,Math.ceil(e)))};var re=(e)=>e.length>0&&e.length<=ke&&!e.includes("\x00")&&!e.includes("\\");var Le=(e)=>{if(!e.startsWith("/")||e.includes("\x00")||e.includes("\\")||e.includes("://"))return!1;if(e.length>yo)return!1;return!e.split("/").some((s)=>s==="."||s==="..")},Tr=new Set(wo),mt=(e)=>Boolean(e&&"status"in e&&Tr.has(String(e.status))&&!("body"in e)),Pe=(e)=>Boolean(e&&"status"in e&&"body"in e&&Number.isInteger(e.status)),It=(e)=>Boolean(e&&"content"in e&&String(e.content)===e.content),gt=(e)=>Boolean(e&&"written"in e&&e.written===!0),xt=(e)=>Boolean(e&&"entries"in e&&Array.isArray(e.entries)),Sr=new Set(Io),bt=(e)=>Boolean(e&&"kind"in e&&"size"in e&&Sr.has(String(e.kind))&&Number.isFinite(e.size)),Ct=(e)=>Boolean(e&&"text"in e&&String(e.text)===e.text&&!("status"in e)),fr=new Set(["workspace","shells","ready","directory","session","connection","settings","session-lifecycle","item","resolve","action","service-event","status-control-event","popover-closed","file-open","file-snapshot","file-saved","generate-late","microphone-audio","microphone-ended"]),Ar=(e)=>Object(e)===e?e:null,ut=(e)=>String(e)===e&&e.length>0,Or=(e)=>{if(!ut(e.id))return null;if(e.ok===!0){let r={channel:E,v:T,type:"result",id:e.id,ok:!0};if(Object(e.payload)===e.payload)r.payload=e.payload;return r}if(e.ok===!1&&ut(e.error))return{channel:E,v:T,type:"result",id:e.id,ok:!1,error:e.error,code:Go(ut(e.code)?e.code:void 0)};return null},Ut=(e)=>{let r=Ar(e);if(!r||r.channel!==E||r.v!==T)return null;if(r.type==="result")return Or(r);if(!fr.has(String(r.type))||Object(r.payload)!==r.payload)return null;return r};var Vo=(e)=>("key"in e)&&("metaKey"in e)&&("ctrlKey"in e),Rr=(e)=>(e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==="s";class l extends Error{code;constructor(e,r){super(r);this.name="HostRequestError",this.code=e}}var Ho=()=>Promise.reject(new l("BAD_PATH",'Request path must start with "/" and stay on the declared origin.')),we=()=>Promise.reject(new l("BAD_PATH",`File path must be 1 to ${ke} characters without NUL or backslash.`)),De=(e)=>{if(e===void 0)return;if(Object(e)!==e||Array.isArray(e)||e.scope!==void 0&&e.scope!=="instance"&&e.scope!=="device")throw new l("HOST_REJECTED",'Storage scope must be "instance" or "device".');return e.scope==="device"?"device":void 0},p=(e)=>(e.value+=1,`oc-${e.value}`),Mt=(e={})=>{let r=e.target??("window"in globalThis?window:null);if(!r)throw new l("HOST_UNAVAILABLE","No window. connectHost runs in a browser frame.");let s=e.acceptSource??((t)=>t===r.parent),i=e.requestTimeoutMs??Tt,d=new Set,S=new Set,b=new Set,m=new Set,w=new Set,X=new Set,j=new Set,Te=new Set,Se=new Set,fe=new Set,Ae=new Set,Y=new Set,ze=[],ie=null,ae=null,Oe=new Set,Re=new Set,ce=null,le=null,Qe=!1,J=new Map,q=new Map,Z=new Map,V=!1,_={value:0},u=null,F=null,de=!1,ue=!1,jt=null,L=null,zt=(t)=>{if(!t)return null;return{sessionId:t.id,phase:t.busy?"started":"completed"}},k=(t)=>{r.parent.postMessage(t,"*")},Qt=()=>{if(V||r.parent===r||Y.size===0||u?.features?.lateGenerateResults!==!0)return;k({channel:E,v:T,type:"generate-late-listen"})},O=(t,o)=>{for(let c of t)try{c(o)}catch(a){console.error(a)}},Yt=(t)=>{if(!(t instanceof MessageEvent))return;if(!s(t.source))return;let o=Ut(t.data);if(!o)return;if(o.type==="workspace"){let a=q.get(o.payload.subscriptionId);if(a)O([a],o.payload.snapshot);return}if(o.type==="shells"){let a=Z.get(o.payload.subscriptionId);if(a)O([a],o.payload.snapshot);return}if(o.type==="microphone-audio"){L?.queue.push(o.payload.samples);return}if(o.type==="microphone-ended"){let a=L;if(!a)return;L=null,a.release(),O(a.endedListeners,o.payload.reason);return}if(o.type==="ready"){if(u=o.payload,F=zt(o.payload.session),O(d,o.payload),O(S,o.payload.directory),O(b,o.payload.session),F)O(m,F);if(O(w,o.payload.connection),O(X,o.payload.settings),O(j,o.payload.item),o.payload.block)O(Te,o.payload.block);Qt();return}if(o.type==="service-event"){O(Se,o.payload);return}if(o.type==="generate-late"){if(Y.size===0)ze.push(o.payload);else O(Y,o.payload);return}if(o.type==="directory"){if(u)u={...u,directory:o.payload.directory};O(S,o.payload.directory);return}if(o.type==="session"){if(u)u={...u,session:o.payload.session};if(!o.payload.session)F=null;else if(F?.sessionId!==o.payload.session.id)F=zt(o.payload.session);O(b,o.payload.session);return}if(o.type==="session-lifecycle"){F=o.payload,O(m,o.payload);return}if(o.type==="connection"){if(u)u={...u,connection:o.payload.connection};O(w,o.payload.connection);return}if(o.type==="settings"){if(u)u={...u,settings:o.payload.settings};O(X,o.payload.settings);return}if(o.type==="item"){if(u)u={...u,item:o.payload.item};O(j,o.payload.item);return}if(o.type==="status-control-event"){O(fe,o.payload);return}if(o.type==="popover-closed"){O(Ae,o.payload);return}if(o.type==="action"){let a=(A)=>{if(!V)k({channel:E,v:T,type:"action-result",id:o.id,payload:A})},f=ae;if(!f){a({ok:!1,error:"This extension does not handle background actions."});return}Promise.resolve().then(()=>f(o.payload)).then(()=>a({ok:!0}),(A)=>{let R=(A instanceof Error?A.message:String(A)).trim();a({ok:!1,error:(R||"Action failed.").slice(0,_e)})});return}if(o.type==="file-open"){let a=o.payload;if(le&&To(le,a))return;le=a,O(Oe,o.payload);return}if(o.type==="file-saved"){O(Re,o.payload.version);return}if(o.type==="file-snapshot"){let a=(R)=>{if(!V)k({channel:E,v:T,type:"file-snapshot-result",id:o.id,payload:R})},f=(R)=>a({error:(R.trim()||"Could not read the edited file.").slice(0,_e)}),A=ce;if(!A){f("This extension does not edit files.");return}Promise.resolve().then(()=>A(o.payload.purpose)).then((R)=>{if(at(R)>be){f(`The file is over ${be} ${"bytes"in R?"bytes":"characters"}.`);return}if(R.version.length>Ce){f(`The snapshot version is over ${Ce} characters.`);return}a({snapshot:"bytes"in R?{bytes:R.bytes,version:R.version}:{content:R.content,version:R.version}})},(R)=>f(R instanceof Error?R.message:String(R)));return}if(o.type==="resolve"){let a=(A)=>{k({channel:E,v:T,type:"resolve-result",id:o.id,payload:A})},f=ie;if(!f){a({error:"This extension does not resolve commands."});return}Promise.resolve().then(()=>f(o.payload)).then((A)=>a({item:A?oe(A):null}),(A)=>{let R=(A instanceof Error?A.message:String(A)).trim();a({error:(R||"Command failed.").slice(0,_e)})});return}let c=J.get(o.id);if(!c)return;if(clearTimeout(c.timer),J.delete(o.id),o.ok){c.resolve(o.payload);return}c.reject(new l(o.code,o.error))};r.addEventListener("message",Yt),k({channel:E,v:T,type:"hello"});let U=(t,o=i)=>{if(V||r.parent===r)return Promise.reject(new l("HOST_UNAVAILABLE","No host frame. This page is not in an iframe."));return new Promise((c,a)=>{let f=setTimeout(()=>{J.delete(t.id),a(new l("HOST_TIMEOUT","Host did not answer in time."))},o);J.set(t.id,{resolve:c,reject:a,timer:f}),k(t)})},C=(t)=>U(t).then(()=>{return}),I={channel:E,v:T},Ye=(t)=>{if(!V&&r.parent!==r)k(t)},Jt=()=>Ye({...I,type:"file-save"}),Je=()=>{if(!V&&r.parent!==r)k({...I,type:"microphone-close",id:p(_)})},dr=async()=>{if(L)throw new l("HOST_REJECTED","The microphone is already open in this frame.");if(u?.features?.microphone!==!0)throw new l("UNSUPPORTED","This OpenChamber cannot share the microphone with extensions.");let t=globalThis.AudioContext;if(typeof t!=="function")throw new l("UNSUPPORTED","This frame has no Web Audio.");let o=new t;if(o.sampleRate<rt||o.sampleRate>nt)throw o.close().catch(()=>{return}),new l("UNSUPPORTED",`Audio at ${o.sampleRate} Hz is not supported.`);let c=o.state==="suspended"?o.resume().catch(()=>{return}):void 0,a=io(Math.round(o.sampleRate/4)),f=o.createScriptProcessor(1024,1,1);f.onaudioprocess=(D)=>a.pull(D.outputBuffer.getChannelData(0));let A=o.createMediaStreamDestination();f.connect(A);let R=new Set,ee={queue:a,endedListeners:R,release:()=>{f.onaudioprocess=null,f.disconnect(),a.clear();for(let D of A.stream.getTracks())D.stop();o.close().catch(()=>{return})}};L=ee;try{let D=await U({...I,type:"microphone-open",id:p(_),payload:{sampleRate:o.sampleRate}},st);if(!D||!("opened"in D)||D.opened!==!0)throw new l("HOST_REJECTED","Host did not open the microphone.");if(await c,L!==ee)throw new l("DISCONNECTED","The microphone closed while it was opening.")}catch(D){if(L===ee)L=null;throw ee.release(),Je(),D}return{stream:A.stream,close:()=>{if(L!==ee)return;L=null,ee.release(),Je()},onEnded:(D)=>(R.add(D),()=>{R.delete(D)})}},qt=(t)=>{if(!Vo(t)||!Rr(t))return;t.preventDefault(),Jt()},Zt=(t)=>{if(!Vo(t)||t.key!=="Escape"||u?.surface!=="popover"||!u.popover)return;t.preventDefault(),ro(u.popover.id,"escape").catch(()=>{return})},he=()=>{let t=u?.surface==="popover"?u.popover:void 0;if(!t)return;let o=de||ue;if(jt===o)return;jt=o,no(t.id,o).catch(()=>{return})},me=()=>{if(u?.surface!=="popover"||de)return;de=!0,he()},eo=(t)=>{if(u?.surface!=="popover"||t.relatedTarget!==null||!de)return;de=!1,he()},to=()=>{if(u?.surface!=="popover"||ue)return;ue=!0,he()},oo=()=>{if(u?.surface!=="popover"||!ue)return;ue=!1,he()},H=(t,o=1024)=>{if(!t.trim()||t.length>o)throw new l("HOST_REJECTED",`Identity must contain 1 to ${o} characters.`)},qe=async(t)=>{if(t.kind!=="projects")H(t.projectId);let o=await U({...I,type:"workspace-read",id:p(_),payload:t});if(!o||!("kind"in o)||!("state"in o)||o.kind!==t.kind)throw new l("HOST_REJECTED","Host did not return workspace data.");return o},Ze=async(t,o)=>{if(t.kind!=="projects")H(t.projectId);let c=p(_);q.set(c,o);try{await C({...I,type:"workspace-subscribe",id:p(_),payload:{subscriptionId:c,query:t}})}catch(a){if(q.delete(c),!V)k({...I,type:"workspace-unsubscribe",id:p(_),payload:{subscriptionId:c}});throw a}return()=>{if(!q.delete(c)||V)return;k({...I,type:"workspace-unsubscribe",id:p(_),payload:{subscriptionId:c}})}},ur=async(t,o)=>{if(t.kind==="session")H(t.sessionId);if(t.kind==="project")H(t.projectId);let c=p(_);Z.set(c,o);try{await C({...I,type:"shells-subscribe",id:p(_),payload:{subscriptionId:c,scope:t}})}catch(a){if(Z.delete(c),!V)k({...I,type:"shells-unsubscribe",id:p(_),payload:{subscriptionId:c}});throw a}return()=>{if(!Z.delete(c)||V)return;k({...I,type:"shells-unsubscribe",id:p(_),payload:{subscriptionId:c}})}},Ie=async(t)=>{if("key"in t&&(t.key.length===0||t.key.length>tt))throw new l("HOST_REJECTED","Storage key must contain 1 to 128 characters.");if(t.op==="set"&&!te(t.value))throw new l("HOST_REJECTED","Storage values must be JSON.");if(t.op==="set"&&new TextEncoder().encode(JSON.stringify(t.value)).length>ot)throw new l("HOST_REJECTED","Storage value exceeds 64 KiB.");if(t.scope==="device"&&u?.features?.deviceStorage!==!0)throw new l("UNSUPPORTED","This host does not support device storage.");let o=await U({...I,type:"storage",id:p(_),payload:t});if(!o||!("storage"in o)||o.op!==t.op)throw new l("HOST_REJECTED","Host did not return storage data.");return o},ro=(t,o)=>u?.features?.popovers!==!0&&!(u?.surface==="popover"&&u.popover?.id===t)?Promise.reject(new l("UNSUPPORTED","This host does not support popovers.")):C({...I,type:"popover-close",id:p(_),payload:o?{id:t,reason:o}:{id:t}}),no=(t,o)=>u?.features?.popovers!==!0&&!(u?.surface==="popover"&&u.popover?.id===t)?Promise.reject(new l("UNSUPPORTED","This host does not support popovers.")):C({...I,type:"popover-anchor",id:p(_),payload:{id:t,active:o}});return r.addEventListener("keydown",Zt,!0),r.addEventListener("pointerover",me),r.addEventListener("pointermove",me),r.addEventListener("pointerout",eo),r.addEventListener("focus",to),r.addEventListener("blur",oo),{onAction:(t)=>(ae=t,()=>{if(ae===t)ae=null}),listProjects:async()=>{let t=await qe({kind:"projects"});if(t.kind!=="projects")throw new l("HOST_REJECTED","Expected projects.");return t},listWorktrees:async(t)=>{let o=await qe({kind:"worktrees",projectId:t});if(o.kind!=="worktrees")throw new l("HOST_REJECTED","Expected worktrees.");return o},listSessions:async(t)=>{let o=await qe({kind:"sessions",projectId:t});if(o.kind!=="sessions")throw new l("HOST_REJECTED","Expected sessions.");return o},onProjects:(t)=>Ze({kind:"projects"},(o)=>{if(o.kind==="projects")t(o)}),onWorktrees:(t,o)=>Ze({kind:"worktrees",projectId:t},(c)=>{if(c.kind==="worktrees")o(c)}),onSessions:(t,o)=>Ze({kind:"sessions",projectId:t},(c)=>{if(c.kind==="sessions")o(c)}),onRunningShells:(t,o)=>ur(t,o),readShellOutput:async(t,o)=>{H(t,ge);let c=o?.cursor;if(c!==void 0&&(!Number.isInteger(c)||c<0))throw new l("HOST_REJECTED","Shell output cursor must be a non-negative integer.");let a=o?.tailBytes;if(a!==void 0&&(!Number.isInteger(a)||a<1||a>xe))throw new l("HOST_REJECTED",`Shell output tailBytes must be an integer between 1 and ${xe}.`);let A=await U({...I,type:"shell-output",id:p(_),payload:{shellId:t,cursor:c,tailBytes:a}});if(!A||typeof A.output!=="string"||!Number.isFinite(A.cursor))throw new l("HOST_REJECTED","Host did not return shell output.");return A},stopShell:async(t)=>{if(H(t,ge),(await U({...I,type:"shell-stop",id:p(_),payload:{shellId:t}}))?.stopped!==!0)throw new l("HOST_REJECTED","Host did not stop the shell.");return{stopped:!0}},openSession:async(t)=>{H(t),await C({...I,type:"open-session",id:p(_),payload:{sessionId:t}})},storage:{get:async(t,o)=>{let c=De(o),a={op:"get",key:t};if(c)a.scope=c;let f=await Ie(a);return f.op==="get"&&f.found?f.value:void 0},set:async(t,o,c)=>{let a=De(c),f={op:"set",key:t,value:o};if(a)f.scope=a;await Ie(f)},delete:async(t,o)=>{let c=De(o),a={op:"delete",key:t};if(c)a.scope=c;await Ie(a)},keys:async(t)=>{let o=De(t),c={op:"keys"};if(o)c.scope=o;let a=await Ie(c);if(a.op!=="keys")throw new l("HOST_REJECTED","Expected storage keys.");return a.keys}},onReady:(t)=>{if(d.add(t),u)t(u);return()=>{d.delete(t)}},onDirectory:(t)=>{if(S.add(t),u)t(u.directory);return()=>{S.delete(t)}},onSession:(t)=>{if(b.add(t),u)t(u.session);return()=>{b.delete(t)}},onSessionLifecycle:(t)=>{if(m.add(t),F)t(F);return()=>{m.delete(t)}},onConnection:(t)=>{if(w.add(t),u)t(u.connection);return()=>{w.delete(t)}},onSettings:(t)=>{if(X.add(t),u)t(u.settings);return()=>{X.delete(t)}},onItem:(t)=>{if(j.add(t),u)t(u.item);return()=>{j.delete(t)}},onBlock:(t)=>{if(Te.add(t),u?.block)t(u.block);return()=>{Te.delete(t)}},onServiceEvent:(t)=>(Se.add(t),()=>{Se.delete(t)}),onStatusControl:(t)=>(fe.add(t),()=>{fe.delete(t)}),onPopoverClosed:(t)=>(Ae.add(t),()=>{Ae.delete(t)}),setStatusControls:(t)=>{if(u?.features?.statusControls!==!0)return Promise.reject(new l("UNSUPPORTED","This host does not support status controls."));if(!_o(t))return Promise.reject(new l("HOST_REJECTED","Status controls must have unique bounded ids and valid selected options."));return C({...I,type:"status-controls",id:p(_),payload:{controls:t}})},openPopover:(t)=>{if(u?.features?.popovers!==!0)return Promise.reject(new l("UNSUPPORTED","This host does not support popovers."));if(!lt(t))return Promise.reject(new l("HOST_REJECTED","Popover requests need bounded geometry and JSON data."));return C({...I,type:"popover-open",id:p(_),payload:t})},closePopover:ro,setPopoverAnchorActive:no,onResolve:(t)=>(ie=t,()=>{if(ie===t)ie=null}),toast:(t)=>{let o=t.message.trim();if(!o||o.length>Ue)return Promise.reject(new l("HOST_REJECTED",`Toast message must contain 1 to ${Ue} characters.`));if(t.copy&&t.copy!==!0&&(!t.copy.text.length||t.copy.text.length>Me))return Promise.reject(new l("HOST_REJECTED",`Toast copy text must contain 1 to ${Me} characters.`));return C({channel:E,v:T,type:"toast",id:p(_),payload:{...t,message:o}})},openUrl:(t)=>C({channel:E,v:T,type:"open-url",id:p(_),payload:{url:t}}),...ho(C,()=>p(_),(t)=>Promise.reject(new l("HOST_REJECTED",t))),answerBlock:(t)=>C({channel:E,v:T,type:"block-answer",id:p(_),payload:{text:t.trim().slice(0,_t)}}),openSurface:(t)=>C({channel:E,v:T,type:"open-surface",id:p(_),payload:{surfaceId:t}}),writeClipboard:(t)=>C({channel:E,v:T,type:"clipboard-write",id:p(_),payload:{text:t}}),compose:(t)=>C({channel:E,v:T,type:"compose",id:p(_),payload:t}),attach:(t)=>C({channel:E,v:T,type:"attach",id:p(_),payload:oe(t)}),startSession:async(t)=>{if(t.projectId!==void 0)H(t.projectId);let o=t.worktree;if(o&&o!==!0)if(o.kind==="existing")H(o.directory);else{if(o.name!==void 0)H(o.name,200);if(o.baseBranch!==void 0)H(o.baseBranch,200)}let c=await U({channel:E,v:T,type:"start-session",id:p(_),payload:At(t)},e.requestTimeoutMs??180000);if(!pt(c))throw new l("HOST_REJECTED","Host did not return a session.");return c},prompt:(t)=>U({channel:E,v:T,type:"prompt",id:p(_),payload:Ot(t)}).then((o)=>{if(!Et(o))throw new l("HOST_REJECTED","Host did not return a prompt result.");return o}),sessionLink:(t)=>C({channel:E,v:T,type:"session-link",id:p(_),payload:oe(t)}),close:()=>C({channel:E,v:T,type:"close",id:p(_)}),oauthStart:()=>C({channel:E,v:T,type:"oauth-start",id:p(_)}),oauthDisconnect:()=>C({channel:E,v:T,type:"oauth-disconnect",id:p(_)}),request:(t)=>(Le(t.path)?U({channel:E,v:T,type:"request",id:p(_),payload:t}):Ho()).then((o)=>{if(!Pe(o))throw new l("HOST_REJECTED","Host request result was empty.");return o}),serviceRequest:(t)=>(Le(t.path)?U({channel:E,v:T,type:"service-request",id:p(_),payload:t}):Ho()).then((o)=>{if(!Pe(o))throw new l("HOST_REJECTED","Host service request result was empty.");return o}),serviceStatus:()=>U({channel:E,v:T,type:"service-status",id:p(_)}).then((t)=>{if(!mt(t))throw new l("HOST_REJECTED","Host did not return service status.");return t}),readFile:(t)=>(re(t)?U({channel:E,v:T,type:"file-read",id:p(_),payload:{path:t}}):we()).then((o)=>{if(!It(o))throw new l("HOST_REJECTED","Host did not return file content.");return o}),writeFile:(t,o)=>{if(!re(t))return we();if(o.length>Ne)return Promise.reject(new l("FILE_TOO_LARGE",`Content is over ${Ne} characters.`));return U({channel:E,v:T,type:"file-write",id:p(_),payload:{path:t,content:o}}).then((c)=>{if(!gt(c))throw new l("HOST_REJECTED","Host did not confirm the write.");return c})},listDir:(t)=>(re(t)?U({channel:E,v:T,type:"file-list",id:p(_),payload:{path:t}}):we()).then((o)=>{if(!xt(o))throw new l("HOST_REJECTED","Host did not return directory entries.");return o}),stat:(t)=>(re(t)?U({channel:E,v:T,type:"file-stat",id:p(_),payload:{path:t}}):we()).then((o)=>{if(!bt(o))throw new l("HOST_REJECTED","Host did not return file status.");return o}),generate:(t)=>{let o=t.prompt.trim(),c=t.system?.trim();if(o.length===0||o.length>ye)return Promise.reject(new l("HOST_REJECTED",`Prompt must be 1 to ${ye} characters.`));if(c!==void 0&&(c.length===0||c.length>ve))return Promise.reject(new l("HOST_REJECTED",`System prompt must be 1 to ${ve} characters.`));let a=t.maxOutputTokens===void 0?void 0:Math.min(St,Math.max(1,Math.floor(t.maxOutputTokens)));if(a!==void 0&&!Number.isFinite(a))return Promise.reject(new l("HOST_REJECTED","maxOutputTokens must be a number."));let f={prompt:o};if(c!==void 0)f.system=c;if(a!==void 0)f.maxOutputTokens=a;return U({channel:E,v:T,type:"generate",id:p(_),payload:f},e.requestTimeoutMs??ft).then((A)=>{if(!Ct(A))throw new l("HOST_REJECTED","Host did not return generated text.");return A})},onLateGenerateResult:(t)=>{Y.add(t);for(let o of ze.splice(0))O([t],o);return Qt(),()=>{Y.delete(t)}},openMicrophone:dr,setBadge:(t)=>C({channel:E,v:T,type:"badge",id:p(_),payload:{count:Rt(t)}}),setHeight:(t)=>C({channel:E,v:T,type:"resize",id:p(_),payload:{height:ht(t)}}),onFileOpen:(t)=>{if(Oe.add(t),!Qe)Qe=!0,r.addEventListener("keydown",qt,!0);if(le)t(le);return()=>{Oe.delete(t)}},onFileSnapshot:(t)=>(ce=t,()=>{if(ce===t)ce=null}),onFileSaved:(t)=>(Re.add(t),()=>{Re.delete(t)}),reportFileChange:(t)=>Ye({...I,type:"file-change",payload:{dirty:t.dirty,edited:t.edited}}),requestFileSave:Jt,reportFileUnsupported:()=>Ye({...I,type:"file-unsupported"}),dispose:()=>{for(let t of q.keys())k({...I,type:"workspace-unsubscribe",id:p(_),payload:{subscriptionId:t}});q.clear();for(let t of Z.keys())k({...I,type:"shells-unsubscribe",id:p(_),payload:{subscriptionId:t}});if(Z.clear(),L)Je(),L.release(),L=null;if(V=!0,ie=null,ae=null,ce=null,Oe.clear(),Re.clear(),Qe)r.removeEventListener("keydown",qt,!0);r.removeEventListener("message",Yt),r.removeEventListener("keydown",Zt,!0),r.removeEventListener("pointerover",me),r.removeEventListener("pointermove",me),r.removeEventListener("pointerout",eo),r.removeEventListener("focus",to),r.removeEventListener("blur",oo);for(let t of J.values())clearTimeout(t.timer),t.reject(new l("HOST_UNAVAILABLE","Host client was disposed."));J.clear(),d.clear(),S.clear(),b.clear(),m.clear(),w.clear(),X.clear(),j.clear(),Te.clear(),Se.clear(),fe.clear(),Ae.clear(),Y.clear(),ze.length=0}}};var $o=["browser.open","browser.snapshot","browser.click","browser.type","browser.select","browser.scroll","browser.back","browser.forward","browser.inspect","browser.capture","browser.resize","browser.close"];var mn=new Set($o);var Fo=["none","agent","user"];var gn=new Set(Fo);var hr=[["--oc-bg","background"],["--oc-elevated","elevated"],["--oc-fg","foreground"],["--oc-muted","muted"],["--oc-subtle","subtle"],["--oc-border","border"],["--oc-hover","hover"],["--oc-selection","selection"],["--oc-focus","focus"],["--oc-primary","primary"],["--oc-muted-surface","mutedSurface"],["--oc-elevated-fg","elevatedForeground"],["--oc-active","active"],["--oc-selection-fg","selectionForeground"],["--oc-primary-fg","primaryForeground"],["--oc-primary-text","primaryText"],["--oc-success-text","successText"],["--oc-warning-text","warningText"],["--oc-error-text","errorText"],["--oc-info-text","infoText"],["--oc-success","success"],["--oc-warning","warning"],["--oc-error","error"],["--oc-info","info"],["--oc-font","font"],["--oc-mono","mono"],["--oc-radius","radius"],["--surface-background","background"],["--surface-elevated","elevated"],["--surface-foreground","foreground"],["--surface-muted-foreground","muted"],["--surface-subtle","subtle"],["--interactive-border","border"],["--interactive-hover","hover"],["--interactive-selection","selection"],["--interactive-focus-ring","focus"],["--primary","primary"],["--surface-muted","mutedSurface"],["--surface-elevated-foreground","elevatedForeground"],["--interactive-active","active"],["--interactive-selection-foreground","selectionForeground"],["--primary-foreground","primaryForeground"],["--primary-text","primaryText"],["--success-text","successText"],["--warning-text","warningText"],["--error-text","errorText"],["--info-text","infoText"],["--status-success","success"],["--status-warning","warning"],["--status-error","error"],["--status-info","info"],["--font-sans","font"],["--font-mono","mono"],["--radius","radius"]],mr=[["--oc-syntax-keyword","--syntax-keyword","syntaxKeyword"],["--oc-syntax-string","--syntax-string","syntaxString"],["--oc-syntax-number","--syntax-number","syntaxNumber"],["--oc-syntax-function","--syntax-function","syntaxFunction"],["--oc-syntax-type","--syntax-type","syntaxType"],["--oc-syntax-comment","--syntax-comment","syntaxComment"],["--oc-syntax-variable","--syntax-variable","syntaxVariable"],["--oc-syntax-operator","--syntax-operator","syntaxOperator"]],Bo=(e,r)=>{r.style.colorScheme=e.mode;for(let[s,i]of hr)r.style.setProperty(s,e.tokens[i]);for(let[s,i,d]of mr){let S=e.tokens[d]??"";r.style.setProperty(s,S),r.style.setProperty(i,S)}r.style.setProperty("font-family",e.tokens.font),r.style.setProperty("font-size",e.tokens.fontSize??"0.875rem"),r.style.setProperty("line-height","1.45"),r.style.setProperty("color",e.tokens.foreground)},kt=(e,r)=>{if(Bo(e.theme,r),r.dataset)r.dataset.ocSurface=e.surface,r.dataset.ocTheme=e.theme.mode};var Ir={"surface-background":"bg","surface-elevated":"elevated","surface-elevated-foreground":"elevated-fg","surface-foreground":"fg","surface-muted-foreground":"muted","surface-muted":"muted-surface","surface-subtle":"subtle","interactive-border":"border","interactive-hover":"hover","interactive-active":"active","interactive-selection":"selection","interactive-selection-foreground":"selection-fg","interactive-focus-ring":"focus",primary:"primary","primary-foreground":"primary-fg","primary-text":"primary-text","success-text":"success-text","warning-text":"warning-text","error-text":"error-text","info-text":"info-text","status-success":"success","status-warning":"warning","status-error":"error","status-info":"info","font-sans":"font","font-mono":"mono",radius:"radius"},h=(e,r)=>`var(--${e}, var(--oc-${Ir[e]}, ${r}))`,K=h("surface-background","transparent"),Xe=h("surface-elevated","transparent"),ne=h("surface-elevated-foreground","inherit"),P=h("surface-foreground","inherit"),g=h("surface-muted-foreground","gray"),gr=h("surface-muted","transparent"),z=h("interactive-border","currentColor"),N=h("interactive-hover","transparent"),Q=h("interactive-active","transparent"),Nt=h("interactive-selection","transparent"),yt=h("interactive-selection-foreground","inherit"),B=h("primary","currentColor"),vt=h("primary-text","inherit"),Lt=h("error-text","inherit"),xr=h("font-sans","inherit"),Pt=h("font-mono","monospace"),zo=h("radius","9px"),wt=`calc(${zo} - 2px)`,Ko=`calc(${zo} - 4px)`,x=(e,r,s="transparent")=>`color-mix(in srgb, ${e} ${r}%, ${s})`,Wo=`background-image: linear-gradient(${N}, ${N});`,Dt=(e,r="0.5px")=>`box-shadow: inset 0 0 0 ${r} ${e}, var(--oc-sdk-field-lift);`,Gt="border-color: var(--oc-sdk-edge); box-shadow: var(--oc-sdk-raised-lift);",jo="box-shadow: var(--oc-sdk-lit);",Xt=`inset 0 0.5px 0 0 ${x(P,8)}, 0 1px 2px 0 rgb(0 0 0 / 0.4)`,br=`
:root {
  --oc-sdk-edge: ${x(P,16)};
  --oc-sdk-field-bg: ${Xe};
  --oc-sdk-raised-bg: ${K};
  --oc-sdk-field-lift: inset 0 1px 2px 0 rgb(0 0 0 / 0.04);
  --oc-sdk-raised-lift: 0 1px 1.5px 0 rgb(0 0 0 / 0.08);
  --oc-sdk-lit: inset 0 1px 0 0 rgb(255 255 255 / 0.2), 0 1px 1.5px 0 rgb(0 0 0 / 0.1);
  --oc-sdk-float-edge: rgb(0 0 0 / 0.14);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.7), 0 1px 2px -0.5px rgb(0 0 0 / 0.06), 0 4px 8px -2px rgb(0 0 0 / 0.08), 0 12px 20px -4px rgb(0 0 0 / 0.06);
}
:root[data-oc-theme="dark"] {
  --oc-sdk-edge: ${x(P,14)};
  --oc-sdk-field-bg: ${x(K,50,Xe)};
  --oc-sdk-raised-bg: ${Xe};
  --oc-sdk-field-lift: ${Xt};
  --oc-sdk-raised-lift: ${Xt};
  --oc-sdk-lit: ${Xt};
  --oc-sdk-float-edge: rgb(0 0 0 / 0.55);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.04), inset 0 0 0 0.5px rgb(255 255 255 / 0.08), 0 8px 16px 0 rgb(0 0 0 / 0.25), 0 4px 8px 0 rgb(0 0 0 / 0.25);
}`,Ge=(e)=>{let r=h(`status-${e}`,"currentColor");return`
.oc-sdk[data-tone="${e}"], .oc-sdk [data-tone="${e}"] { --oc-sdk-tone: ${r}; --oc-sdk-tone-text: ${h(`${e}-text`,"inherit")}; }`},n=(e)=>`calc(${e}rem / 14)`,Cr=`
.oc-sdk { box-sizing: border-box; font-size: 0.875rem; line-height: 1.45; }
.oc-sdk *, .oc-sdk *::before, .oc-sdk *::after { box-sizing: border-box; }
/* :where() keeps the reset at zero specificity so every primitive class below overrides it. */
:where(.oc-sdk) :where(button, input, textarea), :where(button.oc-sdk, input.oc-sdk, textarea.oc-sdk) { font: inherit; color: inherit; margin: 0; }
:where(.oc-sdk) :where(button), :where(button.oc-sdk) { cursor: pointer; background: none; border: 0; padding: 0; }
.oc-sdk button:disabled, button.oc-sdk:disabled, .oc-sdk[aria-disabled="true"], .oc-sdk [aria-disabled="true"] { opacity: .5; pointer-events: none; }

.oc-sdk-btn { display: inline-flex; align-items: center; justify-content: center; gap: ${n(8)}; height: ${n(32)}; padding: 0 ${n(12)}; border: 1px solid transparent; font-size: 0.875rem; font-weight: 500; line-height: 1; white-space: nowrap; }
.oc-sdk-btn[data-size="sm"] { gap: ${n(6)}; height: ${n(28)}; padding: 0 ${n(10)}; font-size: 0.8125rem; }
.oc-sdk-btn[data-size="xs"] { gap: ${n(4)}; height: ${n(24)}; padding: 0 ${n(8)}; font-size: 0.75rem; }
.oc-sdk-btn[data-loading="true"] { opacity: .5; pointer-events: none; }
.oc-sdk-btn > .oc-sdk-spinner-ring { width: ${n(14)}; height: ${n(14)}; }

.oc-sdk-field { display: flex; flex-direction: column; gap: ${n(4)}; min-width: 0; }
.oc-sdk-field-label { font-size: 0.8125rem; font-weight: 500; }
.oc-sdk-field-note { font-size: 0.75rem; }
.oc-sdk-input { display: block; width: 100%; min-width: 0; height: ${n(32)}; padding: 0 ${n(10)}; border: 0; font-size: 0.875rem; line-height: 1.45; appearance: none; }
textarea.oc-sdk-input { height: auto; padding: ${n(8)} ${n(10)}; resize: vertical; }

.oc-sdk-search { position: relative; min-width: 0; }
.oc-sdk-search .oc-sdk-input { padding-left: ${n(34)}; padding-right: ${n(34)}; }
.oc-sdk-search-icon { position: absolute; left: ${n(11)}; top: 50%; transform: translateY(-50%); pointer-events: none; }
.oc-sdk-search-clear { position: absolute; right: ${n(6)}; top: 50%; transform: translateY(-50%); display: none; align-items: center; justify-content: center; width: ${n(24)}; height: ${n(24)}; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-clear { display: inline-flex; }

.oc-sdk-select { position: relative; display: flex; flex-direction: column; gap: ${n(4)}; min-width: 0; }
.oc-sdk-trigger { display: inline-flex; align-items: center; gap: ${n(6)}; align-self: flex-start; width: auto; max-width: 100%; min-width: 0; height: ${n(28)}; padding: 0 ${n(10)}; border: 1px solid transparent; font-size: 0.8125rem; text-align: left; }
.oc-sdk-trigger-value { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-trigger-chevron { flex: 0 0 auto; }
.oc-sdk-popup { position: fixed; z-index: 50; display: flex; flex-direction: column; gap: ${n(2)}; min-width: ${n(160)}; max-width: calc(100vw - ${n(16)}); max-height: min(${n(320)}, calc(100vh - ${n(16)})); overflow: auto; padding: ${n(4)}; border: 1px solid transparent; }
.oc-sdk-popup-search { flex: 0 0 auto; padding: ${n(2)} ${n(2)} ${n(4)}; }
.oc-sdk-popup-search .oc-sdk-input { height: ${n(28)}; font-size: 0.8125rem; }
.oc-sdk-option { display: flex; align-items: center; gap: ${n(8)}; width: 100%; padding: ${n(6)} ${n(8)}; font-size: 0.8125rem; text-align: left; }
.oc-sdk-option-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-option-hint { flex: 0 0 auto; font-size: 0.75rem; }
.oc-sdk-option-check { flex: 0 0 auto; display: inline-flex; width: ${n(14)}; visibility: hidden; }
.oc-sdk-option[aria-selected="true"] > .oc-sdk-option-check { visibility: visible; }
.oc-sdk-popup-empty { padding: ${n(8)}; font-size: 0.8125rem; }

.oc-sdk-check { display: inline-flex; align-items: flex-start; gap: ${n(8)}; width: 100%; text-align: left; }
.oc-sdk-check-box { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: ${n(14)}; height: ${n(14)}; margin-top: ${n(3)}; border: 1px solid transparent; }
.oc-sdk-check-box > svg { display: none; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box > svg { display: block; }
.oc-sdk-check-thumb { flex: 0 0 auto; position: relative; width: ${n(36)}; height: ${n(20)}; --oc-sdk-thumb-travel: ${n(16)}; }
.oc-sdk-check-thumb::after { content: ""; position: absolute; top: ${n(2)}; left: ${n(2)}; width: ${n(16)}; height: ${n(16)}; }
.oc-sdk-check-text { display: flex; flex-direction: column; min-width: 0; }
.oc-sdk-check-label { font-size: 0.875rem; }
.oc-sdk-check-desc { font-size: 0.75rem; }

.oc-sdk-tabs { display: inline-flex; gap: ${n(2)}; padding: ${n(2)}; max-width: 100%; overflow: auto; }
.oc-sdk-tab { display: inline-flex; align-items: center; gap: ${n(6)}; height: ${n(28)}; padding: 0 ${n(10)}; border: 1px solid transparent; font-size: 0.8125rem; font-weight: 500; white-space: nowrap; }
.oc-sdk-tab-count { font-size: 0.75rem; font-variant-numeric: tabular-nums; }

.oc-sdk-badge { display: inline-flex; align-items: center; padding: ${n(1)} ${n(6)}; font-size: ${n(11)}; font-weight: 500; line-height: ${n(16)}; white-space: nowrap; }

.oc-sdk-list { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.oc-sdk-row { display: flex; align-items: center; gap: ${n(8)}; width: 100%; padding: ${n(6)} ${n(8)}; text-align: left; }
.oc-sdk-row-lead { flex: 0 0 auto; width: ${n(64)}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; }
.oc-sdk-row-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.oc-sdk-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oc-sdk-row-sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.75rem; }
.oc-sdk-row-meta { flex: 0 0 auto; font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.oc-sdk-list-empty { padding: ${n(16)} ${n(8)}; text-align: center; font-size: 0.8125rem; }

.oc-sdk-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${n(4)}; padding: ${n(40)} ${n(16)}; text-align: center; }
.oc-sdk-empty-title { margin: 0; font-size: 0.8125rem; font-weight: 600; }
.oc-sdk-empty-body { margin: 0; max-width: 32rem; font-size: 0.8125rem; }
.oc-sdk-empty-action { margin-top: ${n(12)}; }

@keyframes oc-sdk-spin { to { transform: rotate(360deg); } }
.oc-sdk-spinner { display: inline-flex; align-items: center; gap: ${n(8)}; font-size: 0.8125rem; }
.oc-sdk-spinner-ring { width: ${n(16)}; height: ${n(16)}; border: 2px solid transparent; animation: oc-sdk-spin .8s linear infinite; }
.oc-sdk-spinner[data-size="sm"] .oc-sdk-spinner-ring { width: ${n(12)}; height: ${n(12)}; }

.oc-sdk-banner { display: flex; align-items: flex-start; gap: ${n(12)}; padding: ${n(8)} ${n(12)}; border: 1px solid transparent; }
.oc-sdk-banner-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: ${n(2)}; }
.oc-sdk-banner-title { font-size: 0.8125rem; font-weight: 500; }
.oc-sdk-banner-body { font-size: 0.8125rem; }
.oc-sdk-banner-action { flex: 0 0 auto; }

.oc-sdk-separator { display: flex; align-items: center; gap: ${n(8)}; width: 100%; margin: ${n(8)} 0; font-size: 0.75rem; }
.oc-sdk-separator::before, .oc-sdk-separator::after { content: ""; flex: 1 1 auto; height: 1px; }
.oc-sdk-separator[data-labeled="false"]::after { display: none; }
.oc-sdk-popup > .oc-sdk-separator { margin: ${n(4)} 0; }

.oc-sdk-progress { display: flex; flex-direction: column; gap: ${n(4)}; min-width: 0; }
.oc-sdk-progress-label { display: flex; justify-content: space-between; font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.oc-sdk-progress-track { height: ${n(6)}; overflow: hidden; }
.oc-sdk-progress-fill { height: 100%; transform-origin: left; transition: transform 200ms ease-out; }
.oc-sdk-progress-value { display: inline-flex; align-items: center; gap: ${n(2)}; }
.oc-sdk-progress[data-done="true"] .oc-sdk-progress-value { font-weight: 600; }

.oc-sdk-menu { position: relative; display: inline-flex; }

.oc-sdk-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.oc-sdk-text img { display: block; max-width: 100%; margin: ${n(8)} 0; }

/* Under a finger the controls reach the app's touch sizes: rows and options 44px like its sheets, every other
   control at least 36px. Inputs keep 16px text, below which iOS zooms the page on focus. */
@media (pointer: coarse) {
  .oc-sdk-btn, .oc-sdk-input { height: ${n(40)}; }
  .oc-sdk-btn[data-size="sm"], .oc-sdk-btn[data-size="xs"], .oc-sdk-trigger, .oc-sdk-tab, .oc-sdk-popup-search .oc-sdk-input { height: ${n(36)}; }
  .oc-sdk-input, .oc-sdk-popup-search .oc-sdk-input { font-size: max(16px, 0.875rem); }
  .oc-sdk-search-clear { width: ${n(36)}; height: ${n(36)}; right: 0; }
  .oc-sdk-row, .oc-sdk-option { min-height: ${n(44)}; }
  .oc-sdk-check { min-height: ${n(36)}; padding: ${n(8)} 0; }
}
`,Qo=`${br}
.oc-sdk { color: ${P}; font-family: ${xr}; }
.oc-sdk :focus-visible, .oc-sdk:focus-visible { outline: none; }
.oc-sdk :where(button, a[href], [role="button"], [role="tab"], [role="option"]):focus-visible, button.oc-sdk:focus-visible { ${Wo} }
.oc-sdk-mono { font-family: ${Pt}; }
.oc-sdk-muted { color: ${g}; }
${Ge("success")}${Ge("warning")}${Ge("error")}${Ge("info")}
.oc-sdk[data-tone="primary"], .oc-sdk [data-tone="primary"] { --oc-sdk-tone: ${B}; --oc-sdk-tone-text: ${vt}; }

.oc-sdk-btn { border-radius: ${wt}; transition: background 150ms ease-out, color 150ms ease-out; }
.oc-sdk-btn[data-size="xs"] { border-radius: ${Ko}; }
.oc-sdk-btn[data-variant="default"] { color: ${vt}; background: ${x(B,10,K)}; border-color: ${x(B,12)}; ${jo} }
.oc-sdk-btn[data-variant="default"]:hover { background: ${x(B,16,K)}; }
.oc-sdk-btn[data-variant="default"]:active { background: ${x(B,22,K)}; box-shadow: none; }
.oc-sdk-btn[data-variant="secondary"] { background: ${gr}; color: var(--oc-fg); }
.oc-sdk-btn[data-variant="secondary"]:hover { background-image: linear-gradient(${N}, ${N}); }
.oc-sdk-btn[data-variant="secondary"]:active { background-image: linear-gradient(${Q}, ${Q}); }
.oc-sdk-btn[data-variant="outline"] { background: var(--oc-sdk-raised-bg); color: ${ne}; ${Gt} }
.oc-sdk-btn[data-variant="outline"]:hover { background-image: linear-gradient(${N}, ${N}); }
.oc-sdk-btn[data-variant="outline"]:active { background-image: linear-gradient(${Q}, ${Q}); box-shadow: none; }
.oc-sdk-btn[data-variant="ghost"] { background: transparent; }
.oc-sdk-btn[data-variant="ghost"]:hover { background: ${N}; }
.oc-sdk-btn[data-variant="ghost"]:active { background: ${Q}; }
.oc-sdk-btn[data-variant="destructive"] { --oc-sdk-tone: ${h("status-error","red")}; color: ${Lt}; background: ${x("var(--oc-sdk-tone)",7,K)}; border-color: ${x("var(--oc-sdk-tone)",12)}; ${jo} }
.oc-sdk-btn[data-variant="destructive"]:hover { background: ${x("var(--oc-sdk-tone)",9,K)}; }
.oc-sdk-btn[data-variant="destructive"]:active { background: ${x("var(--oc-sdk-tone)",11,K)}; box-shadow: none; }

.oc-sdk-field-note { color: ${g}; }
.oc-sdk-field[data-invalid="true"] .oc-sdk-field-note { color: ${Lt}; }
.oc-sdk-input { border-radius: ${wt}; background: var(--oc-sdk-field-bg); color: ${ne}; ${Dt("var(--oc-sdk-edge)")} transition: background 150ms ease-out; }
.oc-sdk-input::placeholder { color: ${g}; }
.oc-sdk-input:hover:not(:focus) { background-image: linear-gradient(${N}, ${N}); }
.oc-sdk-input:focus, .oc-sdk-input:focus-visible { ${Dt(x(P,26),"1px")} }
.oc-sdk-field[data-invalid="true"] .oc-sdk-input, .oc-sdk-field[data-invalid="true"] .oc-sdk-input:focus { ${Dt(h("status-error","red"),"1px")} }
.oc-sdk-input[data-mono="true"] { font-family: ${Pt}; }

.oc-sdk-search-icon { color: ${g}; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-icon { color: ${B}; }
.oc-sdk-search-clear { border-radius: ${Ko}; color: ${g}; }
.oc-sdk-search-clear:hover { background: ${N}; color: ${P}; }

.oc-sdk-trigger { border-radius: ${wt}; background: var(--oc-sdk-raised-bg); color: ${ne}; ${Gt} transition: background 150ms ease-out; }
.oc-sdk-trigger:hover { background-image: linear-gradient(${N}, ${N}); }
.oc-sdk-trigger[aria-expanded="true"] { background-image: linear-gradient(${Q}, ${Q}); }
.oc-sdk-trigger-value[data-empty="true"] { color: ${g}; }
.oc-sdk-trigger-chevron { color: ${g}; }
/* The app's floating level: the glass edge (a hairline ring and a lit top line, dark outside and light inside in dark themes) over soft shadows. The outer ring is the border, over the page like the app's. */
.oc-sdk-popup { --surface-foreground: ${ne}; border-color: var(--oc-sdk-float-edge); border-radius: 12px; background: ${Xe}; background-clip: padding-box; color: ${ne}; box-shadow: var(--oc-sdk-float); }
.oc-sdk-option { border-radius: 8px; }
.oc-sdk-option[data-active="true"] { background: ${N}; }
/* A selected option shows a check mark in the text colour, like the app's own pickers. Options without the mark come
   from bundles built before it existed and keep the selection fill as their only sign of the choice. */
.oc-sdk-option[aria-selected="true"]:not([data-mark]) { background: ${Nt}; color: ${yt}; }
.oc-sdk-option-check { color: ${P}; }
.oc-sdk-option[data-destructive="true"] { color: ${Lt}; }
.oc-sdk-option[data-destructive="true"][data-active="true"] { background: ${x(h("status-error","red"),10)}; }
.oc-sdk-option-hint { color: ${g}; }
.oc-sdk-popup-empty { color: ${g}; }

/* Checked stays neutral: the mark carries the state, and the primary colour stays with primary actions. */
.oc-sdk-check-box { border-color: ${z}; border-radius: 4px; color: ${P}; transition: border-color 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box { border-color: ${x(P,60,z)}; }
.oc-sdk-check-thumb { border-radius: 9999px; background: ${z}; transition: background 150ms ease-out; }
.oc-sdk-check-thumb::after { border-radius: 9999px; background: ${K}; transition: transform 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb { background: ${B}; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb::after { transform: translateX(var(--oc-sdk-thumb-travel, 16px)); }
.oc-sdk-check:focus-visible { box-shadow: none; }
.oc-sdk-check:focus-visible .oc-sdk-check-box, .oc-sdk-check:focus-visible .oc-sdk-check-thumb { ${Wo} }
.oc-sdk-check-desc { color: ${g}; }

.oc-sdk-tabs { border-radius: 10px; }
.oc-sdk-tabs[data-track="true"] { background: ${x(P,4)}; box-shadow: inset 0 1px 2px 0 rgb(0 0 0 / 0.16); }
.oc-sdk-tab { border-radius: 8px; color: ${g}; transition: color 150ms ease-out, background 150ms ease-out; }
.oc-sdk-tab:hover { color: ${P}; }
.oc-sdk-tab[aria-selected="true"] { color: ${yt}; background: ${Nt}; border-color: ${z}; }
.oc-sdk-tabs[data-track="true"] .oc-sdk-tab[aria-selected="true"] { color: ${ne}; background: var(--oc-sdk-raised-bg); ${Gt} }
.oc-sdk-tab-count { color: ${g}; }

/* The app's neutral badge: a step of the text colour, the same in every theme. */
.oc-sdk-badge { border-radius: 9999px; background: ${x(P,6)}; color: ${g}; }
.oc-sdk-badge[data-tone] { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); background: ${x("var(--oc-sdk-tone)",15)}; }

.oc-sdk-row { border-radius: 6px; transition: background 120ms ease-out; }
.oc-sdk-row:hover, .oc-sdk-row[data-active="true"] { background: ${N}; }
.oc-sdk-row[aria-selected="true"] { background: ${Nt}; color: ${yt}; }
.oc-sdk-row-lead { font-family: ${Pt}; color: ${g}; }
.oc-sdk-row-sub { color: ${g}; }
.oc-sdk-row-meta { color: ${g}; }
.oc-sdk-row[aria-selected="true"] .oc-sdk-row-lead, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-sub, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-meta { color: inherit; opacity: .75; }
.oc-sdk-list-empty { color: ${g}; }

.oc-sdk-empty-body { color: ${g}; }

.oc-sdk-spinner { color: ${g}; }
.oc-sdk-spinner-ring { border-color: ${z}; border-top-color: ${B}; border-radius: 9999px; }

/* Set apart by its tint alone, like the app's banners. */
.oc-sdk-banner { border-color: transparent; border-radius: 8px; background: ${x("var(--oc-sdk-tone)",10)}; }
.oc-sdk-banner-title { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); }
.oc-sdk-banner-body { color: ${g}; }

.oc-sdk-separator { color: ${g}; }
.oc-sdk-separator::before, .oc-sdk-separator::after { background: ${x(z,40)}; }

.oc-sdk-progress-label { color: ${g}; }
/* The app's progress: a groove a step of the text colour, green once done. Older bundles mark done only through aria-valuenow. */
.oc-sdk-progress-track { border-radius: 9999px; background: ${x(P,6)}; }
.oc-sdk-progress-fill { border-radius: 9999px; background: var(--oc-sdk-tone, ${B}); }
.oc-sdk-progress-track[aria-valuenow="100"] > .oc-sdk-progress-fill:not([data-tone]) { background: ${h("status-success","currentColor")}; }
.oc-sdk-progress[data-done="true"] .oc-sdk-progress-value { color: ${h("success-text","inherit")}; }

.oc-sdk-text a { color: ${vt}; text-decoration: underline; text-underline-offset: 2px; }
.oc-sdk-text img { border-radius: 8px; border: 1px solid ${x(z,60)}; }
`,M=`
${et}
${Cr}
${Qo}`;var Yo="main";function Jo(e){if(e==="antigravity-acp")return"main";if(typeof e==="string"&&e.startsWith("antigravity-acp-"))return e.slice(16)||null;return null}function er(e){let r=e?.indexOf("/")??-1;if(!e||r<0)return null;let s=Jo(e.slice(0,r)),i=e.slice(r+1);return s&&i?{account:s,modelId:i}:null}function tr(e,r){return e?.account===r?.account&&e?.modelId===r?.modelId}function yr(e,r){let s=/gemini/i.test(e);return/^gemini/i.test(r)?s:!s}function vr(e){return e.replace(/\s+models?$/i,"").replace(/\s+and\s+/i," & ").trim()||e}var qo=["5h","daily","weekly"],Lr={"5h":"5-hour",daily:"Daily",weekly:"Weekly"};function Pr(e){if(e===null)return"muted";if(e<20)return"error";if(e<50)return"warning";return"success"}function wr(e,r){let s=r.usedPercent,i=typeof s==="number"&&Number.isFinite(s)?Math.round(Math.max(0,Math.min(100,100-s))):null;return{key:e,label:Lr[e]??e.replace(/_/g," "),remaining:i,tone:Pr(i),resetAt:typeof r.resetAt==="number"&&r.resetAt>0?r.resetAt:null}}var Zo=(e)=>{let r=qo.indexOf(e);return r<0?qo.length:r};function Dr(e,r=null){let s=e.usage?.models??{};return Object.entries(s).map(([d,S])=>({name:vr(d),current:r!==null&&yr(d,r),windows:Object.entries(S.windows??{}).sort(([b],[m])=>Zo(b)-Zo(m)).map(([b,m])=>wr(b,m))})).sort((d,S)=>Number(S.current)-Number(d.current))}function or(e){let r=e?.accounts;if(Array.isArray(r))return{accounts:r};return{accounts:[{id:Yo,name:"Main",data:e}]}}function Gr(e,r){let s=r?.account===e.id,i=e.data;if(!i?.ok||!i.usage)return{id:e.id,name:e.name,current:s,groups:[],error:i?.error??"agy reported no quota."};let d=Dr(i,s?r.modelId:null);return{id:e.id,name:e.name,current:s,groups:d,error:d.length===0?"agy reported no quota groups.":null}}function rr(e,r=null){return e.accounts.map((i)=>Gr(i,r)).sort((i,d)=>Number(d.current)-Number(i.current))}function nr(e,r,s){let i=new Date(e),d={hour:"numeric",minute:"2-digit"};if(new Date(r).toDateString()===i.toDateString())return i.toLocaleTimeString(s,d);if(e-r<518400000)return i.toLocaleString(s,{weekday:"short",...d});return i.toLocaleDateString(s,{month:"short",day:"numeric"})}var Kt=60000,Ke=Mt(),ir=document.querySelector("#root");if(!ir)throw Error("Missing #root");var Ee=ir,ar=document.createElement("style");ar.textContent=`
  html, body { margin: 0; background: transparent; color: var(--oc-fg); font: 12px/1.4 var(--oc-font); }
  * { box-sizing: border-box; }
  #root { display: flex; flex-direction: column; gap: 8px; padding: 2px 4px 4px; }
  .note { color: var(--oc-muted); }
  .note.error { color: var(--oc-error-text, var(--oc-error)); }
  .group { display: flex; flex-direction: column; gap: 4px; }
  .group.other { opacity: .7; }
  .name { display: flex; align-items: baseline; gap: 6px; font-weight: 600; }
  .account { display: flex; flex-direction: column; gap: 6px; }
  .account + .account { border-top: 1px solid var(--oc-border); padding-top: 8px; }
  .account.other { opacity: .75; }
  .account-name { display: flex; align-items: baseline; gap: 6px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--oc-muted); }
  .line { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; align-items: center; gap: 8px; }
  .what { color: var(--oc-muted); }
  .meter { height: 5px; border-radius: 3px; overflow: hidden; background: color-mix(in srgb, var(--oc-fg) 8%, transparent); }
  .meter > span { display: block; height: 100%; border-radius: 3px; }
  .value { font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }
  .reset { color: var(--oc-muted); }
`;document.head.append(ar);var Xr={success:"var(--oc-success)",warning:"var(--oc-warning)",error:"var(--oc-error)",muted:"var(--oc-muted)"},G=(e,r="",s="")=>{let i=document.createElement(e);if(r)i.className=r;if(s)i.textContent=s;return i},cr,Ft=null,Bt=null,Be=null,Ht=!1,Wt=0,$t=(e,r=!1)=>Ee.replaceChildren(G("div",r?"note error":"note",e));function Vr(e,r,s){let i=G("div",e.current||!s?"group":"group other"),d=G("div","name",e.name);i.append(d);for(let S of e.windows){let b=G("span");b.style.width=`${S.remaining??0}%`,b.style.background=Xr[S.tone];let m=G("div","meter");m.append(b);let w=G("span","value",S.remaining===null?"–":`${S.remaining}% left`);if(S.resetAt!==null){let j=nr(S.resetAt,r,cr);w.append(G("span","reset",` · ${j}`)),w.title=`Refills ${j}`}let X=G("div","line");X.append(G("span","what",S.label),m,w),i.append(X)}return i}function lr(e,r){if(e.error)return[G("div","note error",e.error)];let s=e.groups.some((i)=>i.current);return e.groups.map((i)=>Vr(i,r,s))}function Hr(e,r,s){let i=G("div",e.current||!s?"account":"account other"),d=G("div","account-name",e.name);return i.append(d,...lr(e,r)),i}function We(){if(Be){$t(Be,!0);return}if(!Bt){$t("Reading quota…");return}let e=Date.now(),r=rr(Bt,Ft);if(r.length===0){$t("agy reported no quota.");return}if(r.length===1){Ee.replaceChildren(...lr(r[0],e));return}let s=r.some((i)=>i.current);Ee.replaceChildren(...r.map((i)=>Hr(i,e,s)))}function $r(e){if(e instanceof l){if(e.code==="NO_SERVICE"||e.code==="NOT_GRANTED")return"Allow the local service for Antigravity quota in Settings → Extensions.";if(e.code==="DISABLED")return"Antigravity quota is paused in Settings → Extensions."}return"Could not reach the quota service."}async function je(){if(Ht||document.hidden)return;Ht=!0;try{let e=await Ke.serviceRequest({method:"GET",path:"/usage"});if(e.status!==200)throw Error(`status ${e.status}`);Bt=or(JSON.parse(e.body)),Be=null,Wt=Date.now()}catch(e){Be=$r(e)}finally{Ht=!1,We()}}var sr=-1;new ResizeObserver(()=>{let e=Math.ceil(Ee.getBoundingClientRect().height);if(e===sr)return;sr=e,Ke.setHeight(e).catch(()=>{return})}).observe(Ee);Ke.onReady((e)=>{kt(e,document.documentElement),cr=e.locale,We()});Ke.onSession((e)=>{let r=er(e?.model);if(tr(r,Ft))return;if(Ft=r,We(),Date.now()-Wt>Kt/2)je()});setInterval(()=>void je(),Kt);document.addEventListener("visibilitychange",()=>{if(!document.hidden&&Date.now()-Wt>Kt)je()});We();je();})();
