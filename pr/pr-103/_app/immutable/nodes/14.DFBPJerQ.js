import"../chunks/CJkoOnbK.js";import{p as d,o as l,i as I}from"../chunks/BSub52x-.js";import{g as a}from"../chunks/B7usYCGk.js";import{b as s}from"../chunks/CbI2R282.js";import{Q as f}from"../chunks/o6J9eFLo.js";import{p as A}from"../chunks/CJCOLr72.js";import{I as N,s as R,l as C}from"../chunks/WoiMceEW.js";const E=[{id:"P8",name:"Octave",semitones:12},{id:"P5",name:"Perfect 5th",semitones:7}],c=60,T=N.filter(t=>t.tier<=2);function m(t){const e=T.find(o=>o.id===t),r=[...T.filter(o=>o.id!==t)].sort(()=>Math.random()-.5).slice(0,3);return[e,...r].sort(()=>Math.random()-.5).map(o=>({id:o.id,name:o.name,label:o.id}))}const u=["SYSTEM CHECK...","AUDIO ENGINE: ONLINE","FREQUENCY ANALYZER: CALIBRATED","EAR TRAINER v4.0","","READY"];function g(){let t=0;return{heading:"INITIALIZING",contentKinds:["interval"],sessionLength:2,freMode:!0,autoPlay:!1,generateQuestion(e){const n=E[Math.min(t,E.length-1)];return t++,{id:`interval:${n.id}:ascending`,kind:"interval",rootNote:c,playback:{type:"interval",rootNote:c,intervals:[n.semitones],toneType:"epiano",direction:"ascending"},correctAnswer:{id:n.id,name:n.name,label:n.id},choices:m(n.id),replays:0}},async playAudio(e){const n=e.playback.intervals[0];return await A(e.rootNote,n,"ascending","epiano"),{durationMs:(.6*2+.3)*1e3+200,notes:[e.rootNote]}},getGuidanceMessage(e,n,i){return n==="idle"&&e===0?"BOOT:"+u.join(`
`):n==="idle"&&e===1?`TRANSMITTING...

LISTEN TO THE INTERVAL
IDENTIFY THE FREQUENCY`:n==="idle"&&e===2?`TRANSMITTING...

NEW FREQUENCY DETECTED
ANALYZING SIGNAL`:n==="feedback_correct"&&e===1?`OCTAVE DETECTED

SAME NOTE -- HIGHER PITCH
SIGNAL CONFIRMED`:(n==="feedback_wrong"||n==="result_mode")&&e===1?`SIGNAL MISMATCH

TARGET WAS OCTAVE
CALIBRATING...`:n==="feedback_correct"&&e===2?`PERFECT 5TH CONFIRMED

STRONG SIGNAL
CALIBRATION COMPLETE`:(n==="feedback_wrong"||n==="result_mode")&&e===2?`CLOSE ENOUGH

TARGET WAS PERFECT 5TH
CALIBRATION COMPLETE`:null}}}function F(t,e){d(e,!0),l(()=>{C().settings.hasCompletedFRE&&a(`${s}/`)});const i={...g(),onSessionEnd(r){r.settings.hasCompletedFRE=!0,R(r),a(`${s}/quiz`)}};f(t,{get config(){return i}}),I()}export{F as component};
