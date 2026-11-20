// Dependency-free behavioral regression tests. Run: node tests/test.js
const fs = require('fs');
const vm = require('vm');
const assert = require('assert').strict;
const path = require('path');
const project = path.resolve(__dirname, '..');
const run = (file, context) => vm.runInContext(fs.readFileSync(path.join(project, file), 'utf8'), context, {filename:file});
function area(left, top, width, height) {
  return {left,top,width,height,right:left+width,bottom:top+height};
}
function makeEnv() {
  const listeners = {};
  const videos = [];
  let focus = true;
  class HTMLMediaElement {
    constructor() {this.paused=true;this.ended=false;this.playCalls=0;this.pauseCalls=0;}
    pause() {this.pauseCalls++;this.paused = true;}
    play() {this.playCalls++;this.paused=false;return Promise.resolve();}
  }
  class HTMLVideoElement extends HTMLMediaElement {
    constructor(bounds) {super();this.bounds=bounds;this.dataset={};}
    getBoundingClientRect() {return this.bounds;}
  }
  const doc = {
    hidden:false, visibilityState:'visible',
    hasFocus:()=>focus,
    contains:(node)=>videos.includes(node),
    querySelectorAll:(selector)=>selector==='video'?videos:[],
    addEventListener:(name,cb)=>((listeners[name]??=[]).push(cb)),
  };
  const win = {innerWidth:1000,innerHeight:800,location:{pathname:'/stories/someone/1/'},
    addEventListener:(name,cb)=>((listeners[name]??=[]).push(cb)),
    __igvc:{BAR_HEIGHT:42,EXTENSION_MARK:'igvcIframeAttached',overlays:new Map(),
      intentionallyPausedVideos:new WeakSet(),backgroundWantedVideos:new Set(),activeVideo:null,
      getSettings:()=>({backgroundPlayback:true, backgroundStories:true, keepCurrentVideoPlaying:true}),
      applySavedState:()=>{},forceSavedStateOnAllVideos:()=>{},forceSavedStateRepeatedly:()=>{},
      isStoriesPage:()=>win.location.pathname.startsWith('/stories/')}
  };
  const intervals=[];
  const context=vm.createContext({window:win,document:doc,HTMLMediaElement,HTMLVideoElement,
    console,setTimeout:(fn)=>{intervals.push(fn); return intervals.length;},
    setInterval:(fn)=>{intervals.push(fn); return intervals.length;}});
  run('src/control-layout.js', context);
  run('src/background-playback.js', context);
  return {win,doc,videos,listeners,HTMLVideoElement, setFocus:(x)=>focus=x,context};
}
const env=makeEnv();
const {computeControlsPlacement:layout}=env.win.__igvc;
let p=layout(area(300,100,400,300),1000,800);
assert.equal(p.mode,'docked');assert.equal(p.side,'below');assert.ok(p.top>=400);
p=layout(area(300,450,400,300),1000,800);
assert.equal(p.mode,'docked');assert.equal(p.side,'above');assert.ok(p.top+42<=450);
p=layout(area(50,0,400,800),1000,800);
assert.equal(p.mode,'docked');assert.equal(p.side,'right'); assert.ok(p.left>=450);
p=layout(area(0,0,1000,800),1000,800);
assert.equal(p.mode,'compact');assert.equal(p.width,1000-16);


// Feed toolbar is always inside the visible VIDEO, never in the side gutter.
const feedPlacement = env.win.__igvc.computeFeedOverlayPlacement;
p=feedPlacement(area(320,120,430,400),1000,800);
assert.equal(p.mode,'compact');assert.equal(p.side,'inside');
assert.ok(p.left>=320 && p.left+p.width<=750,'feed bar must fit video horizontally');
assert.ok(p.top>=120 && p.top+42<=520,'feed bar must fit video vertically');
assert.equal(p.width,422);
// As the feed scrolls, the toolbar follows the *visible* video area.
p=feedPlacement(area(320,-300,430,400),1000,800);
assert.ok(p.top>=0 && p.top+42<=100,'must remain inside visible video');
p=feedPlacement(area(320,-380,430,400),1000,800);
assert.equal(p,null,'do not place toolbar over captions when only 20px of video is visible');
p=feedPlacement(area(320,120,240,400),1000,800);
assert.equal(p.width,232,'narrow feed video must not overflow horizontally');
p=feedPlacement(area(320,120,150,400),1000,800);
assert.equal(p,null,'tiny feed videos cannot fit a functional toolbar');

