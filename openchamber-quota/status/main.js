(()=>{var E="openchamber.sdk",T=1;var ot=`
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
`;function so(e){let r=e.documentElement;if(r.hasAttribute("data-oc-scrollbar-activity"))return;r.setAttribute("data-oc-scrollbar-activity","");let s=new WeakMap;e.addEventListener("scroll",(u)=>{let d=u.target===e?r:u.target;if(!(d instanceof Element))return;if(!d.hasAttribute("data-oc-scrolling"))d.setAttribute("data-oc-scrolling","");let S=s.get(d);if(S!==void 0)clearTimeout(S);s.set(d,setTimeout(()=>{s.delete(d),d.removeAttribute("data-oc-scrolling")},1000))},{capture:!0,passive:!0})}var ar=`(${so.toString()})(document);`;var rt=128,nt=65536;var be=128;var Ue=65536;var st=8000,it=192000,at=120000;var io=(e)=>{let r=[],s=0,u=0;return{push:(d)=>{r.push(d),u+=d.length;while(u-s>e&&r.length>1){let S=r.shift();u-=S?.length??0,s=0}},pull:(d)=>{let S=0;while(S<d.length&&r.length>0){let U=r[0],m=Math.min(d.length-S,U.length-s);if(d.set(U.subarray(s,s+m),S),S+=m,s+=m,s>=U.length)r.shift(),u-=U.length,s=0}d.fill(0,S)},clear:()=>{r.length=0,s=0,u=0},get size(){return u-s}}};var _o=/^[a-z][a-z0-9-]{0,39}$/;var ao=(e)=>Object(e)===e&&!Array.isArray(e),ct=(e,r)=>Object.keys(e).every((s)=>r.includes(s)),co=(e)=>String(e)===e&&e.length>=1&&e.length<=60,lo=(e)=>String(e)===e&&e.length>=1&&e.length<=80,po=(e)=>{if(!Array.isArray(e)||e.length>4)return!1;let r=new Set;for(let s of e){if(!ao(s)||!_o.test(s.id)||!co(s.label))return!1;if(s.disabled!==void 0&&s.disabled!==!0&&s.disabled!==!1)return!1;if(r.has(s.id))return!1;if(r.add(s.id),s.kind==="button"){if(!ct(s,["kind","id","label","disabled"]))return!1;continue}if(s.kind!=="select"||!ct(s,["kind","id","label","value","options","disabled"]))return!1;if(!lo(s.value)||!Array.isArray(s.options)||s.options.length<1||s.options.length>16)return!1;let u=new Set;for(let d of s.options){if(!ao(d)||!ct(d,["value","label"])||!lo(d.value)||!co(d.label)||u.has(d.value))return!1;u.add(d.value)}if(!u.has(s.value))return!1}return!0};var uo=["{id}","{segment}","{segments+}"];var Kr=new Set(uo);var Eo=["turn-finished","turn-failed","permission-asked","question-asked","turn-started","session-created","session-archived","session-deleted"];var jr=new Set(Eo);var Ce=20000000,ke=256;var dt=(e)=>("bytes"in e)?e.bytes.byteLength:e.content.length,To=(e,r)=>{if(e.path!==r.path||e.readOnly!==r.readOnly)return!1;if(e.encoding==="text"||r.encoding==="text")return e.encoding==="text"&&r.encoding==="text"&&e.content===r.content;if(e.bytes.byteLength!==r.bytes.byteLength)return!1;for(let s=0;s<e.bytes.byteLength;s+=1)if(e.bytes[s]!==r.bytes[s])return!1;return!0};var So=/^[A-Za-z0-9_-]{1,80}$/;var fo=["left","right","top","bottom"];var Ao=(e,r=0,s={remaining:16000})=>{if(--s.remaining<0||r>=32)return!1;if(e===null)return!0;let u=Array.isArray(e)?e:Object(e)===e?Object.values(e):[];for(let d of u)if(!Ao(d,r+1,s))return!1;return!0},lt=(e)=>{if(e===null||e===!0||e===!1)return!0;if(Array.isArray(e))return Object.keys(e).every((r)=>/^(0|[1-9]\d*)$/.test(r)&&Number(r)<e.length)&&e.every(lt);if(Object(e)===e){let r=Object.getPrototypeOf(e);return(r===null||r===Object.prototype)&&Object.values(e).every(lt)}return String(e)===e||Number.isFinite(e)},_t=(e)=>{try{if(String(e.id)!==e.id||!So.test(e.id)||!Number.isFinite(e.anchor.x)||Math.abs(e.anchor.x)>1e5||!Number.isFinite(e.anchor.y)||Math.abs(e.anchor.y)>1e5||!Number.isFinite(e.anchor.width)||!Number.isFinite(e.anchor.height)||e.anchor.width<=0||e.anchor.height<=0||e.anchor.width>1e5||e.anchor.height>1e5||!Number.isInteger(e.width)||e.width<160||e.width>640||!Number.isInteger(e.height)||e.height<48||e.height>480||e.side!==void 0&&!fo.includes(e.side)||e.focus!==void 0&&e.focus!==!0&&e.focus!==!1||!Ao(e.data)||!lt(e.data))return!1;return JSON.stringify(e.data).length<=16000}catch{return!1}};var Oo=/^[0-9a-f]{7,64}$/i,Ro=(e)=>Oo.test(e),pt=255,ho=(e,r,s)=>({openCommit:(u)=>Ro(u)?e({channel:E,v:T,type:"open-commit",id:r(),payload:{sha:u}}):s("Commit id must be 7 to 64 hex characters."),openWalkthrough:({base:u})=>{let d=u.trim();if(!d||d.length>pt)return s(`Base must contain 1 to ${pt} characters.`);return e({channel:E,v:T,type:"open-walkthrough",id:r(),payload:{base:d}})}});var Et=2000;var Io=["file","directory","other","missing"],Tt=(e)=>Boolean(e&&"sessionId"in e),St=(e)=>Boolean(e&&"sent"in e&&!("sessionId"in e));var Me=500,Ne=32000,xo=16000,go=128,bo=200,Uo=2000,Co=16000,ko=80,Mo=200,No=16000;var yo=2000;var ft=20000,ye=1024,ve=2000000;var Le=64000,Pe=8000,At=4000;var Ot=960000;var vo=999,Lo=1e4,Ee=500,Po=["HOST_UNAVAILABLE","HOST_TIMEOUT","HOST_REJECTED","DISCONNECTED","DISABLED","BAD_PATH","NO_INTEGRATION","NO_SERVICE","SERVICE_FAILED","REQUEST_FAILED","RESPONSE_TOO_LARGE","NO_SESSION","SESSION_BUSY","NOT_GRANTED","NO_DIRECTORY","NOT_FOUND","FILE_TOO_LARGE","DENIED","NO_MODEL","MODEL_FAILED","UNSUPPORTED"],wo=["stopped","starting","ready","failed"],dr=new Set(Po),Do=(e)=>dr.has(e),Go=(e)=>e&&Do(e)?e:"HOST_REJECTED",ee=(e)=>{if(e===void 0)return!1;if(e===null||e===!0||e===!1)return!0;if(String(e)===e)return!0;if(Number(e)===e)return Number.isFinite(e);if(Array.isArray(e))return e.every(ee);if(Object(e)===e)return Object.values(e).every(ee);return!1},Xo=(e)=>ee(e)&&JSON.stringify(e).length<=No,mo=(e)=>e?.trim().slice(0,Mo)??"",te=(e)=>{let r=e.id.trim().slice(0,go),s=e.title.trim().slice(0,bo),u=e.url.trim().slice(0,Uo),d=e.text?.trim().slice(0,Co),S=e.author?.trim().slice(0,ko),U=e.kind==="pull"?"pull":"issue",m={providerId:e.providerId.trim(),id:r,title:s||r,url:u,kind:U};if(d)m.text=d;if(S)m.author=S;if(U==="pull"){let D=mo(e.branches?.head),G=mo(e.branches?.base);if(D&&G)m.branches={head:D,base:G}}if(Xo(e.data))m.data=e.data;return m},Rt=(e)=>{let r=te(e);if(e.projectId)r.projectId=e.projectId;if(e.navigation)r.navigation=e.navigation;if(e.worktree)r.worktree=e.worktree;return r},ht=(e)=>{let r={text:e.text.trim().slice(0,xo)};if(e.send)r.send=!0;return r},mt=(e)=>{if(e===null||!Number.isFinite(e))return null;return Math.min(vo,Math.max(0,Math.round(e)))},It=(e)=>{if(!Number.isFinite(e))return 0;return Math.min(Lo,Math.max(0,Math.ceil(e)))};var oe=(e)=>e.length>0&&e.length<=ye&&!e.includes("\x00")&&!e.includes("\\");var we=(e)=>{if(!e.startsWith("/")||e.includes("\x00")||e.includes("\\")||e.includes("://"))return!1;if(e.length>yo)return!1;return!e.split("/").some((s)=>s==="."||s==="..")},lr=new Set(wo),xt=(e)=>Boolean(e&&"status"in e&&lr.has(String(e.status))&&!("body"in e)),De=(e)=>Boolean(e&&"status"in e&&"body"in e&&Number.isInteger(e.status)),gt=(e)=>Boolean(e&&"content"in e&&String(e.content)===e.content),bt=(e)=>Boolean(e&&"written"in e&&e.written===!0),Ut=(e)=>Boolean(e&&"entries"in e&&Array.isArray(e.entries)),_r=new Set(Io),Ct=(e)=>Boolean(e&&"kind"in e&&"size"in e&&_r.has(String(e.kind))&&Number.isFinite(e.size)),kt=(e)=>Boolean(e&&"text"in e&&String(e.text)===e.text&&!("status"in e)),pr=new Set(["workspace","shells","ready","directory","session","connection","settings","session-lifecycle","item","resolve","action","service-event","status-control-event","popover-closed","file-open","file-snapshot","file-saved","generate-late","microphone-audio","microphone-ended"]),ur=(e)=>Object(e)===e?e:null,ut=(e)=>String(e)===e&&e.length>0,Er=(e)=>{if(!ut(e.id))return null;if(e.ok===!0){let r={channel:E,v:T,type:"result",id:e.id,ok:!0};if(Object(e.payload)===e.payload)r.payload=e.payload;return r}if(e.ok===!1&&ut(e.error))return{channel:E,v:T,type:"result",id:e.id,ok:!1,error:e.error,code:Go(ut(e.code)?e.code:void 0)};return null},Mt=(e)=>{let r=ur(e);if(!r||r.channel!==E||r.v!==T)return null;if(r.type==="result")return Er(r);if(!pr.has(String(r.type))||Object(r.payload)!==r.payload)return null;return r};var Ho=(e)=>("key"in e)&&("metaKey"in e)&&("ctrlKey"in e),Tr=(e)=>(e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==="s";class c extends Error{code;constructor(e,r){super(r);this.name="HostRequestError",this.code=e}}var Vo=()=>Promise.reject(new c("BAD_PATH",'Request path must start with "/" and stay on the declared origin.')),Ge=()=>Promise.reject(new c("BAD_PATH",`File path must be 1 to ${ye} characters without NUL or backslash.`)),Xe=(e)=>{if(e===void 0)return;if(Object(e)!==e||Array.isArray(e)||e.scope!==void 0&&e.scope!=="instance"&&e.scope!=="device")throw new c("HOST_REJECTED",'Storage scope must be "instance" or "device".');return e.scope==="device"?"device":void 0},p=(e)=>(e.value+=1,`oc-${e.value}`),Nt=(e={})=>{let r=e.target??("window"in globalThis?window:null);if(!r)throw new c("HOST_UNAVAILABLE","No window. connectHost runs in a browser frame.");let s=e.acceptSource??((t)=>t===r.parent),u=e.requestTimeoutMs??ft,d=new Set,S=new Set,U=new Set,m=new Set,D=new Set,G=new Set,ae=new Set,fe=new Set,Ae=new Set,Oe=new Set,Re=new Set,Y=new Set,Qe=[],ce=null,de=null,he=new Set,me=new Set,le=null,_e=null,Je=!1,Q=new Map,J=new Map,Z=new Map,X=!1,_={value:0},l=null,F=null,pe=!1,ue=!1,jt=null,L=null,zt=(t)=>{if(!t)return null;return{sessionId:t.id,phase:t.busy?"started":"completed"}},M=(t)=>{r.parent.postMessage(t,"*")},Yt=()=>{if(X||r.parent===r||Y.size===0||l?.features?.lateGenerateResults!==!0)return;M({channel:E,v:T,type:"generate-late-listen"})},O=(t,o)=>{for(let a of t)try{a(o)}catch(i){console.error(i)}},Qt=(t)=>{if(!(t instanceof MessageEvent))return;if(!s(t.source))return;let o=Mt(t.data);if(!o)return;if(o.type==="workspace"){let i=J.get(o.payload.subscriptionId);if(i)O([i],o.payload.snapshot);return}if(o.type==="shells"){let i=Z.get(o.payload.subscriptionId);if(i)O([i],o.payload.snapshot);return}if(o.type==="microphone-audio"){L?.queue.push(o.payload.samples);return}if(o.type==="microphone-ended"){let i=L;if(!i)return;L=null,i.release(),O(i.endedListeners,o.payload.reason);return}if(o.type==="ready"){if(l=o.payload,F=zt(o.payload.session),O(d,o.payload),O(S,o.payload.directory),O(U,o.payload.session),F)O(m,F);if(O(D,o.payload.connection),O(G,o.payload.settings),O(ae,o.payload.item),o.payload.block)O(fe,o.payload.block);Yt();return}if(o.type==="service-event"){O(Ae,o.payload);return}if(o.type==="generate-late"){if(Y.size===0)Qe.push(o.payload);else O(Y,o.payload);return}if(o.type==="directory"){if(l)l={...l,directory:o.payload.directory};O(S,o.payload.directory);return}if(o.type==="session"){if(l)l={...l,session:o.payload.session};if(!o.payload.session)F=null;else if(F?.sessionId!==o.payload.session.id)F=zt(o.payload.session);O(U,o.payload.session);return}if(o.type==="session-lifecycle"){F=o.payload,O(m,o.payload);return}if(o.type==="connection"){if(l)l={...l,connection:o.payload.connection};O(D,o.payload.connection);return}if(o.type==="settings"){if(l)l={...l,settings:o.payload.settings};O(G,o.payload.settings);return}if(o.type==="item"){if(l)l={...l,item:o.payload.item};O(ae,o.payload.item);return}if(o.type==="status-control-event"){O(Oe,o.payload);return}if(o.type==="popover-closed"){O(Re,o.payload);return}if(o.type==="action"){let i=(A)=>{if(!X)M({channel:E,v:T,type:"action-result",id:o.id,payload:A})},f=de;if(!f){i({ok:!1,error:"This extension does not handle background actions."});return}Promise.resolve().then(()=>f(o.payload)).then(()=>i({ok:!0}),(A)=>{let R=(A instanceof Error?A.message:String(A)).trim();i({ok:!1,error:(R||"Action failed.").slice(0,Ee)})});return}if(o.type==="file-open"){let i=o.payload;if(_e&&To(_e,i))return;_e=i,O(he,o.payload);return}if(o.type==="file-saved"){O(me,o.payload.version);return}if(o.type==="file-snapshot"){let i=(R)=>{if(!X)M({channel:E,v:T,type:"file-snapshot-result",id:o.id,payload:R})},f=(R)=>i({error:(R.trim()||"Could not read the edited file.").slice(0,Ee)}),A=le;if(!A){f("This extension does not edit files.");return}Promise.resolve().then(()=>A(o.payload.purpose)).then((R)=>{if(dt(R)>Ce){f(`The file is over ${Ce} ${"bytes"in R?"bytes":"characters"}.`);return}if(R.version.length>ke){f(`The snapshot version is over ${ke} characters.`);return}i({snapshot:"bytes"in R?{bytes:R.bytes,version:R.version}:{content:R.content,version:R.version}})},(R)=>f(R instanceof Error?R.message:String(R)));return}if(o.type==="resolve"){let i=(A)=>{M({channel:E,v:T,type:"resolve-result",id:o.id,payload:A})},f=ce;if(!f){i({error:"This extension does not resolve commands."});return}Promise.resolve().then(()=>f(o.payload)).then((A)=>i({item:A?te(A):null}),(A)=>{let R=(A instanceof Error?A.message:String(A)).trim();i({error:(R||"Command failed.").slice(0,Ee)})});return}let a=Q.get(o.id);if(!a)return;if(clearTimeout(a.timer),Q.delete(o.id),o.ok){a.resolve(o.payload);return}a.reject(new c(o.code,o.error))};r.addEventListener("message",Qt),M({channel:E,v:T,type:"hello"});let C=(t,o=u)=>{if(X||r.parent===r)return Promise.reject(new c("HOST_UNAVAILABLE","No host frame. This page is not in an iframe."));return new Promise((a,i)=>{let f=setTimeout(()=>{Q.delete(t.id),i(new c("HOST_TIMEOUT","Host did not answer in time."))},o);Q.set(t.id,{resolve:a,reject:i,timer:f}),M(t)})},b=(t)=>C(t).then(()=>{return}),I={channel:E,v:T},Ze=(t)=>{if(!X&&r.parent!==r)M(t)},Jt=()=>Ze({...I,type:"file-save"}),qe=()=>{if(!X&&r.parent!==r)M({...I,type:"microphone-close",id:p(_)})},sr=async()=>{if(L)throw new c("HOST_REJECTED","The microphone is already open in this frame.");if(l?.features?.microphone!==!0)throw new c("UNSUPPORTED","This OpenChamber cannot share the microphone with extensions.");let t=globalThis.AudioContext;if(typeof t!=="function")throw new c("UNSUPPORTED","This frame has no Web Audio.");let o=new t;if(o.sampleRate<st||o.sampleRate>it)throw o.close().catch(()=>{return}),new c("UNSUPPORTED",`Audio at ${o.sampleRate} Hz is not supported.`);let a=o.state==="suspended"?o.resume().catch(()=>{return}):void 0,i=io(Math.round(o.sampleRate/4)),f=o.createScriptProcessor(1024,1,1);f.onaudioprocess=(w)=>i.pull(w.outputBuffer.getChannelData(0));let A=o.createMediaStreamDestination();f.connect(A);let R=new Set,q={queue:i,endedListeners:R,release:()=>{f.onaudioprocess=null,f.disconnect(),i.clear();for(let w of A.stream.getTracks())w.stop();o.close().catch(()=>{return})}};L=q;try{let w=await C({...I,type:"microphone-open",id:p(_),payload:{sampleRate:o.sampleRate}},at);if(!w||!("opened"in w)||w.opened!==!0)throw new c("HOST_REJECTED","Host did not open the microphone.");if(await a,L!==q)throw new c("DISCONNECTED","The microphone closed while it was opening.")}catch(w){if(L===q)L=null;throw q.release(),qe(),w}return{stream:A.stream,close:()=>{if(L!==q)return;L=null,q.release(),qe()},onEnded:(w)=>(R.add(w),()=>{R.delete(w)})}},Zt=(t)=>{if(!Ho(t)||!Tr(t))return;t.preventDefault(),Jt()},qt=(t)=>{if(!Ho(t)||t.key!=="Escape"||l?.surface!=="popover"||!l.popover)return;t.preventDefault(),ro(l.popover.id,"escape").catch(()=>{return})},Ie=()=>{let t=l?.surface==="popover"?l.popover:void 0;if(!t)return;let o=pe||ue;if(jt===o)return;jt=o,no(t.id,o).catch(()=>{return})},xe=()=>{if(l?.surface!=="popover"||pe)return;pe=!0,Ie()},eo=(t)=>{if(l?.surface!=="popover"||t.relatedTarget!==null||!pe)return;pe=!1,Ie()},to=()=>{if(l?.surface!=="popover"||ue)return;ue=!0,Ie()},oo=()=>{if(l?.surface!=="popover"||!ue)return;ue=!1,Ie()},H=(t,o=1024)=>{if(!t.trim()||t.length>o)throw new c("HOST_REJECTED",`Identity must contain 1 to ${o} characters.`)},et=async(t)=>{if(t.kind!=="projects")H(t.projectId);let o=await C({...I,type:"workspace-read",id:p(_),payload:t});if(!o||!("kind"in o)||!("state"in o)||o.kind!==t.kind)throw new c("HOST_REJECTED","Host did not return workspace data.");return o},tt=async(t,o)=>{if(t.kind!=="projects")H(t.projectId);let a=p(_);J.set(a,o);try{await b({...I,type:"workspace-subscribe",id:p(_),payload:{subscriptionId:a,query:t}})}catch(i){if(J.delete(a),!X)M({...I,type:"workspace-unsubscribe",id:p(_),payload:{subscriptionId:a}});throw i}return()=>{if(!J.delete(a)||X)return;M({...I,type:"workspace-unsubscribe",id:p(_),payload:{subscriptionId:a}})}},ir=async(t,o)=>{if(t.kind==="session")H(t.sessionId);if(t.kind==="project")H(t.projectId);let a=p(_);Z.set(a,o);try{await b({...I,type:"shells-subscribe",id:p(_),payload:{subscriptionId:a,scope:t}})}catch(i){if(Z.delete(a),!X)M({...I,type:"shells-unsubscribe",id:p(_),payload:{subscriptionId:a}});throw i}return()=>{if(!Z.delete(a)||X)return;M({...I,type:"shells-unsubscribe",id:p(_),payload:{subscriptionId:a}})}},ge=async(t)=>{if("key"in t&&(t.key.length===0||t.key.length>rt))throw new c("HOST_REJECTED","Storage key must contain 1 to 128 characters.");if(t.op==="set"&&!ee(t.value))throw new c("HOST_REJECTED","Storage values must be JSON.");if(t.op==="set"&&new TextEncoder().encode(JSON.stringify(t.value)).length>nt)throw new c("HOST_REJECTED","Storage value exceeds 64 KiB.");if(t.scope==="device"&&l?.features?.deviceStorage!==!0)throw new c("UNSUPPORTED","This host does not support device storage.");let o=await C({...I,type:"storage",id:p(_),payload:t});if(!o||!("storage"in o)||o.op!==t.op)throw new c("HOST_REJECTED","Host did not return storage data.");return o},ro=(t,o)=>l?.features?.popovers!==!0&&!(l?.surface==="popover"&&l.popover?.id===t)?Promise.reject(new c("UNSUPPORTED","This host does not support popovers.")):b({...I,type:"popover-close",id:p(_),payload:o?{id:t,reason:o}:{id:t}}),no=(t,o)=>l?.features?.popovers!==!0&&!(l?.surface==="popover"&&l.popover?.id===t)?Promise.reject(new c("UNSUPPORTED","This host does not support popovers.")):b({...I,type:"popover-anchor",id:p(_),payload:{id:t,active:o}});return r.addEventListener("keydown",qt,!0),r.addEventListener("pointerover",xe),r.addEventListener("pointermove",xe),r.addEventListener("pointerout",eo),r.addEventListener("focus",to),r.addEventListener("blur",oo),{onAction:(t)=>(de=t,()=>{if(de===t)de=null}),listProjects:async()=>{let t=await et({kind:"projects"});if(t.kind!=="projects")throw new c("HOST_REJECTED","Expected projects.");return t},listWorktrees:async(t)=>{let o=await et({kind:"worktrees",projectId:t});if(o.kind!=="worktrees")throw new c("HOST_REJECTED","Expected worktrees.");return o},listSessions:async(t)=>{let o=await et({kind:"sessions",projectId:t});if(o.kind!=="sessions")throw new c("HOST_REJECTED","Expected sessions.");return o},onProjects:(t)=>tt({kind:"projects"},(o)=>{if(o.kind==="projects")t(o)}),onWorktrees:(t,o)=>tt({kind:"worktrees",projectId:t},(a)=>{if(a.kind==="worktrees")o(a)}),onSessions:(t,o)=>tt({kind:"sessions",projectId:t},(a)=>{if(a.kind==="sessions")o(a)}),onRunningShells:(t,o)=>ir(t,o),readShellOutput:async(t,o)=>{H(t,be);let a=o?.cursor;if(a!==void 0&&(!Number.isInteger(a)||a<0))throw new c("HOST_REJECTED","Shell output cursor must be a non-negative integer.");let i=o?.tailBytes;if(i!==void 0&&(!Number.isInteger(i)||i<1||i>Ue))throw new c("HOST_REJECTED",`Shell output tailBytes must be an integer between 1 and ${Ue}.`);let A=await C({...I,type:"shell-output",id:p(_),payload:{shellId:t,cursor:a,tailBytes:i}});if(!A||typeof A.output!=="string"||!Number.isFinite(A.cursor))throw new c("HOST_REJECTED","Host did not return shell output.");return A},stopShell:async(t)=>{if(H(t,be),(await C({...I,type:"shell-stop",id:p(_),payload:{shellId:t}}))?.stopped!==!0)throw new c("HOST_REJECTED","Host did not stop the shell.");return{stopped:!0}},openSession:async(t)=>{H(t),await b({...I,type:"open-session",id:p(_),payload:{sessionId:t}})},storage:{get:async(t,o)=>{let a=Xe(o),i={op:"get",key:t};if(a)i.scope=a;let f=await ge(i);return f.op==="get"&&f.found?f.value:void 0},set:async(t,o,a)=>{let i=Xe(a),f={op:"set",key:t,value:o};if(i)f.scope=i;await ge(f)},delete:async(t,o)=>{let a=Xe(o),i={op:"delete",key:t};if(a)i.scope=a;await ge(i)},keys:async(t)=>{let o=Xe(t),a={op:"keys"};if(o)a.scope=o;let i=await ge(a);if(i.op!=="keys")throw new c("HOST_REJECTED","Expected storage keys.");return i.keys}},onReady:(t)=>{if(d.add(t),l)t(l);return()=>{d.delete(t)}},onDirectory:(t)=>{if(S.add(t),l)t(l.directory);return()=>{S.delete(t)}},onSession:(t)=>{if(U.add(t),l)t(l.session);return()=>{U.delete(t)}},onSessionLifecycle:(t)=>{if(m.add(t),F)t(F);return()=>{m.delete(t)}},onConnection:(t)=>{if(D.add(t),l)t(l.connection);return()=>{D.delete(t)}},onSettings:(t)=>{if(G.add(t),l)t(l.settings);return()=>{G.delete(t)}},onItem:(t)=>{if(ae.add(t),l)t(l.item);return()=>{ae.delete(t)}},onBlock:(t)=>{if(fe.add(t),l?.block)t(l.block);return()=>{fe.delete(t)}},onServiceEvent:(t)=>(Ae.add(t),()=>{Ae.delete(t)}),onStatusControl:(t)=>(Oe.add(t),()=>{Oe.delete(t)}),onPopoverClosed:(t)=>(Re.add(t),()=>{Re.delete(t)}),setStatusControls:(t)=>{if(l?.features?.statusControls!==!0)return Promise.reject(new c("UNSUPPORTED","This host does not support status controls."));if(!po(t))return Promise.reject(new c("HOST_REJECTED","Status controls must have unique bounded ids and valid selected options."));return b({...I,type:"status-controls",id:p(_),payload:{controls:t}})},openPopover:(t)=>{if(l?.features?.popovers!==!0)return Promise.reject(new c("UNSUPPORTED","This host does not support popovers."));if(!_t(t))return Promise.reject(new c("HOST_REJECTED","Popover requests need bounded geometry and JSON data."));return b({...I,type:"popover-open",id:p(_),payload:t})},closePopover:ro,setPopoverAnchorActive:no,onResolve:(t)=>(ce=t,()=>{if(ce===t)ce=null}),toast:(t)=>{let o=t.message.trim();if(!o||o.length>Me)return Promise.reject(new c("HOST_REJECTED",`Toast message must contain 1 to ${Me} characters.`));if(t.copy&&t.copy!==!0&&(!t.copy.text.length||t.copy.text.length>Ne))return Promise.reject(new c("HOST_REJECTED",`Toast copy text must contain 1 to ${Ne} characters.`));return b({channel:E,v:T,type:"toast",id:p(_),payload:{...t,message:o}})},openUrl:(t)=>b({channel:E,v:T,type:"open-url",id:p(_),payload:{url:t}}),...ho(b,()=>p(_),(t)=>Promise.reject(new c("HOST_REJECTED",t))),answerBlock:(t)=>b({channel:E,v:T,type:"block-answer",id:p(_),payload:{text:t.trim().slice(0,Et)}}),openSurface:(t)=>b({channel:E,v:T,type:"open-surface",id:p(_),payload:{surfaceId:t}}),writeClipboard:(t)=>b({channel:E,v:T,type:"clipboard-write",id:p(_),payload:{text:t}}),compose:(t)=>b({channel:E,v:T,type:"compose",id:p(_),payload:t}),attach:(t)=>b({channel:E,v:T,type:"attach",id:p(_),payload:te(t)}),startSession:async(t)=>{if(t.projectId!==void 0)H(t.projectId);let o=t.worktree;if(o&&o!==!0)if(o.kind==="existing")H(o.directory);else{if(o.name!==void 0)H(o.name,200);if(o.baseBranch!==void 0)H(o.baseBranch,200)}let a=await C({channel:E,v:T,type:"start-session",id:p(_),payload:Rt(t)},e.requestTimeoutMs??180000);if(!Tt(a))throw new c("HOST_REJECTED","Host did not return a session.");return a},prompt:(t)=>C({channel:E,v:T,type:"prompt",id:p(_),payload:ht(t)}).then((o)=>{if(!St(o))throw new c("HOST_REJECTED","Host did not return a prompt result.");return o}),sessionLink:(t)=>b({channel:E,v:T,type:"session-link",id:p(_),payload:te(t)}),close:()=>b({channel:E,v:T,type:"close",id:p(_)}),oauthStart:()=>b({channel:E,v:T,type:"oauth-start",id:p(_)}),oauthDisconnect:()=>b({channel:E,v:T,type:"oauth-disconnect",id:p(_)}),request:(t)=>(we(t.path)?C({channel:E,v:T,type:"request",id:p(_),payload:t}):Vo()).then((o)=>{if(!De(o))throw new c("HOST_REJECTED","Host request result was empty.");return o}),serviceRequest:(t)=>(we(t.path)?C({channel:E,v:T,type:"service-request",id:p(_),payload:t}):Vo()).then((o)=>{if(!De(o))throw new c("HOST_REJECTED","Host service request result was empty.");return o}),serviceStatus:()=>C({channel:E,v:T,type:"service-status",id:p(_)}).then((t)=>{if(!xt(t))throw new c("HOST_REJECTED","Host did not return service status.");return t}),readFile:(t)=>(oe(t)?C({channel:E,v:T,type:"file-read",id:p(_),payload:{path:t}}):Ge()).then((o)=>{if(!gt(o))throw new c("HOST_REJECTED","Host did not return file content.");return o}),writeFile:(t,o)=>{if(!oe(t))return Ge();if(o.length>ve)return Promise.reject(new c("FILE_TOO_LARGE",`Content is over ${ve} characters.`));return C({channel:E,v:T,type:"file-write",id:p(_),payload:{path:t,content:o}}).then((a)=>{if(!bt(a))throw new c("HOST_REJECTED","Host did not confirm the write.");return a})},listDir:(t)=>(oe(t)?C({channel:E,v:T,type:"file-list",id:p(_),payload:{path:t}}):Ge()).then((o)=>{if(!Ut(o))throw new c("HOST_REJECTED","Host did not return directory entries.");return o}),stat:(t)=>(oe(t)?C({channel:E,v:T,type:"file-stat",id:p(_),payload:{path:t}}):Ge()).then((o)=>{if(!Ct(o))throw new c("HOST_REJECTED","Host did not return file status.");return o}),generate:(t)=>{let o=t.prompt.trim(),a=t.system?.trim();if(o.length===0||o.length>Le)return Promise.reject(new c("HOST_REJECTED",`Prompt must be 1 to ${Le} characters.`));if(a!==void 0&&(a.length===0||a.length>Pe))return Promise.reject(new c("HOST_REJECTED",`System prompt must be 1 to ${Pe} characters.`));let i=t.maxOutputTokens===void 0?void 0:Math.min(At,Math.max(1,Math.floor(t.maxOutputTokens)));if(i!==void 0&&!Number.isFinite(i))return Promise.reject(new c("HOST_REJECTED","maxOutputTokens must be a number."));let f={prompt:o};if(a!==void 0)f.system=a;if(i!==void 0)f.maxOutputTokens=i;return C({channel:E,v:T,type:"generate",id:p(_),payload:f},e.requestTimeoutMs??Ot).then((A)=>{if(!kt(A))throw new c("HOST_REJECTED","Host did not return generated text.");return A})},onLateGenerateResult:(t)=>{Y.add(t);for(let o of Qe.splice(0))O([t],o);return Yt(),()=>{Y.delete(t)}},openMicrophone:sr,setBadge:(t)=>b({channel:E,v:T,type:"badge",id:p(_),payload:{count:mt(t)}}),setHeight:(t)=>b({channel:E,v:T,type:"resize",id:p(_),payload:{height:It(t)}}),onFileOpen:(t)=>{if(he.add(t),!Je)Je=!0,r.addEventListener("keydown",Zt,!0);if(_e)t(_e);return()=>{he.delete(t)}},onFileSnapshot:(t)=>(le=t,()=>{if(le===t)le=null}),onFileSaved:(t)=>(me.add(t),()=>{me.delete(t)}),reportFileChange:(t)=>Ze({...I,type:"file-change",payload:{dirty:t.dirty,edited:t.edited}}),requestFileSave:Jt,reportFileUnsupported:()=>Ze({...I,type:"file-unsupported"}),dispose:()=>{for(let t of J.keys())M({...I,type:"workspace-unsubscribe",id:p(_),payload:{subscriptionId:t}});J.clear();for(let t of Z.keys())M({...I,type:"shells-unsubscribe",id:p(_),payload:{subscriptionId:t}});if(Z.clear(),L)qe(),L.release(),L=null;if(X=!0,ce=null,de=null,le=null,he.clear(),me.clear(),Je)r.removeEventListener("keydown",Zt,!0);r.removeEventListener("message",Qt),r.removeEventListener("keydown",qt,!0),r.removeEventListener("pointerover",xe),r.removeEventListener("pointermove",xe),r.removeEventListener("pointerout",eo),r.removeEventListener("focus",to),r.removeEventListener("blur",oo);for(let t of Q.values())clearTimeout(t.timer),t.reject(new c("HOST_UNAVAILABLE","Host client was disposed."));Q.clear(),d.clear(),S.clear(),U.clear(),m.clear(),D.clear(),G.clear(),ae.clear(),fe.clear(),Ae.clear(),Oe.clear(),Re.clear(),Y.clear(),Qe.length=0}}};var $o=["browser.open","browser.snapshot","browser.click","browser.type","browser.select","browser.scroll","browser.back","browser.forward","browser.inspect","browser.capture","browser.resize","browser.close"];var En=new Set($o);var Fo=["none","agent","user"];var Sn=new Set(Fo);var Sr=[["--oc-bg","background"],["--oc-elevated","elevated"],["--oc-fg","foreground"],["--oc-muted","muted"],["--oc-subtle","subtle"],["--oc-border","border"],["--oc-hover","hover"],["--oc-selection","selection"],["--oc-focus","focus"],["--oc-primary","primary"],["--oc-muted-surface","mutedSurface"],["--oc-elevated-fg","elevatedForeground"],["--oc-active","active"],["--oc-selection-fg","selectionForeground"],["--oc-primary-fg","primaryForeground"],["--oc-primary-text","primaryText"],["--oc-success-text","successText"],["--oc-warning-text","warningText"],["--oc-error-text","errorText"],["--oc-info-text","infoText"],["--oc-success","success"],["--oc-warning","warning"],["--oc-error","error"],["--oc-info","info"],["--oc-font","font"],["--oc-mono","mono"],["--oc-radius","radius"],["--surface-background","background"],["--surface-elevated","elevated"],["--surface-foreground","foreground"],["--surface-muted-foreground","muted"],["--surface-subtle","subtle"],["--interactive-border","border"],["--interactive-hover","hover"],["--interactive-selection","selection"],["--interactive-focus-ring","focus"],["--primary","primary"],["--surface-muted","mutedSurface"],["--surface-elevated-foreground","elevatedForeground"],["--interactive-active","active"],["--interactive-selection-foreground","selectionForeground"],["--primary-foreground","primaryForeground"],["--primary-text","primaryText"],["--success-text","successText"],["--warning-text","warningText"],["--error-text","errorText"],["--info-text","infoText"],["--status-success","success"],["--status-warning","warning"],["--status-error","error"],["--status-info","info"],["--font-sans","font"],["--font-mono","mono"],["--radius","radius"]],fr=[["--oc-syntax-keyword","--syntax-keyword","syntaxKeyword"],["--oc-syntax-string","--syntax-string","syntaxString"],["--oc-syntax-number","--syntax-number","syntaxNumber"],["--oc-syntax-function","--syntax-function","syntaxFunction"],["--oc-syntax-type","--syntax-type","syntaxType"],["--oc-syntax-comment","--syntax-comment","syntaxComment"],["--oc-syntax-variable","--syntax-variable","syntaxVariable"],["--oc-syntax-operator","--syntax-operator","syntaxOperator"]],Bo=(e,r)=>{r.style.colorScheme=e.mode;for(let[s,u]of Sr)r.style.setProperty(s,e.tokens[u]);for(let[s,u,d]of fr){let S=e.tokens[d]??"";r.style.setProperty(s,S),r.style.setProperty(u,S)}r.style.setProperty("font-family",e.tokens.font),r.style.setProperty("font-size",e.tokens.fontSize??"0.875rem"),r.style.setProperty("line-height","1.45"),r.style.setProperty("color",e.tokens.foreground)},yt=(e,r)=>{if(Bo(e.theme,r),r.dataset)r.dataset.ocSurface=e.surface,r.dataset.ocTheme=e.theme.mode};var Ar={"surface-background":"bg","surface-elevated":"elevated","surface-elevated-foreground":"elevated-fg","surface-foreground":"fg","surface-muted-foreground":"muted","surface-muted":"muted-surface","surface-subtle":"subtle","interactive-border":"border","interactive-hover":"hover","interactive-active":"active","interactive-selection":"selection","interactive-selection-foreground":"selection-fg","interactive-focus-ring":"focus",primary:"primary","primary-foreground":"primary-fg","primary-text":"primary-text","success-text":"success-text","warning-text":"warning-text","error-text":"error-text","info-text":"info-text","status-success":"success","status-warning":"warning","status-error":"error","status-info":"info","font-sans":"font","font-mono":"mono",radius:"radius"},h=(e,r)=>`var(--${e}, var(--oc-${Ar[e]}, ${r}))`,K=h("surface-background","transparent"),Ve=h("surface-elevated","transparent"),re=h("surface-elevated-foreground","inherit"),P=h("surface-foreground","inherit"),x=h("surface-muted-foreground","gray"),Or=h("surface-muted","transparent"),j=h("interactive-border","currentColor"),N=h("interactive-hover","transparent"),z=h("interactive-active","transparent"),vt=h("interactive-selection","transparent"),Lt=h("interactive-selection-foreground","inherit"),B=h("primary","currentColor"),Pt=h("primary-text","inherit"),wt=h("error-text","inherit"),Rr=h("font-sans","inherit"),Dt=h("font-mono","monospace"),zo=h("radius","9px"),Gt=`calc(${zo} - 2px)`,Ko=`calc(${zo} - 4px)`,g=(e,r,s="transparent")=>`color-mix(in srgb, ${e} ${r}%, ${s})`,Wo=`background-image: linear-gradient(${N}, ${N});`,Xt=(e,r="0.5px")=>`box-shadow: inset 0 0 0 ${r} ${e}, var(--oc-sdk-field-lift);`,Ht="border-color: var(--oc-sdk-edge); box-shadow: var(--oc-sdk-raised-lift);",jo="box-shadow: var(--oc-sdk-lit);",Vt=`inset 0 0.5px 0 0 ${g(P,8)}, 0 1px 2px 0 rgb(0 0 0 / 0.4)`,hr=`
:root {
  --oc-sdk-edge: ${g(P,16)};
  --oc-sdk-field-bg: ${Ve};
  --oc-sdk-raised-bg: ${K};
  --oc-sdk-field-lift: inset 0 1px 2px 0 rgb(0 0 0 / 0.04);
  --oc-sdk-raised-lift: 0 1px 1.5px 0 rgb(0 0 0 / 0.08);
  --oc-sdk-lit: inset 0 1px 0 0 rgb(255 255 255 / 0.2), 0 1px 1.5px 0 rgb(0 0 0 / 0.1);
  --oc-sdk-float-edge: rgb(0 0 0 / 0.14);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.7), 0 1px 2px -0.5px rgb(0 0 0 / 0.06), 0 4px 8px -2px rgb(0 0 0 / 0.08), 0 12px 20px -4px rgb(0 0 0 / 0.06);
}
:root[data-oc-theme="dark"] {
  --oc-sdk-edge: ${g(P,14)};
  --oc-sdk-field-bg: ${g(K,50,Ve)};
  --oc-sdk-raised-bg: ${Ve};
  --oc-sdk-field-lift: ${Vt};
  --oc-sdk-raised-lift: ${Vt};
  --oc-sdk-lit: ${Vt};
  --oc-sdk-float-edge: rgb(0 0 0 / 0.55);
  --oc-sdk-float: inset 0 1px 0 0 rgb(255 255 255 / 0.04), inset 0 0 0 0.5px rgb(255 255 255 / 0.08), 0 8px 16px 0 rgb(0 0 0 / 0.25), 0 4px 8px 0 rgb(0 0 0 / 0.25);
}`,He=(e)=>{let r=h(`status-${e}`,"currentColor");return`
.oc-sdk[data-tone="${e}"], .oc-sdk [data-tone="${e}"] { --oc-sdk-tone: ${r}; --oc-sdk-tone-text: ${h(`${e}-text`,"inherit")}; }`},n=(e)=>`calc(${e}rem / 14)`,mr=`
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
`,Yo=`${hr}
.oc-sdk { color: ${P}; font-family: ${Rr}; }
.oc-sdk :focus-visible, .oc-sdk:focus-visible { outline: none; }
.oc-sdk :where(button, a[href], [role="button"], [role="tab"], [role="option"]):focus-visible, button.oc-sdk:focus-visible { ${Wo} }
.oc-sdk-mono { font-family: ${Dt}; }
.oc-sdk-muted { color: ${x}; }
${He("success")}${He("warning")}${He("error")}${He("info")}
.oc-sdk[data-tone="primary"], .oc-sdk [data-tone="primary"] { --oc-sdk-tone: ${B}; --oc-sdk-tone-text: ${Pt}; }

.oc-sdk-btn { border-radius: ${Gt}; transition: background 150ms ease-out, color 150ms ease-out; }
.oc-sdk-btn[data-size="xs"] { border-radius: ${Ko}; }
.oc-sdk-btn[data-variant="default"] { color: ${Pt}; background: ${g(B,10,K)}; border-color: ${g(B,12)}; ${jo} }
.oc-sdk-btn[data-variant="default"]:hover { background: ${g(B,16,K)}; }
.oc-sdk-btn[data-variant="default"]:active { background: ${g(B,22,K)}; box-shadow: none; }
.oc-sdk-btn[data-variant="secondary"] { background: ${Or}; color: var(--oc-fg); }
.oc-sdk-btn[data-variant="secondary"]:hover { background-image: linear-gradient(${N}, ${N}); }
.oc-sdk-btn[data-variant="secondary"]:active { background-image: linear-gradient(${z}, ${z}); }
.oc-sdk-btn[data-variant="outline"] { background: var(--oc-sdk-raised-bg); color: ${re}; ${Ht} }
.oc-sdk-btn[data-variant="outline"]:hover { background-image: linear-gradient(${N}, ${N}); }
.oc-sdk-btn[data-variant="outline"]:active { background-image: linear-gradient(${z}, ${z}); box-shadow: none; }
.oc-sdk-btn[data-variant="ghost"] { background: transparent; }
.oc-sdk-btn[data-variant="ghost"]:hover { background: ${N}; }
.oc-sdk-btn[data-variant="ghost"]:active { background: ${z}; }
.oc-sdk-btn[data-variant="destructive"] { --oc-sdk-tone: ${h("status-error","red")}; color: ${wt}; background: ${g("var(--oc-sdk-tone)",7,K)}; border-color: ${g("var(--oc-sdk-tone)",12)}; ${jo} }
.oc-sdk-btn[data-variant="destructive"]:hover { background: ${g("var(--oc-sdk-tone)",9,K)}; }
.oc-sdk-btn[data-variant="destructive"]:active { background: ${g("var(--oc-sdk-tone)",11,K)}; box-shadow: none; }

.oc-sdk-field-note { color: ${x}; }
.oc-sdk-field[data-invalid="true"] .oc-sdk-field-note { color: ${wt}; }
.oc-sdk-input { border-radius: ${Gt}; background: var(--oc-sdk-field-bg); color: ${re}; ${Xt("var(--oc-sdk-edge)")} transition: background 150ms ease-out; }
.oc-sdk-input::placeholder { color: ${x}; }
.oc-sdk-input:hover:not(:focus) { background-image: linear-gradient(${N}, ${N}); }
.oc-sdk-input:focus, .oc-sdk-input:focus-visible { ${Xt(g(P,26),"1px")} }
.oc-sdk-field[data-invalid="true"] .oc-sdk-input, .oc-sdk-field[data-invalid="true"] .oc-sdk-input:focus { ${Xt(h("status-error","red"),"1px")} }
.oc-sdk-input[data-mono="true"] { font-family: ${Dt}; }

.oc-sdk-search-icon { color: ${x}; }
.oc-sdk-search[data-active="true"] .oc-sdk-search-icon { color: ${B}; }
.oc-sdk-search-clear { border-radius: ${Ko}; color: ${x}; }
.oc-sdk-search-clear:hover { background: ${N}; color: ${P}; }

.oc-sdk-trigger { border-radius: ${Gt}; background: var(--oc-sdk-raised-bg); color: ${re}; ${Ht} transition: background 150ms ease-out; }
.oc-sdk-trigger:hover { background-image: linear-gradient(${N}, ${N}); }
.oc-sdk-trigger[aria-expanded="true"] { background-image: linear-gradient(${z}, ${z}); }
.oc-sdk-trigger-value[data-empty="true"] { color: ${x}; }
.oc-sdk-trigger-chevron { color: ${x}; }
/* The app's floating level: the glass edge (a hairline ring and a lit top line, dark outside and light inside in dark themes) over soft shadows. The outer ring is the border, over the page like the app's. */
.oc-sdk-popup { --surface-foreground: ${re}; border-color: var(--oc-sdk-float-edge); border-radius: 12px; background: ${Ve}; background-clip: padding-box; color: ${re}; box-shadow: var(--oc-sdk-float); }
.oc-sdk-option { border-radius: 8px; }
.oc-sdk-option[data-active="true"] { background: ${N}; }
/* A selected option shows a check mark in the text colour, like the app's own pickers. Options without the mark come
   from bundles built before it existed and keep the selection fill as their only sign of the choice. */
.oc-sdk-option[aria-selected="true"]:not([data-mark]) { background: ${vt}; color: ${Lt}; }
.oc-sdk-option-check { color: ${P}; }
.oc-sdk-option[data-destructive="true"] { color: ${wt}; }
.oc-sdk-option[data-destructive="true"][data-active="true"] { background: ${g(h("status-error","red"),10)}; }
.oc-sdk-option-hint { color: ${x}; }
.oc-sdk-popup-empty { color: ${x}; }

/* Checked stays neutral: the mark carries the state, and the primary colour stays with primary actions. */
.oc-sdk-check-box { border-color: ${j}; border-radius: 4px; color: ${P}; transition: border-color 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-box { border-color: ${g(P,60,j)}; }
.oc-sdk-check-thumb { border-radius: 9999px; background: ${j}; transition: background 150ms ease-out; }
.oc-sdk-check-thumb::after { border-radius: 9999px; background: ${K}; transition: transform 150ms ease-out; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb { background: ${B}; }
.oc-sdk-check[aria-checked="true"] .oc-sdk-check-thumb::after { transform: translateX(var(--oc-sdk-thumb-travel, 16px)); }
.oc-sdk-check:focus-visible { box-shadow: none; }
.oc-sdk-check:focus-visible .oc-sdk-check-box, .oc-sdk-check:focus-visible .oc-sdk-check-thumb { ${Wo} }
.oc-sdk-check-desc { color: ${x}; }

.oc-sdk-tabs { border-radius: 10px; }
.oc-sdk-tabs[data-track="true"] { background: ${g(P,4)}; box-shadow: inset 0 1px 2px 0 rgb(0 0 0 / 0.16); }
.oc-sdk-tab { border-radius: 8px; color: ${x}; transition: color 150ms ease-out, background 150ms ease-out; }
.oc-sdk-tab:hover { color: ${P}; }
.oc-sdk-tab[aria-selected="true"] { color: ${Lt}; background: ${vt}; border-color: ${j}; }
.oc-sdk-tabs[data-track="true"] .oc-sdk-tab[aria-selected="true"] { color: ${re}; background: var(--oc-sdk-raised-bg); ${Ht} }
.oc-sdk-tab-count { color: ${x}; }

/* The app's neutral badge: a step of the text colour, the same in every theme. */
.oc-sdk-badge { border-radius: 9999px; background: ${g(P,6)}; color: ${x}; }
.oc-sdk-badge[data-tone] { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); background: ${g("var(--oc-sdk-tone)",15)}; }

.oc-sdk-row { border-radius: 6px; transition: background 120ms ease-out; }
.oc-sdk-row:hover, .oc-sdk-row[data-active="true"] { background: ${N}; }
.oc-sdk-row[aria-selected="true"] { background: ${vt}; color: ${Lt}; }
.oc-sdk-row-lead { font-family: ${Dt}; color: ${x}; }
.oc-sdk-row-sub { color: ${x}; }
.oc-sdk-row-meta { color: ${x}; }
.oc-sdk-row[aria-selected="true"] .oc-sdk-row-lead, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-sub, .oc-sdk-row[aria-selected="true"] .oc-sdk-row-meta { color: inherit; opacity: .75; }
.oc-sdk-list-empty { color: ${x}; }

.oc-sdk-empty-body { color: ${x}; }

.oc-sdk-spinner { color: ${x}; }
.oc-sdk-spinner-ring { border-color: ${j}; border-top-color: ${B}; border-radius: 9999px; }

/* Set apart by its tint alone, like the app's banners. */
.oc-sdk-banner { border-color: transparent; border-radius: 8px; background: ${g("var(--oc-sdk-tone)",10)}; }
.oc-sdk-banner-title { color: var(--oc-sdk-tone-text, var(--oc-sdk-tone)); }
.oc-sdk-banner-body { color: ${x}; }

.oc-sdk-separator { color: ${x}; }
.oc-sdk-separator::before, .oc-sdk-separator::after { background: ${g(j,40)}; }

.oc-sdk-progress-label { color: ${x}; }
/* The app's progress: a groove a step of the text colour, green once done. Older bundles mark done only through aria-valuenow. */
.oc-sdk-progress-track { border-radius: 9999px; background: ${g(P,6)}; }
.oc-sdk-progress-fill { border-radius: 9999px; background: var(--oc-sdk-tone, ${B}); }
.oc-sdk-progress-track[aria-valuenow="100"] > .oc-sdk-progress-fill:not([data-tone]) { background: ${h("status-success","currentColor")}; }
.oc-sdk-progress[data-done="true"] .oc-sdk-progress-value { color: ${h("success-text","inherit")}; }

.oc-sdk-text a { color: ${Pt}; text-decoration: underline; text-underline-offset: 2px; }
.oc-sdk-text img { border-radius: 8px; border: 1px solid ${g(j,60)}; }
`,k=`
${ot}
${mr}
${Yo}`;function Zo(e){let r=e?.indexOf("/")??-1;if(!e||r<0)return null;return e.slice(0,r)==="antigravity-acp"?e.slice(r+1):null}function Ur(e,r){let s=/gemini/i.test(e);return/^gemini/i.test(r)?s:!s}function Cr(e){return e.replace(/\s+models?$/i,"").replace(/\s+and\s+/i," & ").trim()||e}var Qo=["5h","daily","weekly"],kr={"5h":"5-hour",daily:"Daily",weekly:"Weekly"};function Mr(e){if(e===null)return"muted";if(e<20)return"error";if(e<50)return"warning";return"success"}function Nr(e,r){let s=r.usedPercent,u=typeof s==="number"&&Number.isFinite(s)?Math.round(Math.max(0,Math.min(100,100-s))):null;return{key:e,label:kr[e]??e.replace(/_/g," "),remaining:u,tone:Mr(u),resetAt:typeof r.resetAt==="number"?r.resetAt:null}}var Jo=(e)=>{let r=Qo.indexOf(e);return r<0?Qo.length:r};function qo(e,r){let s=e.usage?.models??{};return Object.entries(s).map(([d,S])=>({name:Cr(d),current:Ur(d,r),windows:Object.entries(S.windows??{}).sort(([U],[m])=>Jo(U)-Jo(m)).map(([U,m])=>Nr(U,m))})).sort((d,S)=>Number(S.current)-Number(d.current))}function er(e,r,s){let u=new Date(e),d={hour:"numeric",minute:"2-digit"};if(new Date(r).toDateString()===u.toDateString())return u.toLocaleTimeString(s,d);if(e-r<518400000)return u.toLocaleString(s,{weekday:"short",...d});return u.toLocaleDateString(s,{month:"short",day:"numeric"})}var Bt=60000,ze=Nt(),or=document.querySelector("#root");if(!or)throw Error("Missing #root");var We=or,rr=document.createElement("style");rr.textContent=`
  html, body { margin: 0; background: transparent; color: var(--oc-fg); font: 12px/1.4 var(--oc-font); }
  * { box-sizing: border-box; }
  #root { display: flex; flex-direction: column; gap: 8px; padding: 2px 4px 4px; }
  .note { color: var(--oc-muted); }
  .note.error { color: var(--oc-error-text, var(--oc-error)); }
  .group { display: flex; flex-direction: column; gap: 4px; }
  .group.other { opacity: .7; }
  .name { display: flex; align-items: baseline; gap: 6px; font-weight: 600; }
  .tag { font-weight: 400; font-size: 11px; color: var(--oc-muted); }
  .line { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; align-items: center; gap: 8px; }
  .what { color: var(--oc-muted); }
  .meter { height: 5px; border-radius: 3px; overflow: hidden; background: color-mix(in srgb, var(--oc-fg) 8%, transparent); }
  .meter > span { display: block; height: 100%; border-radius: 3px; }
  .value { font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }
  .reset { color: var(--oc-muted); }
`;document.head.append(rr);var yr={success:"var(--oc-success)",warning:"var(--oc-warning)",error:"var(--oc-error)",muted:"var(--oc-muted)"},V=(e,r="",s="")=>{let u=document.createElement(e);if(r)u.className=r;if(s)u.textContent=s;return u},nr,ie=null,se=null,je=null,Ft=!1,Kt=0,Se=(e,r=!1)=>We.replaceChildren(V("div",r?"note error":"note",e));function vr(e,r){let s=V("div",e.current?"group":"group other"),u=V("div","name",e.name);if(e.current)u.append(V("span","tag","this session"));s.append(u);for(let d of e.windows){let S=V("span");S.style.width=`${d.remaining??0}%`,S.style.background=yr[d.tone];let U=V("div","meter");U.append(S);let m=V("span","value",d.remaining===null?"–":`${d.remaining}% left`);if(d.resetAt!==null){let G=er(d.resetAt,r,nr);m.append(V("span","reset",` · ${G}`)),m.title=`Refills ${G}`}let D=V("div","line");D.append(V("span","what",d.label),U,m),s.append(D)}return s}function Ye(){if(ie===null){Se("Not used in this session");return}if(je){Se(je,!0);return}if(!se){Se("Reading quota…");return}if(!se.ok||!se.usage){Se(se.error??"agy reported no quota.",!0);return}let e=Date.now(),r=qo(se,ie);if(r.length===0){Se("agy reported no quota groups.");return}We.replaceChildren(...r.map((s)=>vr(s,e)))}function Lr(e){if(e instanceof c){if(e.code==="NO_SERVICE"||e.code==="NOT_GRANTED")return"Allow the local service for Antigravity quota in Settings → Extensions.";if(e.code==="DISABLED")return"Antigravity quota is paused in Settings → Extensions."}return"Could not reach the quota service."}async function Wt(){if(Ft||ie===null||document.hidden)return;Ft=!0;try{let e=await ze.serviceRequest({method:"GET",path:"/usage"});if(e.status!==200)throw Error(`status ${e.status}`);se=JSON.parse(e.body),je=null,Kt=Date.now()}catch(e){je=Lr(e)}finally{Ft=!1,Ye()}}var tr=-1;new ResizeObserver(()=>{let e=Math.ceil(We.getBoundingClientRect().height);if(e===tr)return;tr=e,ze.setHeight(e).catch(()=>{return})}).observe(We);ze.onReady((e)=>{yt(e,document.documentElement),nr=e.locale,Ye()});ze.onSession((e)=>{let r=Zo(e?.model);if(r===ie)return;if(ie=r,Ye(),ie!==null&&Date.now()-Kt>Bt/2)Wt()});setInterval(()=>void Wt(),Bt);document.addEventListener("visibilitychange",()=>{if(!document.hidden&&Date.now()-Kt>Bt)Wt()});Ye();})();
