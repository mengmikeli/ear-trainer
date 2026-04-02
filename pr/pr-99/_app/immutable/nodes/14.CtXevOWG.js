import"../chunks/BZtNfWoH.js";import{p as d,o as I,i as l}from"../chunks/CG8-kGya.js";import{g as a}from"../chunks/Y1No89E4.js";import{b as s}from"../chunks/CDnjM-09.js";import{Q as A}from"../chunks/Dn9PI3sh.js";import{p as f}from"../chunks/DoW2FhrS.js";import{I as C,s as p,l as g}from"../chunks/5kGhX9K2.js";const c=[{id:"P8",name:"Octave",semitones:12},{id:"P5",name:"Perfect 5th",semitones:7}],E=60,T=C.filter(t=>t.tier<=2);function m(t){const e=T.find(o=>o.id===t),r=[...T.filter(o=>o.id!==t)].sort(()=>Math.random()-.5).slice(0,3);return[e,...r].sort(()=>Math.random()-.5).map(o=>({id:o.id,name:o.name,label:o.id}))}function N(){let t=0;return{heading:"INITIALIZING",contentKinds:["interval"],sessionLength:2,skipDebrief:!0,generateQuestion(e){const n=c[Math.min(t,c.length-1)];return t++,{id:`interval:${n.id}:ascending`,kind:"interval",rootNote:E,playback:{type:"interval",rootNote:E,intervals:[n.semitones],toneType:"epiano",direction:"ascending"},correctAnswer:{id:n.id,name:n.name,label:n.id},choices:m(n.id),replays:0}},async playAudio(e){const n=e.playback.intervals[0];return await f(e.rootNote,n,"ascending","epiano"),{durationMs:(.6*2+.3)*1e3+200,notes:[e.rootNote]}},getGuidanceMessage(e,n,i){return n==="idle"&&e===0?`SYSTEM INITIALIZING

LISTEN CAREFULLY
IDENTIFY THE INTERVAL
TAP PLAY TO BEGIN`:n==="idle"&&e===1?`SIGNAL ACQUIRED

NEW FREQUENCY DETECTED
TAP PLAY TO ANALYZE`:n==="awaiting_answer"?`ANALYZING

SELECT MATCHING FREQUENCY`:n==="feedback_correct"&&e===1?`OCTAVE DETECTED

SAME NOTE -- HIGHER PITCH
SIGNAL CONFIRMED`:n==="feedback_wrong"&&e===1?`SIGNAL MISMATCH

TARGET WAS OCTAVE
CALIBRATING`:n==="feedback_correct"&&e===2?`PERFECT 5TH CONFIRMED

NATURAL APTITUDE DETECTED
SYSTEM READY`:n==="feedback_wrong"&&e===2?`SIGNAL MISMATCH

TARGET WAS PERFECT 5TH
CALIBRATION COMPLETE`:null}}}function b(t,e){d(e,!0),I(()=>{g().settings.hasCompletedFRE&&a(`${s}/`)});const i={...N(),onSessionEnd(r){r.settings.hasCompletedFRE=!0,p(r),a(`${s}/`)}};A(t,{get config(){return i}}),l()}export{b as component};
