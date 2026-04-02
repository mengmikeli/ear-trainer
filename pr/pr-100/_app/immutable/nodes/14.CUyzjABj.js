import"../chunks/DURV8alv.js";import{p as c,o as T,i as d}from"../chunks/AjmU1jO3.js";import{g as l}from"../chunks/B5Gv3MOS.js";import{b as I}from"../chunks/sWeXa90z.js";import{Q as f}from"../chunks/DUjLaAJA.js";import{p as A}from"../chunks/Drqa5eV0.js";import{I as N,s as R,l as C}from"../chunks/hEMJtlYp.js";const a=[{id:"P8",name:"Octave",semitones:12},{id:"P5",name:"Perfect 5th",semitones:7}],s=60,E=N.filter(t=>t.tier<=2);function m(t){const e=E.find(o=>o.id===t),r=[...E.filter(o=>o.id!==t)].sort(()=>Math.random()-.5).slice(0,3);return[e,...r].sort(()=>Math.random()-.5).map(o=>({id:o.id,name:o.name,label:o.id}))}const g=["SYSTEM CHECK...","AUDIO ENGINE: ONLINE","FREQUENCY ANALYZER: CALIBRATED","EAR TRAINER v4.0","","READY"];function u(){let t=0;return{heading:"INITIALIZING",contentKinds:["interval"],sessionLength:2,freMode:!0,autoPlay:!1,generateQuestion(e){const n=a[Math.min(t,a.length-1)];return t++,{id:`interval:${n.id}:ascending`,kind:"interval",rootNote:s,playback:{type:"interval",rootNote:s,intervals:[n.semitones],toneType:"epiano",direction:"ascending"},correctAnswer:{id:n.id,name:n.name,label:n.id},choices:m(n.id),replays:0}},async playAudio(e){const n=e.playback.intervals[0];return await A(e.rootNote,n,"ascending","epiano"),{durationMs:(.6*2+.3)*1e3+200,notes:[e.rootNote]}},getGuidanceMessage(e,n,i){return n==="idle"&&e===0?"BOOT:"+g.join(`
`):n==="idle"&&e===1?`TRANSMITTING...

LISTEN TO THE INTERVAL
IDENTIFY THE FREQUENCY`:n==="idle"&&e===2?`TRANSMITTING...

NEW FREQUENCY DETECTED
ANALYZING SIGNAL`:n==="feedback_correct"&&e===1?`OCTAVE DETECTED

SAME NOTE — HIGHER PITCH
SIGNAL CONFIRMED`:(n==="feedback_wrong"||n==="result_mode")&&e===1?`SIGNAL MISMATCH

TARGET WAS OCTAVE
CALIBRATING...`:n==="feedback_correct"&&e===2?`PERFECT 5TH CONFIRMED

STRONG SIGNAL
CALIBRATION COMPLETE`:(n==="feedback_wrong"||n==="result_mode")&&e===2?`CLOSE ENOUGH

TARGET WAS PERFECT 5TH
CALIBRATION COMPLETE`:null}}}function F(t,e){c(e,!0),T(()=>{C().settings.hasCompletedFRE&&l(`${I}/`)});const i={...u(),onSessionEnd(r){r.settings.hasCompletedFRE=!0,R(r)}};f(t,{get config(){return i}}),d()}export{F as component};
