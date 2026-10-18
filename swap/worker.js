'use strict';
importScripts('engine.js');
self.onmessage=function(event){
 const {id,seed,difficulty}=event.data;
 try{
  const iterator=SwapEngine.generateSteps(seed,difficulty);let step,count=0;
  do{step=iterator.next();if(!step.done&&++count%8===0)self.postMessage({id,type:'progress',progress:step.value});}while(!step.done);
  self.postMessage({id,type:'result',puzzle:step.value});
 }catch(error){self.postMessage({id,type:'error',message:String(error.message||error)});}
};
