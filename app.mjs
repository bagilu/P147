import {rad,degrees,wrap,clamp,dot,sidereal,horizontal,view,orientation,azimuth} from './sky.mjs';

const byId = id => document.getElementById(id);
const chart = byId('chart');
const ctx = chart.getContext('2d');
const cities = [
  ['花蓮',23.991,121.611],['臺北',25.033,121.565],['臺中',24.147,120.674],
  ['高雄',22.627,120.301],['東京',35.676,139.650],['新加坡',1.352,103.820],
  ['雪梨',-33.869,151.209],['奧克蘭',-36.850,174.765],['倫敦',51.507,-0.128],
  ['紐約',40.713,-74.006],['開普敦',-33.925,18.424],['聖地牙哥（智利）',-33.449,-70.669]
];
const starTranslations = {
  11767:'北極星', 32349:'天狼星', 30438:'老人星', 69673:'大角星', 91262:'織女一',
  24608:'五車二', 24436:'參宿七', 37279:'南河三', 27989:'參宿四', 97649:'河鼓二',
  21421:'畢宿五', 80763:'心宿二', 113368:'北落師門', 102098:'天津四', 49669:'軒轅十四',
  65474:'角宿一', 37826:'北河三', 62434:'十字架三', 60718:'十字架二', 71683:'南門二'
};
const city = byId('city');
cities.forEach(([name],index) => city.add(new Option(name,index)));
city.add(new Option('自訂座標','custom'));
let site, sky, catalog, scheduled = false, locationRequest = 0;
let az = 180, alt = 32, fov = 82, mode = 'manual', sensorView, sensorTimer, sensorRequest = 0;
let drag, hitTargets = [], selected;
const status = message => { byId('status').textContent = message; };

function setSite(lat,lon,name,choice='custom') {
  site = {lat,lon};
  city.value = choice;
  byId('lat').value = lat;
  byId('lon').value = lon;
  byId('observer').textContent = name + ' · ' + Math.abs(lat).toFixed(3) + '°' + (lat<0?'S':'N')
    + '  ' + Math.abs(lon).toFixed(3) + '°' + (lon<0?'W':'E');
  selected = undefined;
  updateSky();
}
function pickCity(index) {
  const [name,lat,lon] = cities[index];
  setSite(lat,lon,name,String(index));
}
city.addEventListener('change', () => {
  locationRequest++;
  if (city.value !== 'custom') pickCity(Number(city.value));
  else byId('lat').focus();
});
byId('site').addEventListener('submit',event => {
  event.preventDefault();
  locationRequest++;
  setSite(byId('lat').valueAsNumber,byId('lon').valueAsNumber,'自訂座標');
  status('已套用自訂座標。');
});
byId('locate').addEventListener('click',() => {
  if (!navigator.geolocation) {
    status('此瀏覽器無法提供定位。可選城市或輸入座標。');
    return;
  }
  const request = ++locationRequest;
  status('正在取得觀測位置…');
  navigator.geolocation.getCurrentPosition(({coords}) => {
    if (request !== locationRequest) return;
    setSite(Number(coords.latitude.toFixed(6)),Number(coords.longitude.toFixed(6)),'我的位置');
    status('已使用目前位置。');
  }, () => {
    if (request === locationRequest) status('定位未完成。可選城市或輸入座標。');
  }, {timeout:12000,maximumAge:60000});
});

