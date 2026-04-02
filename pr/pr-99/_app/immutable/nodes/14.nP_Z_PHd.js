import"../chunks/BZtNfWoH.js";import{p as E,o as d,i as l}from"../chunks/CG8-kGya.js";import{g as f}from"../chunks/DNsrWGbB.js";import{b as I}from"../chunks/CLh-H4TN.js";import{Q as T}from"../chunks/DWIeL_2M.js";import{p as A}from"../chunks/DoW2FhrS.js";import{I as C,s as m,l as R}from"../chunks/5kGhX9K2.js";const a=[{id:"P8",name:"Octave",semitones:12},{id:"P5",name:"Perfect 5th",semitones:7}],s=60,c=C.filter(t=>t.tier<=2);function N(t){const n=c.find(o=>o.id===t),r=[...c.filter(o=>o.id!==t)].sort(()=>Math.random()-.5).slice(0,3);return[n,...r].sort(()=>Math.random()-.5).map(o=>({id:o.id,name:o.name,label:o.id}))}const u=["SYSTEM CHECK...","AUDIO ENGINE: ONLINE","FREQUENCY ANALYZER: CALIBRATED","EAR TRAINER v4.0","","READY"];function g(){let t=0;return{heading:"INITIALIZING",contentKinds:["interval"],sessionLength:2,freMode:!0,autoPlay:!1,generateQuestion(n){const e=a[Math.min(t,a.length-1)];return t++,{id:`interval:${e.id}:ascending`,kind:"interval",rootNote:s,playback:{type:"interval",rootNote:s,intervals:[e.semitones],toneType:"epiano",direction:"ascending"},correctAnswer:{id:e.id,name:e.name,label:e.id},choices:N(e.id),replays:0}},async playAudio(n){const e=n.playback.intervals[0];return await A(n.rootNote,e,"ascending","epiano"),{durationMs:(.6*2+.3)*1e3+200,notes:[n.rootNote]}},getGuidanceMessage(n,e,i){return e==="idle"&&n===0?"BOOT:"+u.join(`
`):e==="idle"&&n===2?`SIGNAL ACQUIRED

NEW FREQUENCY DETECTED
ANALYZING...`:e==="feedback_correct"&&n===1?`OCTAVE DETECTED

SAME NOTE — HIGHER PITCH
SIGNAL CONFIRMED`:(e==="feedback_wrong"||e==="result_mode")&&n===1?`SIGNAL MISMATCH

TARGET WAS OCTAVE
CALIBRATING...`:e==="feedback_correct"&&n===2?`PERFECT 5TH CONFIRMED

STRONG SIGNAL
CALIBRATION COMPLETE`:(e==="feedback_wrong"||e==="result_mode")&&n===2?`CLOSE ENOUGH

TARGET WAS PERFECT 5TH
CALIBRATION COMPLETE`:null}}}function v(t,n){E(n,!0),d(()=>{R().settings.hasCompletedFRE&&f(`${I}/`)});const i={...g(),onSessionEnd(r){r.settings.hasCompletedFRE=!0,m(r)}};T(t,{get config(){return i}}),l()}export{v as component};
