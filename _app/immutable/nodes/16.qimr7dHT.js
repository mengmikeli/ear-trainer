import"../chunks/B4Na4nSp.js";import{p as A,o as N,a as m}from"../chunks/FOOVCpDX.js";import{g as c}from"../chunks/DzJJrMmC.js";import{b as l}from"../chunks/BKoo0zrH.js";import{r as p,c as R,Q as C}from"../chunks/021FHg0a.js";import{I,d as u,s as g,l as S}from"../chunks/ZT-b6eCD.js";import{p as E}from"../chunks/DPZSP1EF.js";const d=[{id:"P8",name:"Octave",semitones:12},{id:"P5",name:"Perfect 5th",semitones:7}],T=60,f=I.filter(r=>r.tier<=2);function O(r){const t=f.find(a=>a.id===r),n=[...f.filter(a=>a.id!==r)].sort(()=>Math.random()-.5).slice(0,3);return[t,...n].sort(()=>Math.random()-.5).map(a=>({id:a.id,name:a.name,label:a.id}))}const M=["SYSTEM CHECK...","AUDIO ENGINE: ONLINE","FREQUENCY ANALYZER: CALIBRATED","EAR TRAINER v4.0","","READY"];function L(){let r=0;return{heading:"INITIALIZING",contentKinds:["interval"],sessionLength:2,freMode:!0,autoPlay:!1,generateQuestion(t){const e=d[Math.min(r,d.length-1)];return r++,{id:`interval:${e.id}:ascending`,kind:"interval",rootNote:T,playback:{type:"interval",rootNote:T,intervals:[e.semitones],toneType:"epiano",direction:"ascending"},correctAnswer:{id:e.id,name:e.name,label:e.id},choices:O(e.id),replays:0}},async playAudio(t){const e=t.playback.intervals[0];return await E(t.rootNote,e,"ascending","epiano"),{durationMs:(.6*2+.3)*1e3+200,notes:[t.rootNote]}},async replayChoice(t,e){const o=I.find(n=>n.id===t);o&&await E(e.rootNote,o.semitones,"ascending","epiano")},onAnswer(t,e,o){const n=e.id;t.stats[n]||(t.stats[n]=u());const s=t.stats[n];s.attempts++,o.correct?(s.correct++,s.streak++):s.streak=0,s.lastSeen=Date.now();const a=p({correct:o.correct,replays:e.replays,responseTimeMs:o.responseTimeMs}),i=R(s.easeFactor,a);s.easeFactor=i.easeFactor,s.nextReview=Date.now()+i.intervalMs,t.globalStats.totalQuestions++},getGuidanceMessage(t,e,o){return e==="idle"&&t===0?"BOOT:"+M.join(`
`):e==="idle"&&t===1?`TRANSMITTING...

LISTEN TO THE INTERVAL
IDENTIFY THE FREQUENCY`:e==="idle"&&t===2?`TRANSMITTING...

NEW FREQUENCY DETECTED
ANALYZING SIGNAL`:e==="feedback_correct"&&t===1?`OCTAVE DETECTED

SAME NOTE -- HIGHER PITCH
SIGNAL CONFIRMED`:(e==="feedback_wrong"||e==="result_mode")&&t===1?`SIGNAL MISMATCH

TARGET WAS OCTAVE
CALIBRATING...`:e==="feedback_correct"&&t===2?`PERFECT 5TH CONFIRMED

STRONG SIGNAL
CALIBRATION COMPLETE`:(e==="feedback_wrong"||e==="result_mode")&&t===2?`CLOSE ENOUGH

TARGET WAS PERFECT 5TH
CALIBRATION COMPLETE`:null}}}function P(r,t){A(t,!0),N(()=>{S().settings.hasCompletedFRE&&c(`${l}/`)});const o={...L(),onSessionEnd(n){n.settings.hasCompletedFRE=!0,g(n),c(`${l}/quiz`)}};C(r,{get config(){return o}}),m()}export{P as component};
