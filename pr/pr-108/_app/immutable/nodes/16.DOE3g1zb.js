import"../chunks/B4Na4nSp.js";import{p as A,o as N,a as m}from"../chunks/FOOVCpDX.js";import{g as c}from"../chunks/B4BdbH5g.js";import{b as l}from"../chunks/CxyiuMEw.js";import{r as p,c as u,Q as C}from"../chunks/D91cmTP3.js";import{I as f,d as R,s as S,l as g}from"../chunks/ZT-b6eCD.js";import{p as E}from"../chunks/CJ_-Ajms.js";const d=[{id:"P8",name:"Octave",semitones:12},{id:"P5",name:"Perfect 5th",semitones:7}],I=60,T=f.filter(r=>r.tier<=2);function L(r){const t=T.find(a=>a.id===r),n=[...T.filter(a=>a.id!==r)].sort(()=>Math.random()-.5).slice(0,3);return[t,...n].sort(()=>Math.random()-.5).map(a=>({id:a.id,name:a.name,label:a.id}))}const O=["LISSA INITIALIZING...","AUDIO ENGINE: ONLINE","FREQUENCY ANALYZER: CALIBRATED","LISSA v4.4 ONLINE","","READY"];function M(){let r=0;return{heading:"INITIALIZING",contentKinds:["interval"],sessionLength:2,freMode:!0,autoPlay:!1,generateQuestion(t){const e=d[Math.min(r,d.length-1)];return r++,{id:`interval:${e.id}:ascending`,kind:"interval",rootNote:I,playback:{type:"interval",rootNote:I,intervals:[e.semitones],toneType:"epiano",direction:"ascending"},correctAnswer:{id:e.id,name:e.name,label:e.id},choices:L(e.id),replays:0}},async playAudio(t){const e=t.playback.intervals[0];return await E(t.rootNote,e,"ascending","epiano"),{durationMs:(.6*2+.3)*1e3+200,notes:[t.rootNote]}},async replayChoice(t,e){const o=f.find(n=>n.id===t);o&&await E(e.rootNote,o.semitones,"ascending","epiano")},onAnswer(t,e,o){const n=e.id;t.stats[n]||(t.stats[n]=R());const s=t.stats[n];s.attempts++,o.correct?(s.correct++,s.streak++):s.streak=0,s.lastSeen=Date.now();const a=p({correct:o.correct,replays:e.replays,responseTimeMs:o.responseTimeMs}),i=u(s.easeFactor,a);s.easeFactor=i.easeFactor,s.nextReview=Date.now()+i.intervalMs,t.globalStats.totalQuestions++},getGuidanceMessage(t,e,o){return e==="idle"&&t===0?"BOOT:"+O.join(`
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
CALIBRATION COMPLETE`:null}}}function _(r,t){A(t,!0),N(()=>{g().settings.hasCompletedFRE&&c(`${l}/`)});const o={...M(),onSessionEnd(n){n.settings.hasCompletedFRE=!0,S(n),c(`${l}/quiz`)}};C(r,{get config(){return o}}),m()}export{_ as component};
