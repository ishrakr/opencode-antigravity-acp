"use strict";Object.defineProperties(exports,{__esModule:{value:!0},[Symbol.toStringTag]:{value:"Module"}});const a=require("solid-js/web"),s=require("solid-js"),F=require("@opencode/plugin/gui"),Pe=require("@opencode/plugin/rpc"),le={type:"object",properties:{sessionID:{type:"string"},providerID:{type:"string"}},required:["sessionID"],additionalProperties:!1},K={type:"object",properties:{sessionID:{type:"string"},mode:{type:"string",enum:["auto","accept-edits","default","plan"]},authMethod:{type:"string"},starting:{type:"boolean"},acpSessionId:{anyOf:[{type:"string"},{type:"null"}]},connected:{type:"boolean"},busy:{type:"boolean"},modelCount:{type:"number"},lastError:{anyOf:[{type:"string"},{type:"null"}]},cooldownUntil:{anyOf:[{type:"number"},{type:"null"}]},account:{type:"string"}},required:["sessionID","mode","authMethod","starting","acpSessionId","connected","busy","modelCount","lastError","cooldownUntil","account"],additionalProperties:!1},$e=Pe.Rpc.define({id:"antigravity-acp",methods:{getState:{input:le,output:K},setMode:{input:{type:"object",properties:{sessionID:{type:"string"},providerID:{type:"string"},mode:{type:"string",enum:["auto","accept-edits","default","plan"]}},required:["sessionID","mode"],additionalProperties:!1},output:K},resetSession:{input:le,output:K},warmSession:{input:{type:"object",properties:{sessionID:{type:"string"},providerID:{type:"string"}},additionalProperties:!1},output:K},reloadModels:{input:{type:"object",properties:{providerID:{type:"string"}},additionalProperties:!1},output:{type:"object",properties:{modelCount:{type:"number"}},required:["modelCount"],additionalProperties:!1}}},events:{}}),te="antigravity-acp",Me=`${te}-`;function _e(n){return typeof n=="string"&&(n===te||n.startsWith(Me))}var Ee=a.template('<div class=agy-pop><div class=agy-status><div class=agy-status-main><span class=agy-dot aria-hidden=true></span><span class=agy-status-text></span></div><div class=agy-meta-chips><span class=agy-chip title="Account and sign-in method"></span></div></div><div class=agy-sec><div class=agy-sec-head><span class=agy-sec-title>Approval mode</span></div><div role=group class=agy-mode-grid></div><p class=agy-hint></p></div><div class=agy-actions>'),Oe=a.template("<div role=alert class=agy-alert><span class=agy-alert-icon aria-hidden=true></span><span class=agy-alert-body>"),Re=a.template("<span class=agy-check-icon aria-hidden=true>"),ze=a.template("<button type=button class=agy-seg-btn><span>");const ce=1e4,T={auto:"Auto","accept-edits":"Accept edits",default:"Ask",plan:"Plan"},ee=[{id:"auto",label:"Auto",detail:"Approves edits and shell commands automatically."},{id:"accept-edits",label:"Accept edits",detail:"Approves file edits; prompts before shell commands."},{id:"default",label:"Ask",detail:"Prompts before file edits and shell commands."},{id:"plan",label:"Plan",detail:"Creates a plan before executing changes."}];function de(n){if(n instanceof Error)return n.message;if(typeof n=="string")return n;try{const f=JSON.stringify(n);return f===void 0?String(n):f}catch{return String(n)}}const qe=`
.agy-pop {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 2px 4px 4px;
  box-sizing: border-box;
  color: var(--v2-text-text-base, #fafafa);
  font-family: var(--v2-font-family-sans, ui-sans-serif, system-ui, -apple-system, sans-serif);
  font-size: 13px;
  line-height: 18px;
  letter-spacing: -0.04px;
  font-variant-numeric: tabular-nums;
}

.agy-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 9px;
  border-radius: 7px;
  background: var(--v2-background-bg-base, #161616);
  border: 0.5px solid var(--v2-border-border-muted, rgba(255, 255, 255, 0.08));
}

.agy-status-main {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.agy-dot {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--v2-text-text-faint, #777777);
}
.agy-dot[data-state="connected"] { background: var(--v2-state-fg-success, #4ade80); }
.agy-dot[data-state="busy"] {
  background: var(--v2-state-fg-info, #60a5fa);
  animation: agy-pulse 1.5s ease-in-out infinite;
}
.agy-dot[data-state="cooldown"] { background: var(--v2-state-fg-warning, #f59e0b); }
.agy-dot[data-state="error"] { background: var(--v2-state-fg-danger, #f87171); }

@keyframes agy-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.42; }
}
:root[data-motion="reduce"] .agy-dot[data-state="busy"] { animation: none; }
@media (prefers-reduced-motion: reduce) {
  .agy-dot[data-state="busy"] { animation: none; }
}

.agy-status-text {
  font-size: 12.5px;
  font-weight: 530;
  color: var(--v2-text-text-base, #fafafa);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agy-meta-chips {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.agy-chip {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 5px;
  background: var(--v2-background-bg-layer-02, #2e2e2e);
  color: var(--v2-text-text-muted, #aeaeae);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
}

.agy-alert {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 7px 9px;
  border-radius: 7px;
  font-size: 12px;
  line-height: 16px;
  word-break: break-word;
  border: 0.5px solid var(--v2-state-border-danger, rgba(248, 113, 113, 0.3));
  background: var(--v2-state-bg-danger, rgba(127, 29, 29, 0.35));
  color: var(--v2-state-fg-danger, #fca5a5);
}
.agy-alert[data-tone="warning"] {
  border-color: var(--v2-state-border-warning, rgba(245, 158, 11, 0.35));
  background: var(--v2-state-bg-warning, rgba(120, 53, 15, 0.35));
  color: var(--v2-state-fg-warning, #fcd34d);
}
.agy-alert-icon {
  flex-shrink: 0;
  margin-top: 1px;
}
.agy-alert-body {
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.agy-sec {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agy-sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.agy-sec-title {
  font-size: 11px;
  font-weight: 530;
  line-height: 15px;
  color: var(--v2-text-text-faint, #888888);
  user-select: none;
}


.agy-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.agy-seg-btn {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-block-size: 30px;
  padding: 5px 9px;
  border-radius: 6px;
  border: 0.5px solid var(--v2-border-border-muted, rgba(255, 255, 255, 0.08));
  background: var(--v2-background-bg-base, #161616);
  color: var(--v2-text-text-muted, #aeaeae);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 480;
  line-height: 16px;
  text-align: left;
  cursor: pointer;
  transition: background-color 100ms ease, border-color 100ms ease, color 100ms ease;
}
.agy-seg-btn:hover:not(:disabled, [aria-pressed="true"]) {
  background: var(--v2-overlay-simple-overlay-hover, rgba(255, 255, 255, 0.06));
  color: var(--v2-text-text-base, #fafafa);
}
.agy-seg-btn[aria-pressed="true"] {
  background: var(--v2-background-bg-layer-02, #2e2e2e);
  border-color: var(--v2-border-border-strong, rgba(255, 255, 255, 0.2));
  color: var(--v2-text-text-base, #fafafa);
  font-weight: 540;
}
.agy-seg-btn[aria-pressed="true"] .agy-check-icon {
  color: var(--v2-state-fg-success, #4ade80);
}
.agy-seg-btn:focus-visible {
  outline: 2px solid var(--v2-border-border-focus, #3b82f6);
  outline-offset: 1px;
}
.agy-seg-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.agy-hint {
  margin: 0;
  font-size: 11.5px;
  line-height: 15px;
  color: var(--v2-text-text-muted, #9a9a9a);
}

.agy-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
  padding-top: 8px;
  border-top: 0.5px solid var(--v2-border-border-muted, rgba(255, 255, 255, 0.08));
}

.agy-action-btn {
  width: 100%;
  min-width: 0;
  justify-content: center;
}
`,je=F.Plugin.define({setup(n){n.add(F.Style,qe);const f=()=>n.client.rpc($e),W=new Map,M=new Set,_=new Set,C=new Map,m=new Set,E=new Map,O=new Map,U=new Map,B=new Map,R=new Map,G=new Map,A=e=>{const t=G.get(e);return t&&t!==te?{providerID:t}:{}},ue=(e,t)=>{const o=G.get(e);o!==t&&(G.set(e,t),o!==void 0&&(M.delete(e),m.delete(e),C.delete(e)))},N=e=>{const t=(U.get(e)??0)+1;return U.set(e,t),t},P=e=>{let t=W.get(e);return t||(t=s.createSignal(void 0),W.set(e,t)),t},$=e=>({...e?{location:{directory:e}}:{},signal:n.signal}),L=(e,t,o)=>{if(o!==void 0){const g=B.get(e)??0;if(o<g)return;B.set(e,o)}else B.set(e,U.get(e)??0);const[c,u]=P(e),l=s.untrack(c);M.add(e),C.delete(e),u(t),l?.starting&&!t.starting&&!t.connected&&m.delete(e),t.starting||O.delete(e),t.starting&&!n.signal.aborted&&s.untrack(()=>X(e,void 0))},z=(e,t,o=!1)=>{if(!e||n.signal.aborted)return Promise.resolve();if(!o){if(M.has(e)||_.has(e))return Promise.resolve();const l=C.get(e);if(l!==void 0&&Date.now()-l<ce)return Promise.resolve()}const c=N(e);_.add(e);const u=f().getState({sessionID:e,...A(e)},$(t)).then(l=>{n.signal.aborted||L(e,l,c)}).catch(()=>{C.set(e,Date.now())}).finally(()=>{_.delete(e)});return R.set(e,u),u.finally(()=>{R.get(e)===u&&R.delete(e)}),u},ge=(e,t)=>{if(!e||M.has(e)||_.has(e))return;const o=C.get(e);o!==void 0&&Date.now()-o<ce||queueMicrotask(()=>{s.untrack(()=>z(e,t,!1))})},pe=(e,t)=>{if(!e||n.signal.aborted)return;if(m.has(e)){const c=s.untrack(()=>P(e)[0]());if(c?.connected||c?.starting)return;m.delete(e)}m.add(e);const o=N(e);f().warmSession({sessionID:e,...A(e)},$(t)).then(c=>{n.signal.aborted||(!c.starting&&!c.connected&&m.delete(e),L(e,c,o))}).catch(()=>{m.delete(e)})},X=(e,t)=>{if(!e||n.signal.aborted||E.has(e))return;const o=O.get(e)??0;O.set(e,o+1);const c=Math.min(1500*Math.pow(2,o),12e3);E.set(e,setTimeout(()=>{if(E.delete(e),n.signal.aborted)return;if(!s.untrack(()=>P(e)[0]())?.starting){O.delete(e);return}const l=()=>z(e,t,!0),g=R.get(e);(g?g.then(l,l):l()).finally(()=>{if(n.signal.aborted)return;s.untrack(()=>P(e)[0]())?.starting&&s.untrack(()=>X(e,t))})},c))};function fe(e){const t=s.createUniqueId(),[o,c]=s.createSignal(null),[u,l]=s.createSignal(!1),[g,x]=s.createSignal(null),[y,h]=s.createSignal(Date.now()),H=()=>e.session.id,Q=()=>e.session.directory,w=()=>P(H())[0]();s.createEffect(()=>{const r=H(),i=Q();s.untrack(()=>z(r,i,!0))}),s.createEffect(()=>{const r=w()?.cooldownUntil;if(!r||r<=Date.now())return;h(Date.now());const i=setInterval(()=>{const d=Date.now();h(d),d>=r&&clearInterval(i)},1e3);s.onCleanup(()=>clearInterval(i))});const Y=()=>w()?.mode??"auto",ye=()=>ee.find(r=>r.id===Y())??ee[0],Z=()=>{const r=w()?.cooldownUntil;if(!r)return 0;const i=r-y();return i>0?Math.ceil(i/1e3):0},ve=()=>{const r=w();return r?.busy||r?.starting?"busy":Z()>0?"cooldown":r?.lastError?"error":r?.connected?"connected":"idle"},be=()=>{const r=w();if(r?.busy)return"Running";if(r?.starting)return"Starting...";const i=Z();return i>0?`Cooldown · ${i}s`:r?.lastError?"Error":r?.connected?"Connected":"Standby"},me=()=>{const r=g();if(r)return{tone:"danger",text:r};const i=Z(),d=w();if(i>0)return{tone:"warning",text:`Circuit breaker paused requests for ${i}s after upstream API error${d?.lastError?`: ${d.lastError}`:"."}`};if(d?.lastError)return{tone:"danger",text:d.lastError}},he=()=>{const r=w(),i=r?.account&&r.account!=="Main"?r.account:void 0;return i?`${i} · Google account`:r?.authMethod??"Google account"},we=async r=>{if(o()!==null||Y()===r)return;const i=H(),d=Q();x(null),c(r);const J=N(i);try{const q=await f().setMode({sessionID:i,mode:r,...A(i)},$(d));L(i,q,J)}catch(q){x(de(q))}finally{c(null)}},xe=async()=>{if(u())return;const r=H(),i=Q();x(null),l(!0);try{const d=await f().reloadModels(A(r),$(i));z(r,i,!0),n.toast.show({title:"Antigravity models refreshed",description:`${d.modelCount} models available`,variant:"success"})}catch(d){x(de(d))}finally{l(!1)}},ae=`${t}-mode`,ne=`${t}-mode-hint`;return(()=>{var r=Ee(),i=r.firstChild,d=i.firstChild,J=d.firstChild,q=J.nextSibling,Se=d.nextSibling,ke=Se.firstChild,I=i.nextSibling,oe=I.firstChild,Ce=oe.firstChild,D=oe.nextSibling,ie=D.nextSibling,Ae=I.nextSibling;return a.insert(q,be),a.insert(ke,he),a.insert(r,a.createComponent(s.Show,{get when(){return me()},children:v=>(()=>{var S=Oe(),V=S.firstChild,b=V.nextSibling;return a.insert(V,a.createComponent(n.ui.Icon,{get name(){return v().tone==="warning"?"warning":"circle-exclamation"},size:"small"})),a.insert(b,()=>v().text),a.effect(k=>{var p=v().tone,j=v().text;return p!==k.e&&a.setAttribute(S,"data-tone",k.e=p),j!==k.t&&a.setAttribute(S,"title",k.t=j),k},{e:void 0,t:void 0}),S})()}),I),a.setAttribute(Ce,"id",ae),a.setAttribute(D,"aria-labelledby",ae),a.insert(D,a.createComponent(s.For,{each:ee,children:v=>{const S=()=>Y()===v.id,V=()=>o()===v.id;return(()=>{var b=ze(),k=b.firstChild;return b.$$click=()=>{we(v.id)},a.setAttribute(b,"aria-describedby",ne),a.insert(k,()=>v.label),a.insert(b,a.createComponent(s.Show,{get when(){return!V()},get fallback(){return a.createComponent(n.ui.Loader,{size:"small"})},get children(){return a.createComponent(s.Show,{get when(){return S()},get children(){var p=Re();return a.insert(p,a.createComponent(n.ui.Icon,{name:"check-small",size:"small"})),p}})}}),null),a.effect(p=>{var j=S(),se=o()!==null;return j!==p.e&&a.setAttribute(b,"aria-pressed",p.e=j),se!==p.t&&(b.disabled=p.t=se),p},{e:void 0,t:void 0}),b})()}})),a.setAttribute(ie,"id",ne),a.insert(ie,()=>ye().detail),a.insert(Ae,a.createComponent(n.ui.Button,{size:"small",variant:"neutral",icon:"refresh",get busy(){return u()},class:"agy-action-btn",onClick:()=>{xe()},get children(){return`Models (${w()?.modelCount??9})`}})),a.effect(()=>a.setAttribute(J,"data-state",ve())),r})()}n.add(F.ComposerPill,{id:"controls",order:-10,show(e){const t=e.screen.composer.model();if(!_e(t?.providerID))return;const o=e.session.id;s.untrack(()=>ue(o,t.providerID));const c=e.session.directory,[u]=s.untrack(()=>P(o));ge(o,c),s.untrack(()=>pe(o,c));const l=u(),g=l?.mode??"auto",x=!!(l?.cooldownUntil&&l.cooldownUntil>Date.now());l?.starting&&s.untrack(()=>X(o,c));let y=`ACP · ${T[g]}`,h;return l?.busy?(y=`ACP · ${T[g]} · Running`,h="success"):l?.starting?y=`ACP · ${T[g]} · Starting...`:x?(y="ACP · Cooldown",h="warning"):l?.lastError?(y=`ACP · ${T[g]} · Error`,h="danger"):l?.connected&&(y=`ACP · ${T[g]} · Connected`,h="success"),{icon:"brain",label:y,title:"Antigravity ACP",tone:h}},menu:e=>fe(e)});const re=()=>{const e=n.sessions.current();if(!e)return;const t=e.directory??e.location?.directory;return{sessionID:e.id,directory:t}};return n.add(F.Command,()=>({id:"reset",title:"Antigravity ACP: Reset Session",section:"session",slash:{name:"agy-reset"},run:async()=>{const e=re();if(!e)return;const t=N(e.sessionID),o=await f().resetSession({sessionID:e.sessionID,...A(e.sessionID)},$(e.directory));L(e.sessionID,o,t),n.toast.show({title:"Antigravity ACP session reset",variant:"success"})}})),n.add(F.Command,()=>({id:"reload",title:"Antigravity ACP: Reload Models",section:"model",slash:{name:"agy-reload"},run:async()=>{const e=re(),t=await f().reloadModels(e?A(e.sessionID):{},$(e?.directory));e&&z(e.sessionID,e.directory,!0),n.toast.show({title:"Antigravity models refreshed",description:`${t.modelCount} models available`,variant:"success"})}})),()=>{W.clear(),M.clear(),_.clear(),C.clear(),m.clear(),U.clear(),B.clear(),R.clear(),G.clear();for(const e of E.values())clearTimeout(e);E.clear(),O.clear()}}});a.delegateEvents(["click"]);exports.default=je;