function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { scheduled = false; draw(); });
}
function updateSky() {
  if (!catalog) return;
  const lst = sidereal(new Date(),site.lon);
  const convert = ([ra,dec]) => horizontal(ra,dec,site.lat,lst);
  sky = {
    stars:catalog.stars.map(star=>({...star,v:convert(star.eq)})).filter(star=>star.v[2]>=0),
    labels:catalog.labels.map(label=>({...label,v:convert(label.eq)})).filter(label=>label.v[2]>=0),
    paths:catalog.paths.map(path=>path.map(convert))
  };
  schedule();
}
function draw() {
  if (!sky) return;
  const width=chart.clientWidth, height=chart.clientHeight;
  if (!width || !height) return;
  const dpr=Math.min(devicePixelRatio || 1,2);
  const pixelWidth=Math.round(width*dpr), pixelHeight=Math.round(height*dpr);
  if (chart.width!==pixelWidth || chart.height!==pixelHeight) {
    chart.width=pixelWidth;
    chart.height=pixelHeight;
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const centerX=width/2, centerY=height/2;
  const basis=mode==='sensor' && sensorView ? sensorView : view(az,alt);
  const focal=Math.min(width,height)/2/Math.tan(fov*rad/2);
  const project = v => {
    const depth=dot(v,basis.forward);
    if (depth<0.08) return null;
    return [centerX+dot(v,basis.right)*focal/depth,centerY-dot(v,basis.up)*focal/depth];
  };
  const inside = point => point && point[0]>0 && point[0]<width && point[1]>0 && point[1]<height;
  const gradient=ctx.createRadialGradient(centerX,centerY,0,centerX,centerY,Math.hypot(width,height)*.55);
  gradient.addColorStop(0,'#142440');
  gradient.addColorStop(1,'#070b18');
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,width,height);
  // The local horizon projects to a straight line in a perspective view.
  const plane = ([x,y]) => basis.forward[2] + basis.right[2]*(x-centerX)/focal
    - basis.up[2]*(y-centerY)/focal;
  const corners=[[0,0],[width,0],[width,height],[0,height]];
  const ground=[], horizon=[];
  corners.forEach((corner,i) => {
    const next=corners[(i+1)%4], a=plane(corner), b=plane(next);
    if (a<=0) ground.push(corner);
    if ((a<=0)!==(b<=0)) {
      const t=a/(a-b);
      const crossing=corner.map((value,j)=>value+(next[j]-value)*t);
      ground.push(crossing);
      horizon.push(crossing);
    }
  });
  if (ground.length) {
    ctx.beginPath();
    ctx.moveTo(...ground[0]);
    ground.slice(1).forEach(point=>ctx.lineTo(...point));
    ctx.closePath();
    ctx.fillStyle='#101522';
    ctx.fill();
  }
  if (horizon.length===2) {
    ctx.beginPath();
    ctx.moveTo(...horizon[0]);
    ctx.lineTo(...horizon[1]);
    ctx.strokeStyle='#647794';
    ctx.stroke();
  }
  if (byId('lines').checked) {
    ctx.beginPath();
    for (const path of sky.paths) {
      for (let i=1;i<path.length;i++) {
        const first=path[i-1], second=path[i];
        if (first[2]<0 && second[2]<0) continue;
        const cutoff=first.map((value,j)=>value+(second[j]-value)*first[2]/(first[2]-second[2]));
        const a=project(first[2]<0?cutoff:first), b=project(second[2]<0?cutoff:second);
        if (!a || !b) continue;
        ctx.moveTo(...a);
        ctx.lineTo(...b);
      }
    }
    ctx.strokeStyle='#577ca9';
    ctx.stroke();
  }
  hitTargets=[];
  let nearby, nearest=dot(basis.forward,basis.forward)*Math.cos(9*rad);
  ctx.fillStyle='#edf5ff';
  for (const star of sky.stars) {
    const point=project(star.v);
    if (!inside(point)) continue;
    const radius=clamp(3.1-star.mag*.43,.6,4);
    ctx.globalAlpha=clamp(1.05-star.mag*.115,.28,1);
    ctx.beginPath();
    ctx.arc(...point,radius,0,Math.PI*2);
    ctx.fill();
    if (star.en && star.mag<=3.1) {
      hitTargets.push({point,item:star,radius:14});
      const similarity=dot(star.v,basis.forward);
      if (similarity>nearest) { nearest=similarity; nearby=star; }
    }
  }
  ctx.globalAlpha=1;
  ctx.font='13px system-ui, sans-serif';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillStyle='#b7ceef';
  ctx.strokeStyle='#0b1325';
  ctx.lineWidth=3;
  const labels=[];
  for (const label of sky.labels) {
    const point=project(label.v);
    if (!inside(point)) continue;
    const half=ctx.measureText(label.zh).width/2;
    if (point[0]<half+4 || point[0]>width-half-4 || point[1]<36 || point[1]>height-12) continue;
    if (labels.some(other=>Math.abs(other.point[0]-point[0])<other.half+half+6
      && Math.abs(other.point[1]-point[1])<17)) continue;
    labels.push({point,half});
    ctx.strokeText(label.zh,...point);
    ctx.fillText(label.zh,...point);
    hitTargets.push({point,item:label,radius:Math.max(15,half)});
    const similarity=dot(label.v,basis.forward);
    if (similarity>nearest && !nearby?.constellation) { nearest=similarity; nearby=label; }
  }
  ctx.beginPath();
  ctx.moveTo(centerX-12,centerY); ctx.lineTo(centerX-4,centerY);
  ctx.moveTo(centerX+4,centerY); ctx.lineTo(centerX+12,centerY);
  ctx.moveTo(centerX,centerY-12); ctx.lineTo(centerX,centerY-4);
  ctx.moveTo(centerX,centerY+4); ctx.lineTo(centerX,centerY+12);
  ctx.strokeStyle='#d4e7ff';
  ctx.lineWidth=1.4;
  ctx.stroke();
  const bearing=wrap(Math.round(azimuth(basis.forward)));
  const elevation=degrees(Math.asin(clamp(basis.forward[2],-1,1)));
  const compass=['北','東北','東','東南','南','西南','西','西北'];
  byId('bearing').textContent=compass[Math.round(bearing/45)%8]+' '+bearing+'° · 仰角 '+Math.round(elevation)+'°';
  byId('zoom-label').textContent='視野 '+fov+'°';
  const item=selected || nearby;
  const title=item ? [item.zh,selected && item.en!==item.zh ? item.en : '',item.constellation].filter(Boolean).join(' · ')
    : elevation<0 ? '準星朝向地平線下方' : '準星附近未標出亮星或星座';
  byId('target').textContent=title;
}

