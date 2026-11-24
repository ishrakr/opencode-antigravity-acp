"use strict";Object.defineProperties(exports,{__esModule:{value:!0},[Symbol.toStringTag]:{value:"Module"}});const t=require("solid-js/web"),i=require("solid-js"),q=require("@opencode/plugin/gui"),Se=require("@opencode/plugin/rpc"),oe={type:"object",properties:{sessionID:{type:"string"}},required:["sessionID"],additionalProperties:!1},J={type:"object",properties:{sessionID:{type:"string"},mode:{type:"string",enum:["auto","accept-edits","default","plan"]},authMethod:{type:"string"},starting:{type:"boolean"},acpSessionId:{anyOf:[{type:"string"},{type:"null"}]},connected:{type:"boolean"},busy:{type:"boolean"},modelCount:{type:"number"},lastError:{anyOf:[{type:"string"},{type:"null"}]},cooldownUntil:{anyOf:[{type:"number"},{type:"null"}]}},required:["sessionID","mode","authMethod","starting","acpSessionId","connected","busy","modelCount","lastError","cooldownUntil"],additionalProperties:!1},ke=Se.Rpc.define({id:"antigravity-acp",methods:{getState:{input:oe,output:J},setMode:{input:{type:"object",properties:{sessionID:{type:"string"},mode:{type:"string",enum:["auto","accept-edits","default","plan"]}},required:["sessionID","mode"],additionalProperties:!1},output:J},resetSession:{input:oe,output:J},warmSession:{input:{type:"object",properties:{sessionID:{type:"string"}},additionalProperties:!1},output:J},reloadModels:{input:{type:"object",properties:{},additionalProperties:!1},output:{type:"object",properties:{modelCount:{type:"number"}},required:["modelCount"],additionalProperties:!1}}},events:{}});var Ce=t.template('<div class=agy-pop><div class=agy-status><div class=agy-status-main><span class=agy-dot aria-hidden=true></span><span class=agy-status-text></span></div><div class=agy-meta-chips><span class=agy-chip title="Sign-in method"></span></div></div><div class=agy-sec><div class=agy-sec-head><span class=agy-sec-title>Approval mode</span></div><div role=group class=agy-mode-grid></div><p class=agy-hint></p></div><div class=agy-actions>'),Ae=t.template("<div role=alert class=agy-alert><span class=agy-alert-icon aria-hidden=true></span><span class=agy-alert-body>"),$e=t.template("<span class=agy-check-icon aria-hidden=true>"),Pe=t.template("<button type=button class=agy-seg-btn><span>");const Me="antigravity-acp",ie=1e4,j={auto:"Auto","accept-edits":"Accept edits",default:"Ask",plan:"Plan"},I=[{id:"auto",label:"Auto",detail:"Approves edits and shell commands automatically."},{id:"accept-edits",label:"Accept edits",detail:"Approves file edits; prompts before shell commands."},{id:"default",label:"Ask",detail:"Prompts before file edits and shell commands."},{id:"plan",label:"Plan",detail:"Creates a plan before executing changes."}];function se(n){if(n instanceof Error)return n.message;if(typeof n=="string")return n;try{const f=JSON.stringify(n);return f===void 0?String(n):f}catch{return String(n)}}const _e=`
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

.agy-sec-badge {
  font-size: 11px;
  font-weight: 500;
  line-height: 15px;
  color: var(--v2-text-text-muted, #aeaeae);
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
`,Ee=q.Plugin.define({setup(n){n.add(q.Style,_e);const f=()=>n.client.rpc(ke),K=new Map,F=new Set,$=new Set,P=new Map,x=new Set,M=new Map,_=new Map,T=new Map,U=new Map,E=new Map,B=e=>{const r=(T.get(e)??0)+1;return T.set(e,r),r},C=e=>{let r=K.get(e);return r||(r=i.createSignal(void 0),K.set(e,r)),r},A=e=>({...e?{location:{directory:e}}:{},signal:n.signal}),G=(e,r,o)=>{if(o!==void 0){const g=U.get(e)??0;if(o<g)return;U.set(e,o)}else U.set(e,T.get(e)??0);const[d,u]=C(e),l=i.untrack(d);F.add(e),P.delete(e),u(r),l?.starting&&!r.starting&&!r.connected&&x.delete(e),r.starting||_.delete(e),r.starting&&!n.signal.aborted&&i.untrack(()=>V(e,void 0))},z=(e,r,o=!1)=>{if(!e||n.signal.aborted)return Promise.resolve();if(!o){if(F.has(e)||$.has(e))return Promise.resolve();const l=P.get(e);if(l!==void 0&&Date.now()-l<ie)return Promise.resolve()}const d=B(e);$.add(e);const u=f().getState({sessionID:e},A(r)).then(l=>{n.signal.aborted||G(e,l,d)}).catch(()=>{P.set(e,Date.now())}).finally(()=>{$.delete(e)});return E.set(e,u),u.finally(()=>{E.get(e)===u&&E.delete(e)}),u},le=(e,r)=>{if(!e||F.has(e)||$.has(e))return;const o=P.get(e);o!==void 0&&Date.now()-o<ie||queueMicrotask(()=>{i.untrack(()=>z(e,r,!1))})},de=(e,r)=>{if(!e||n.signal.aborted)return;if(x.has(e)){const d=i.untrack(()=>C(e)[0]());if(d?.connected||d?.starting)return;x.delete(e)}x.add(e);const o=B(e);f().warmSession({sessionID:e},A(r)).then(d=>{n.signal.aborted||(!d.starting&&!d.connected&&x.delete(e),G(e,d,o))}).catch(()=>{x.delete(e)})},V=(e,r)=>{if(!e||n.signal.aborted||M.has(e))return;const o=_.get(e)??0;_.set(e,o+1);const d=Math.min(1500*Math.pow(2,o),12e3);M.set(e,setTimeout(()=>{if(M.delete(e),n.signal.aborted)return;if(!i.untrack(()=>C(e)[0]())?.starting){_.delete(e);return}const l=()=>z(e,r,!0),g=E.get(e);(g?g.then(l,l):l()).finally(()=>{if(n.signal.aborted)return;i.untrack(()=>C(e)[0]())?.starting&&i.untrack(()=>V(e,r))})},d))};function ce(e){const r=i.createUniqueId(),[o,d]=i.createSignal(null),[u,l]=i.createSignal(!1),[g,w]=i.createSignal(null),[b,m]=i.createSignal(Date.now()),L=()=>e.session.id,Q=()=>e.session.directory,h=()=>C(L())[0]();i.createEffect(()=>{const a=L(),s=Q();i.untrack(()=>z(a,s,!0))}),i.createEffect(()=>{const a=h()?.cooldownUntil;if(!a||a<=Date.now())return;m(Date.now());const s=setInterval(()=>{const c=Date.now();m(c),c>=a&&clearInterval(s)},1e3);i.onCleanup(()=>clearInterval(s))});const W=()=>h()?.mode??"auto",ue=()=>I.find(a=>a.id===W())??I[0],X=()=>{const a=h()?.cooldownUntil;if(!a)return 0;const s=a-b();return s>0?Math.ceil(s/1e3):0},ge=()=>{const a=h();return a?.busy||a?.starting?"busy":X()>0?"cooldown":a?.lastError?"error":a?.connected?"connected":"idle"},pe=()=>{const a=h();if(a?.busy)return"Running";if(a?.starting)return"Starting...";const s=X();return s>0?`Cooldown · ${s}s`:a?.lastError?"Error":a?.connected?"Connected":"Standby"},fe=()=>{const a=g();if(a)return{tone:"danger",text:a};const s=X(),c=h();if(s>0)return{tone:"warning",text:`Circuit breaker paused requests for ${s}s after upstream API error${c?.lastError?`: ${c.lastError}`:"."}`};if(c?.lastError)return{tone:"danger",text:c.lastError}},be=()=>h()?.authMethod??"Google account",ye=async a=>{if(o()!==null||W()===a)return;const s=L(),c=Q();w(null),d(a);const N=B(s);try{const R=await f().setMode({sessionID:s,mode:a},A(c));G(s,R,N)}catch(R){w(se(R))}finally{d(null)}},ve=async()=>{if(u())return;const a=L(),s=Q();w(null),l(!0);try{const c=await f().reloadModels({},A(s));z(a,s,!0),n.toast.show({title:"Antigravity models refreshed",description:`${c.modelCount} models available`,variant:"success"})}catch(c){w(se(c))}finally{l(!1)}},ee=`${r}-mode`,te=`${r}-mode-hint`;return(()=>{var a=Ce(),s=a.firstChild,c=s.firstChild,N=c.firstChild,R=N.nextSibling,me=c.nextSibling,he=me.firstChild,Y=s.nextSibling,ae=Y.firstChild,xe=ae.firstChild,Z=ae.nextSibling,re=Z.nextSibling,we=Y.nextSibling;return t.insert(R,pe),t.insert(he,be),t.insert(a,t.createComponent(i.Show,{get when(){return fe()},children:y=>(()=>{var S=Ae(),H=S.firstChild,v=H.nextSibling;return t.insert(H,t.createComponent(n.ui.Icon,{get name(){return y().tone==="warning"?"warning":"circle-exclamation"},size:"small"})),t.insert(v,()=>y().text),t.effect(k=>{var p=y().tone,O=y().text;return p!==k.e&&t.setAttribute(S,"data-tone",k.e=p),O!==k.t&&t.setAttribute(S,"title",k.t=O),k},{e:void 0,t:void 0}),S})()}),Y),t.setAttribute(xe,"id",ee),t.setAttribute(Z,"aria-labelledby",ee),t.insert(Z,t.createComponent(i.For,{each:I,children:y=>{const S=()=>W()===y.id,H=()=>o()===y.id;return(()=>{var v=Pe(),k=v.firstChild;return v.$$click=()=>{ye(y.id)},t.setAttribute(v,"aria-describedby",te),t.insert(k,()=>y.label),t.insert(v,t.createComponent(i.Show,{get when(){return!H()},get fallback(){return t.createComponent(n.ui.Loader,{size:"small"})},get children(){return t.createComponent(i.Show,{get when(){return S()},get children(){var p=$e();return t.insert(p,t.createComponent(n.ui.Icon,{name:"check-small",size:"small"})),p}})}}),null),t.effect(p=>{var O=S(),ne=o()!==null;return O!==p.e&&t.setAttribute(v,"aria-pressed",p.e=O),ne!==p.t&&(v.disabled=p.t=ne),p},{e:void 0,t:void 0}),v})()}})),t.setAttribute(re,"id",te),t.insert(re,()=>ue().detail),t.insert(we,t.createComponent(n.ui.Button,{size:"small",variant:"neutral",icon:"refresh",get busy(){return u()},class:"agy-action-btn",onClick:()=>{ve()},get children(){return`Models (${h()?.modelCount??9})`}})),t.effect(()=>t.setAttribute(N,"data-state",ge())),a})()}n.add(q.ComposerPill,{id:"controls",order:-10,show(e){if(e.screen.composer.model()?.providerID!==Me)return;const o=e.session.id,d=e.session.directory,[u]=i.untrack(()=>C(o));le(o,d),i.untrack(()=>de(o,d));const l=u(),g=l?.mode??"auto",w=!!(l?.cooldownUntil&&l.cooldownUntil>Date.now());l?.starting&&i.untrack(()=>V(o,d));let b=`ACP · ${j[g]}`,m;return l?.busy?(b=`ACP · ${j[g]} · Running`,m="success"):l?.starting?b=`ACP · ${j[g]} · Starting...`:w?(b="ACP · Cooldown",m="warning"):l?.lastError?(b=`ACP · ${j[g]} · Error`,m="danger"):l?.connected&&(b=`ACP · ${j[g]} · Connected`,m="success"),{icon:"brain",label:b,title:"Antigravity ACP",tone:m}},menu:e=>ce(e)});const D=()=>{const e=n.sessions.current();if(!e)return;const r=e.directory??e.location?.directory;return{sessionID:e.id,directory:r}};return n.add(q.Command,()=>({id:"reset",title:"Antigravity ACP: Reset Session",section:"session",slash:{name:"agy-reset"},run:async()=>{const e=D();if(!e)return;const r=B(e.sessionID),o=await f().resetSession({sessionID:e.sessionID},A(e.directory));G(e.sessionID,o,r),n.toast.show({title:"Antigravity ACP session reset",variant:"success"})}})),n.add(q.Command,()=>({id:"reload",title:"Antigravity ACP: Reload Models",section:"model",slash:{name:"agy-reload"},run:async()=>{const e=D(),r=await f().reloadModels({},A(e?.directory));e&&z(e.sessionID,e.directory,!0),n.toast.show({title:"Antigravity models refreshed",description:`${r.modelCount} models available`,variant:"success"})}})),()=>{K.clear(),F.clear(),$.clear(),P.clear(),x.clear(),T.clear(),U.clear(),E.clear();for(const e of M.values())clearTimeout(e);M.clear(),_.clear()}}});t.delegateEvents(["click"]);exports.default=Ee;
