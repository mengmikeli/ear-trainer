import"../chunks/BZtNfWoH.js";import{p as l,o as f,i as T}from"../chunks/CG8-kGya.js";import{g as s}from"../chunks/B72IeKEK.js";import{b as a}from"../chunks/BmwRKyrm.js";import{Q as A}from"../chunks/Df-77Rm-.js";import{p as I}from"../chunks/DoW2FhrS.js";import{I as m,s as u,l as C}from"../chunks/5kGhX9K2.js";const E=[{id:"P8",name:"Octave",semitones:12},{id:"P5",name:"Perfect 5th",semitones:7}],c=60,d=m.filter(t=>t.tier<=2);function R(t){const e=d.find(o=>o.id===t),r=[...d.filter(o=>o.id!==t)].sort(()=>Math.random()-.5).slice(0,3);return[e,...r].sort(()=>Math.random()-.5).map(o=>({id:o.id,name:o.name,label:o.id}))}const g=["SYSTEM CHECK...","AUDIO ENGINE: ONLINE","FREQUENCY ANALYZER: CALIBRATED","EAR TRAINER v4.0","","READY"];function p(){let t=0;return{heading:"INITIALIZING",contentKinds:["interval"],sessionLength:2,skipDebrief:!0,freMode:!0,generateQuestion(e){const n=E[Math.min(t,E.length-1)];return t++,{id:`interval:${n.id}:ascending`,kind:"interval",rootNote:c,playback:{type:"interval",rootNote:c,intervals:[n.semitones],toneType:"epiano",direction:"ascending"},correctAnswer:{id:n.id,name:n.name,label:n.id},choices:R(n.id),replays:0}},async playAudio(e){const n=e.playback.intervals[0];return await I(e.rootNote,n,"ascending","epiano"),{durationMs:(.6*2+.3)*1e3+200,notes:[e.rootNote]}},getGuidanceMessage(e,n,i){return n==="idle"&&e===0?"BOOT:"+g.join(`
`):n==="idle"&&e===1?`SIGNAL ACQUIRED

NEW FREQUENCY DETECTED
ANALYZING...`:n==="awaiting_answer"?null:n==="feedback_correct"&&e===1?`OCTAVE DETECTED

SAME NOTE — HIGHER PITCH
SIGNAL CONFIRMED`:(n==="feedback_wrong"||n==="result_mode")&&e===1?`SIGNAL MISMATCH

TARGET WAS OCTAVE
CALIBRATING...`:n==="feedback_correct"&&e===2?`PERFECT 5TH CONFIRMED

NATURAL APTITUDE DETECTED
SYSTEM READY`:(n==="feedback_wrong"||n==="result_mode")&&e===2?`CLOSE ENOUGH

TARGET WAS PERFECT 5TH
CALIBRATION COMPLETE`:null}}}function _(t,e){l(e,!0),f(()=>{C().settings.hasCompletedFRE&&s(`${a}/`)});const i={...p(),onSessionEnd(r){r.settings.hasCompletedFRE=!0,u(r),s(`${a}/`)}};A(t,{get config(){return i}}),T()}export{_ as component};