function setMode(next) {
  mode=next;
  byId('manual').setAttribute('aria-pressed',String(mode==='manual'));
  byId('sensor').setAttribute('aria-pressed',String(mode==='sensor'));
  selected=undefined;
  schedule();
}
function manual(message='拖曳星圖移動，點選亮星或星座名稱查看。') {
  sensorRequest++;
  clearTimeout(sensorTimer);
  if (sensorView && mode==='sensor') {
    az=azimuth(sensorView.forward);
    alt=degrees(Math.asin(clamp(sensorView.forward[2],-1,1)));
  }
  sensorView=undefined;
  setMode('manual');
  status(message);
}
byId('manual').addEventListener('click',()=>manual());
byId('sensor').addEventListener('click',async () => {
  const Event=window.DeviceOrientationEvent;
  if (mode==='sensor') return;
  if (!Event || !isSecureContext) {
    manual('手機指向需要支援方向感測的瀏覽器與 HTTPS。');
    return;
  }
  const request=++sensorRequest;
  try {
    if (typeof Event.requestPermission==='function' && await Event.requestPermission(true)!=='granted') {
      if (request===sensorRequest) manual('方向感測未授權。仍可使用手動星圖。');
      return;
    }
  } catch {
    if (request===sensorRequest) manual('無法取得方向感測權限。仍可使用手動星圖。');
    return;
  }
  if (request!==sensorRequest) return;
  setMode('sensor');
  status('正在等待手機提供方向資料…');
  sensorTimer=setTimeout(()=>manual('手機未提供可用的絕對方位。請改用手動星圖。'),3500);
});
function readSensor(event) {
  if (mode!=='sensor') return;
  const {alpha,beta,gamma,absolute,webkitCompassHeading,webkitCompassAccuracy}=event;
  const apple=Number.isFinite(webkitCompassHeading) && webkitCompassHeading>=0
    && (!Number.isFinite(webkitCompassAccuracy) || webkitCompassAccuracy>=0);
  if (!absolute && !apple) return;
  const heading=apple?-webkitCompassHeading:alpha;
  if (![heading,beta,gamma].every(Number.isFinite)) return;
  const screenAngle=screen.orientation?.angle ?? window.orientation ?? 0;
  const next=orientation(heading-Number(byId('offset').value),beta,gamma,screenAngle);
  if (!sensorView) status('手機指向已啟用。若有偏移，可以微調方位校準。');
  sensorView=next;
  clearTimeout(sensorTimer);
  sensorTimer=setTimeout(()=>manual('方向資料已中斷。已切回手動星圖。'),4500);
  schedule();
}
window.addEventListener('deviceorientationabsolute',readSensor);
window.addEventListener('deviceorientation',readSensor);

