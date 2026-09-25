(function(){
  const GRID_SIZE=16;
  const grid=document.getElementById('grid');
  const micBtn=document.getElementById('micBtn');
  const stopBtn=document.getElementById('stopBtn');
  const fileInput=document.getElementById('fileInput');
  const dropZone=document.getElementById('dropZone');
  const statusEl=document.getElementById('status');
  const playerWrap=document.getElementById('player');
  const audioEl=document.getElementById('audioEl');
  const cats=[
    document.getElementById('cat1'),
    document.getElementById('cat2'),
    document.getElementById('cat3')
  ];
  const cells=[];
  for(let r=0;r<GRID_SIZE;r++){
    cells[r]=[];
    for(let c=0;c<GRID_SIZE;c++){
      const cell=document.createElement('div');
      cell.className='cell';
      grid.appendChild(cell);
      cells[r][c]=cell;
    }
  }
 const bands=[
  {lo:20,hi:60,rows:[14,15],sens:0.5,color:[255,70,70]},
  {lo:60,hi:250,rows:[12,13],sens:0.7,color:[255,120,70]},
  {lo:250,hi:500,rows:[10,11],sens:0.9,color:[255,200,70]},
  {lo:500,hi:2000,rows:[7,8,9],sens:1.1,color:[80,180,255]},
  {lo:2000,hi:4000,rows:[4,5,6],sens:1.3,color:[120,100,255]},
  {lo:4000,hi:6000,rows:[2,3],sens:1.5,color:[220,90,255]},
  {lo:6000,hi:16000,rows:[0,1],sens:1.7,color:[255,255,255]}
];
  let audioCtx;
  let analyser;
  let dataArray;
  let micStream;
  let micSource;
  let fileSource;
  let rafId;
  let mode=null;
  let lastBounce=0;
  function setupAudio(){
    if(!audioCtx){
      audioCtx=new(window.AudioContext||window.webkitAudioContext)();
      analyser=audioCtx.createAnalyser();
      analyser.fftSize=2048;
      analyser.smoothingTimeConstant=0.1;
      dataArray=new Uint8Array(analyser.frequencyBinCount);
    }
    if(audioCtx.state==='suspended')audioCtx.resume();
  }
  function freqToBin(freq){
    const nyquist=audioCtx.sampleRate/2;
    return Math.round((freq/nyquist)*dataArray.length);
  }
  function getBandLevel(band){
    const start=freqToBin(band.lo);
    const end=freqToBin(band.hi);
    let total=0;
    let count=0;
    for(let i=start;i<=end&&i<dataArray.length;i++){
      total+=dataArray[i];
      count++;
    }
    const average=count?total/count:0;
    return Math.min(1,(average/300)*band.sens);
  }
  function clearGrid(){
    for(let r=0;r<GRID_SIZE;r++){
      for(let c=0;c<GRID_SIZE;c++){
        cells[r][c].style.background='var(--cell-off)';
        cells[r][c].style.boxShadow='none';
      }
    }
  }
  function lightCell(cell,level,color){
    const[r,g,b]=color;
    cell.style.background=`rgba(${r},${g},${b},${0.3+level*0.7})`;
    cell.style.boxShadow=`0 0 ${4+level*12}px rgba(${r},${g},${b},${level})`;
  }
  function shuffle(array){
    for(let i=array.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [array[i],array[j]]=[array[j],array[i]];
    }
    return array;
  }
  function drawBand(band,level){
    if(level<0.05)return;
    const available=[];
    band.rows.forEach(row=>{
      for(let col=0;col<GRID_SIZE;col++){
        available.push(cells[row][col]);
      }
    });
    const amount=Math.round(level*available.length);
    shuffle(available).slice(0,amount).forEach(cell=>{
      lightCell(cell,level,band.color);
    });
  }
  function bounceCats(bass){
    const now=performance.now();
    if(bass<0.35||now-lastBounce<200)return;
    lastBounce=now;
    cats.forEach(cat=>{
      const height=15+Math.random()*25;
      cat.animate([
        {transform:'translateY(0px)'},
        {transform:`translateY(-${height}px)`},
        {transform:'translateY(0px)'}
      ],{
        duration:250,
        easing:'ease-out'
      });
    });
  }
  function loop(){
    if(!mode){
      rafId=null;
      return;
    }
    analyser.getByteFrequencyData(dataArray);
    clearGrid();
    let bass=0;
    bands.forEach((band,index)=>{
      const level=getBandLevel(band);
      drawBand(band,level);
      if(index===1)bass=level;
    });
    bounceCats(bass);
    rafId=requestAnimationFrame(loop);
  }
  async function startMic(){
    try{
      stopFile(true);
      setupAudio();
      statusEl.textContent='Requesting microphone…';
      micStream=await navigator.mediaDevices.getUserMedia({audio:true});
      micSource=audioCtx.createMediaStreamSource(micStream);
      micSource.connect(analyser);
      mode='mic';
      micBtn.classList.add('active');
      playerWrap.style.display='none';
      statusEl.textContent='Listening to microphone…';
      if(!rafId)loop();
    }catch(err){
      console.error(err);
      statusEl.textContent='Microphone access denied or unavailable.';
    }
  }
  function stopMic(){
    if(micSource){
      try{micSource.disconnect();}catch(e){}
      micSource=null;
    }
    if(micStream){
      micStream.getTracks().forEach(track=>track.stop());
      micStream=null;
    }
    micBtn.classList.remove('active');
    if(mode==='mic')mode=null;
  }
  function loadFile(file){
    stopMic();
    setupAudio();
    audioEl.src=URL.createObjectURL(file);
    playerWrap.style.display='block';
    statusEl.textContent='Loaded: '+file.name;
    if(!fileSource){
      fileSource=audioCtx.createMediaElementSource(audioEl);
      fileSource.connect(analyser);
      analyser.connect(audioCtx.destination);
    }
    mode='file';
    audioEl.play().catch(()=>{
      statusEl.textContent='Press play to start.';
    });
    if(!rafId)loop();
  }
  function stopFile(silent){
    audioEl.pause();
    audioEl.currentTime=0;
    if(!silent){
      playerWrap.style.display='none';
      statusEl.textContent='Idle';
    }
    if(mode==='file')mode=null;
  }
  function stopAll(){
    stopMic();
    stopFile(false);
    if(rafId){
      cancelAnimationFrame(rafId);
      rafId=null;
    }
    clearGrid();
    statusEl.textContent='Idle';
  }
  micBtn.addEventListener('click',()=>{
    if(mode==='mic')stopAll();
    else startMic();
  });
  stopBtn.addEventListener('click',stopAll);
  fileInput.addEventListener('change',e=>{
    const file=e.target.files&&e.target.files[0];
    if(file)loadFile(file);
  });
  dropZone.addEventListener('click',()=>fileInput.click());
  dropZone.addEventListener('dragover',e=>{
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave',()=>{
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop',e=>{
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file=e.dataTransfer.files&&e.dataTransfer.files[0];
    if(file)loadFile(file);
  });
  audioEl.addEventListener('ended',()=>{
    clearGrid();
    statusEl.textContent='Playback finished.';
  });
})();