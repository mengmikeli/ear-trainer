import"../chunks/DqOrwSpJ.js";import{p as I,o as f,a as A}from"../chunks/BW7DSscg.js";import{g as c}from"../chunks/DvBijf5i.js";import{b as E}from"../chunks/CLwSabW6.js";import{r as N,c as m,Q as R}from"../chunks/CrkMV_P9.js";import{I as p,d as C,s as u,l as S}from"../chunks/CL7ukTox.js";import{p as g}from"../chunks/C7-mqS4D.js";const l=[{id:"P8",name:"Octave",semitones:12},{id:"P5",name:"Perfect 5th",semitones:7}],T=60,d=p.filter(o=>o.tier<=2);function O(o){const e=d.find(s=>s.id===o),n=[...d.filter(s=>s.id!==o)].sort(()=>Math.random()-.5).slice(0,3);return[e,...n].sort(()=>Math.random()-.5).map(s=>({id:s.id,name:s.name,label:s.id}))}const M=["SYSTEM CHECK...","AUDIO ENGINE: ONLINE","FREQUENCY ANALYZER: CALIBRATED","EAR TRAINER v4.0","","READY"];function L(){let o=0;return{heading:"INITIALIZING",contentKinds:["interval"],sessionLength:2,freMode:!0,autoPlay:!1,generateQuestion(e){const t=l[Math.min(o,l.length-1)];return o++,{id:`interval:${t.id}:ascending`,kind:"interval",rootNote:T,playback:{type:"interval",rootNote:T,intervals:[t.semitones],toneType:"epiano",direction:"ascending"},correctAnswer:{id:t.id,name:t.name,label:t.id},choices:O(t.id),replays:0}},async playAudio(e){const t=e.playback.intervals[0];return await g(e.rootNote,t,"ascending","epiano"),{durationMs:(.6*2+.3)*1e3+200,notes:[e.rootNote]}},onAnswer(e,t,a){const n=t.id;e.stats[n]||(e.stats[n]=C());const r=e.stats[n];r.attempts++,a.correct?(r.correct++,r.streak++):r.streak=0,r.lastSeen=Date.now();const s=N({correct:a.correct,replays:t.replays,responseTimeMs:a.responseTimeMs}),i=m(r.easeFactor,s);r.easeFactor=i.easeFactor,r.nextReview=Date.now()+i.intervalMs,e.globalStats.totalQuestions++},getGuidanceMessage(e,t,a){return t==="idle"&&e===0?"BOOT:"+M.join(`
`):t==="idle"&&e===1?`TRANSMITTING...

LISTEN TO THE INTERVAL
IDENTIFY THE FREQUENCY`:t==="idle"&&e===2?`TRANSMITTING...

NEW FREQUENCY DETECTED
ANALYZING SIGNAL`:t==="feedback_correct"&&e===1?`OCTAVE DETECTED

SAME NOTE -- HIGHER PITCH
SIGNAL CONFIRMED`:(t==="feedback_wrong"||t==="result_mode")&&e===1?`SIGNAL MISMATCH

TARGET WAS OCTAVE
CALIBRATING...`:t==="feedback_correct"&&e===2?`PERFECT 5TH CONFIRMED

STRONG SIGNAL
CALIBRATION COMPLETE`:(t==="feedback_wrong"||t==="result_mode")&&e===2?`CLOSE ENOUGH

TARGET WAS PERFECT 5TH
CALIBRATION COMPLETE`:null}}}function P(o,e){I(e,!0),f(()=>{S().settings.hasCompletedFRE&&c(`${E}/`)});const a={...L(),onSessionEnd(n){n.settings.hasCompletedFRE=!0,u(n),c(`${E}/quiz`)}};R(o,{get config(){return a}}),A()}export{P as component};