function changeZoom(delta) {
  fov=clamp(fov+delta,25,120);
  schedule();
}
byId('in').addEventListener('click',()=>changeZoom(-8));
byId('out').addEventListener('click',()=>changeZoom(8));
byId('lines').addEventListener('change',schedule);
function showOffset() {
  byId('offset-label').value=byId('offset').value+'°';
}
byId('offset').addEventListener('input',showOffset);
byId('reset').addEventListener('click',()=>{byId('offset').value=0;showOffset();});

chart.addEventListener('pointerdown',event => {
  if (!event.isPrimary || event.button!==0) return;
  chart.setPointerCapture(event.pointerId);
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,az,alt,moved:false};
});
chart.addEventListener('pointermove',event => {
  if (!drag || drag.id!==event.pointerId) return;
  const dx=event.clientX-drag.x, dy=event.clientY-drag.y;
  if (Math.hypot(dx,dy)>5) drag.moved=true;
  if (mode!=='manual' || !drag.moved) return;
  const scale=fov/Math.min(chart.clientWidth,chart.clientHeight);
  az=wrap(drag.az-dx*scale);
  alt=clamp(drag.alt+dy*scale,-89,89);
  selected=undefined;
  schedule();
});
chart.addEventListener('pointerup',event => {
  if (!drag || drag.id!==event.pointerId) return;
  if (!drag.moved) {
    const rect=chart.getBoundingClientRect();
    let distance=Infinity;
    selected=undefined;
    for (const {point,item,radius} of hitTargets) {
      const d=Math.hypot(event.clientX-rect.left-point[0],event.clientY-rect.top-point[1]);
      if (d<=radius && d<distance) { selected=item; distance=d; }
    }
    schedule();
  }
  drag=undefined;
});
chart.addEventListener('lostpointercapture',()=>{drag=undefined;});
chart.addEventListener('keydown',event => {
  const directions={ArrowUp:[0,5],ArrowDown:[0,-5],ArrowLeft:[-5,0],ArrowRight:[5,0]};
  if (event.key==='+' || event.key==='=') changeZoom(-8);
  else if (event.key==='-') changeZoom(8);
  else if (mode==='manual' && directions[event.key]) {
    const [dx,dy]=directions[event.key];
    az=wrap(az+dx);
    alt=clamp(alt+dy,-89,89);
    selected=undefined;
    schedule();
  } else return;
  event.preventDefault();
});
new ResizeObserver(schedule).observe(chart);
pickCity(0);

async function loadJson(file) {
  const response=await fetch('./data/'+file);
  if (!response.ok) throw new Error('Unable to load '+file);
  return response.json();
}
try {
  const [stars,labels,lines,names]=await Promise.all([
    loadJson('stars.6.json'),loadJson('constellations.json'),
    loadJson('constellations.lines.json'),loadJson('starnames.json')
  ]);
  const constellationNames=new Map(labels.features.map(item=>[item.id,item.properties.zh?.replace('飛鱼座','飛魚座') || item.properties.en]));
  catalog={
    stars:stars.features.map(({id,geometry,properties})=>{
      const entry=names[id];
      return {eq:geometry.coordinates,mag:properties.mag,en:entry?.name,
        zh:starTranslations[id] || entry?.name,constellation:constellationNames.get(entry?.c)};
    }),
    labels:labels.features.map(({geometry,properties})=>({
      eq:geometry.coordinates,zh:properties.zh?.replace('飛鱼座','飛魚座') || properties.en,en:properties.en
    })),
    paths:lines.features.flatMap(item=>item.geometry.coordinates)
  };
  updateSky();
  setInterval(updateSky,5000);
} catch (error) {
  console.error(error);
  byId('target').textContent='無法載入星表';
  status('請重新整理頁面，或確認網站的 data 資料夾已上傳。');
}