// Regression: available *viewport* space can be occupied by Instagram's
// reaction row/caption. Decline both below and above when inside the post.
const {isDockingAreaSafe: safeDock}=env.win.__igvc;
const genericElement = {closest:()=>null};
const emptyPage = {elementsFromPoint:()=>[genericElement]};
const postVideo = {closest:()=>({getBoundingClientRect:()=>area(290,0,420,650)})};
p=layout(area(300,200,400,300),1000,800, c => safeDock(c,postVideo,emptyPage,[]));
assert.equal(p.mode, 'compact', 'must not cover a post even when below-video area exists');
assert.ok(p.launcherTop < 200 + 42, 'launcher is at the top corner of the video');

// Without an enclosing article, a hit on a reaction button still makes the
// candidate unsafe, including when a transparent extension iframe is on top.
const actionButton = {closest:(sel)=>sel.includes('button')?actionButton:null};
const ownFrame = {dataset:{igvcOverlay:'bar'}};
const hitPage = {elementsFromPoint:()=>[ownFrame,actionButton]};
assert.equal(safeDock({left:300,top:506,width:400}, {closest:()=>null},hitPage,[ownFrame]), false);
assert.equal(safeDock({left:300,top:506,width:400}, {closest:()=>null},emptyPage,[]), true);
assert.equal(safeDock({left:300,top:506,width:400}, {closest:()=>null},null,[]), false);
// Prefer another safe side if the area directly under the video is blocked.
p=layout(area(300,200,400,300),1000,800,
  c=>c.side !== 'below' && c.side !== 'above');
assert.equal(p.mode, 'compact');

const story1=new env.HTMLVideoElement(area(200,100,400,600));
env.videos.push(story1);
const bg=env.win.__igvc;
bg.installPauseGuard();bg.installBackgroundPlaybackHandlers();
// No autoplay of a Story that is already paused.
assert.equal(bg.shouldBlockInstagramAutoPause(story1),false);
// A playing Story should be selected without adding playback controls.
story1.play();env.listeners.play.forEach(fn=>fn({target:story1}));
env.setFocus(false);
env.doc.hidden=true;env.doc.visibilityState='hidden';
assert.equal(bg.shouldBlockInstagramAutoPause(story1),true);
story1.pause(); // Guard blocks Instagram background auto-pause.
assert.equal(story1.paused,false);
// A new Story may play without keeping the old one alive.
const story2=new env.HTMLVideoElement(area(200,100,400,600));
env.videos.push(story2);
story2.play();env.listeners.play.forEach(fn=>fn({target:story2}));
assert.equal(story1.paused,true);
assert.equal(bg.shouldBlockInstagramAutoPause(story1),false);
assert.equal(bg.shouldBlockInstagramAutoPause(story2),true);
// On foreground user pause must be respected.
env.doc.hidden=false;env.doc.visibilityState='visible';env.setFocus(true);
story2.pause();env.listeners.pause.forEach(fn=>fn({target:story2}));
env.setFocus(false);env.doc.hidden=true;env.doc.visibilityState='hidden';
assert.equal(bg.shouldBlockInstagramAutoPause(story2),false);
bg.rememberPlayingVideosBeforeBackground();
assert.equal(bg.backgroundWantedVideos.size,0);
// Extension only acts on Stories route and not on arbitrary page videos.
env.win.location.pathname='/reel/example/';
assert.equal(bg.isStoryVideo(story2),false);
assert.equal(bg.shouldBlockInstagramAutoPause(story2),false);
console.log('PASS: feed inside-video overlay, collision-aware Reels docking, protected reactions/captions, compact fallback, Story background guard, transitions, user pauses, route restriction');
