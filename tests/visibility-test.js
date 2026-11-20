// Mocked UI regression tests. Run: node tests/visibility-test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert').strict;
const project = path.resolve(__dirname, '..');
const source = (name) => fs.readFileSync(path.join(project, name), 'utf8');

function testLayout(mode, route = "/reel/example/") {
  function eventTarget(base={}) {
    return Object.assign(base, {
      listeners: {},
      addEventListener(name, callback) {
        (this.listeners[name] ||= []).push(callback);
      },
      removeEventListener() {},
      emit(name, event={}) {
        (this.listeners[name] || []).forEach(fn => fn(event));
      },
    });
  }
  function iframe(name) {
    const buttons = {};
    const doc = eventTarget({
      body: {classList: {toggle:()=>{}, remove:()=>{}}},
      getElementById(id) {
        return buttons[id] ||= eventTarget({style:{}, options:[],value:'1'});
      },
    });
    return {name,style:{display:'none',opacity:'0'},contentDocument:doc,remove(){}};
  }
  const bar = iframe('bar');
  const volume = iframe('volume');
  const launcher = iframe('launcher');
  const bounds = {left:100,top:100,right:650,bottom:550,width:550,height:450};
  const video = eventTarget({
    dataset:{},paused:false,ended:false,duration:99,currentTime:4,volume:0.7,muted:false,playbackRate:1,
    getBoundingClientRect:()=>bounds,
  });
  const options = {showControlsOnlyOnHover:false,showDownloadButton:true};
  const timers = [];
  const intervals = [];
  let feedPlacementCalls = 0;
  let externalPlacementCalls = 0;
  const igvc = {
    EXTENSION_MARK:'myControls',BAR_HEIGHT:42,VOLUME_WIDTH:28,VOLUME_HEIGHT:86,
    POSITION_INTERVAL_MS:200,HIDE_DELAY_MS:700,VOLUME_HIDE_DELAY_MS:350,
    overlays:new Map(),intentionallyPausedVideos:new WeakSet(),
    applySavedState(){},clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),
    createBarIframe:()=>bar,createVolumeIframe:()=>volume,createCompactLauncherIframe:()=>launcher,
    computeControlsPlacement:() => {
      externalPlacementCalls++;
      return {mode, left:108,top:490,width:500};
    },
    computeFeedOverlayPlacement:() => {
      feedPlacementCalls++;
      return {mode:'compact', left:104, top:504, width:542};
    },
    forceSavedStateRepeatedly(){},formatTime:x=>`${x}`,getDuration:v=>v.duration,getFastDlUrl:()=>null,
    getPreferredState:()=>({hasState:false}),getSettings:()=>options,
    hasPreferredStateMismatch:()=>false,pauseOtherVideosExcept(){},setActiveControlledVideo(){},
    isAllowedVideo:()=>true,isInternalPauseAllowed:()=>false,isMouseInsideRect:()=>true,
    isStoriesPage:()=>false,isVideoVisible:()=>true,runWithAllowedPause:fn=>fn(),
    saveState(){},setVideoTime(){},
  };
  const doc=eventTarget({contains:()=>true});
  const win={__igvc:igvc,innerWidth:800,innerHeight:600,location:{pathname:route},open() {}};
  const ctx=vm.createContext({window:win,document:doc,console,
    setTimeout:fn=>{timers.push(fn);return timers.length;},
    clearTimeout(){},setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval() {},
    alert() {}});
  vm.runInContext(source('src/controls.js'),ctx);
  igvc.attachControls(video);
  const collapse=bar.contentDocument.getElementById('collapseButton');
  assert.equal(bar.style.display,'block',`${mode}: toolbar must be initially open`);
  assert.equal(collapse.style.display,'flex',`${mode}: close button should be present`);
  assert.equal(launcher.style.display,'none');
  if (route === '/') {
    assert.ok(feedPlacementCalls>0, 'home feed must use overlay placement');
    assert.equal(externalPlacementCalls,0, 'home feed must not use outside docking');
    assert.equal(bar.style.left,'104px');
    assert.equal(bar.style.top,'504px');
    assert.equal(bar.style.width,'542px');
  } else {
    assert.equal(feedPlacementCalls,0, 'Reels must keep their previous placement');
    assert.ok(externalPlacementCalls>0);
  }
  collapse.emit('click');
  assert.equal(bar.style.display,'none',`${mode}: closes on explicit click`);
  assert.equal(launcher.style.display,'block',`${mode}: restore button visible`);
  doc.emit('mousemove', {clientX:120,clientY:120});
  intervals.forEach(fn=>fn());
  timers.slice().forEach(fn=>fn());
  assert.equal(bar.style.display,'none',`${mode}: updates must not undo manual close`);
  launcher.contentDocument.getElementById('openControls').emit('click');
  assert.equal(bar.style.display,'block',`${mode}: opens on explicit click`);
  assert.equal(launcher.style.display,'none',`${mode}: launcher should hide when bar is open`);
}

testLayout('docked');
testLayout('compact');
testLayout('docked', '/');

// Existing users with old saved hover-only behavior get the new default once.
let items={showControlsOnlyOnHover:true,backgroundStories:true};
let pageSettings=null;
let notify=()=>{};
const chrome={storage:{
  sync:{
    get(key,cb){cb({...items});},
    set(changes){items={...items,...changes};notify({},'sync');},
  },
  onChanged:{addListener(fn){notify=fn;}},
}};
const localStorage={setItem(key,value){pageSettings=JSON.parse(value);}};
vm.runInNewContext(source('src/options-loader.js'),{chrome,localStorage,console});
assert.equal(items.showControlsOnlyOnHover,false);
assert.equal(pageSettings.showControlsOnlyOnHover,false);
assert.equal(items.backgroundStories,true);
// After migration, a user may opt back into hover mode and the choice remains.
items.showControlsOnlyOnHover=true;
notify({},'sync');
assert.equal(pageSettings.showControlsOnlyOnHover,true);
console.log('PASS: home feed in-video controls (not side-docked), Reels unaffected, explicit close/reopen, no auto reopening, options migration');
