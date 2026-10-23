import raw from './network.json';
import shadeRaw from './shade.json';
export type Point = {lat:number;lon:number};
export type Place = Point & {id:string;name:string;kind:string;source:string};
type Node = Point & {id:string;tags:Record<string,string>};
type Way = {id:string;nodes:string[];tags:Record<string,string>};
type Edge = {to:string;m:number;way:Way};
export type Mode = 'walk'|'drive';
export type Profile = {id:string;name:string;role:string;speed:number;restEvery:number;rest:number;stepFree:boolean;heatSensitive:boolean;defaultDeparture:string;color:string};
export const profiles:Profile[]=[
 {id:'parent',name:'Aisyah',role:'Working parent',speed:1.15,restEvery:1200,rest:0,stepFree:false,heatSensitive:false,defaultDeparture:'07:30',color:'#c07546'},
 {id:'shift',name:'Ravi',role:'Shift worker',speed:1.3,restEvery:1500,rest:0,stepFree:false,heatSensitive:false,defaultDeparture:'22:00',color:'#74719e'},
 {id:'wheel',name:'Mei Ling',role:'Wheelchair user',speed:1,restEvery:400,rest:1,stepFree:true,heatSensitive:true,defaultDeparture:'10:00',color:'#397c78'},
 {id:'retired',name:'Uncle Tan',role:'Walking-aid user',speed:.8,restEvery:150,rest:1.5,stepFree:true,heatSensitive:true,defaultDeparture:'09:00',color:'#748144'},
];
export const network=raw as unknown as {date:string;bounds:[number,number][];nodes:Node[];ways:Way[];places:Place[];parking:Place[]};
export const shadeData = shadeRaw as unknown as Record<string, number>;
export const homes:Place[]=[{id:'home-gamelan',name:'Gamelan · example home',lat:3.0846,lon:101.4347,kind:'home',source:'Illustrative home location'}, {id:'home-rodat',name:'Rodat · example home',lat:3.0877,lon:101.436,kind:'home',source:'Illustrative home location'}];
export const places:Place[]=[...homes,...network.places];
export const options=[{id:'seating',name:'Shaded rest stops',cost:45000,description:'Proposed seats and tree-shaded sections within 500 m of the study park. Fully shades those walking edges and reduces assumed rest burden.'},{id:'crossing',name:'Shorter crossing waits',cost:120000,description:'Proposed signal timing near school: pedestrian wait 45 → 15 seconds; adds 15 seconds for drivers.'},{id:'pickup',name:'Family pickup area',cost:85000,description:'School pickup queue 7 → 3 minutes; adds a 30-second driveway conflict for people walking past.'}];
export const school=places.find(p=>p.name.includes('Ladang Bukit'))!;
export const park=places.find(p=>p.name==='BBR Sales Gallery Park')!;
export const shop=places.find(p=>p.name==='Watsons')!;
export const clinic=places.find(p=>p.kind==='clinic')!;
// The OSM snapshot's walking network has two disconnected clusters; the
// reachable-from-Gamelan south cluster contains Watsons, 99 Speedmart (south)
// and FamilyMart (south). Pharmacy/clinic chains only have matching tags in
// the unreachable north cluster, so we use the nearest reachable chemist/shop
// instead and label the choice in the UI assumptions.
export const pharmacy=places.find(p=>p.name==='Watsons')!;
export const supermarket=places.filter(p=>p.kind==='supermarket').sort((a,b)=>a.lat-b.lat)[0]!;
export const convenience=places.filter(p=>p.kind==='convenience').sort((a,b)=>a.lat-b.lat)[0]!;
export const parking:Place[]=[...network.parking, ...[school,park,shop,clinic].map(p=>({...p,lat:p.lat+0.0005,lon:p.lon-0.0003,id:'parking-'+p.id,name:p.name+' · proposed parking',kind:'parking',source:'Illustrative parking location; not a verified car park'}))];
export const nodes = new Map(network.nodes.map(n=>[n.id,n]));
export function distance(a:Point,b:Point){const r=Math.PI/180;const dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;const h=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
const graphs=new Map<string,Map<string,Edge[]>>();
function graph(mode:Mode,stepFree:boolean){
 const key=mode+stepFree;if(graphs.has(key))return graphs.get(key)!;const g=new Map<string,Edge[]>();
 for(const way of network.ways){const t=way.tags; if(['private','no'].includes(t.access ?? '')||t.highway==='construction')continue;
  if(mode==='drive' && (['footway','path','steps','pedestrian','cycleway','bridleway'].includes(t.highway ?? '')||['no','private'].includes(t.motor_vehicle ?? '')||t.motorcar==='no'))continue;
  if(mode==='walk' && (['motorway','motorway_link','trunk','trunk_link'].includes(t.highway ?? '')||t.foot==='no'||(stepFree&&(t.highway==='steps'||t.wheelchair==='no'))))continue;
  const add=(a:string,b:string)=>{const na=nodes.get(a),nb=nodes.get(b);if(!na||!nb)return;if(stepFree&&mode==='walk'&&(na.tags.wheelchair==='no'||nb.tags.wheelchair==='no'))return;const es=g.get(a)||[];es.push({to:b,m:distance(na,nb),way});g.set(a,es);if(!g.has(b))g.set(b,[]);};
  for(let i=1;i<way.nodes.length;i++){const a=way.nodes[i-1]!,b=way.nodes[i]!;if(mode==='walk'||t.oneway!=='-1')add(a,b);if(mode==='walk'||(!['yes','1','-1'].includes(t.oneway ?? '')&&t.junction!=='roundabout')||t.oneway==='-1')add(b,a);}
 } graphs.set(key,g);return g;
}
function nearest(p:Point,g:Map<string,Edge[]>){let best='',d=Infinity;for(const id of g.keys()){const n=nodes.get(id)!;const m=distance(p,n);if(m<d){d=m;best=id;}}return {id:best,m:d};}
export type Route={points:Point[];distance:number;unknown:number;edges:Edge[]};
export function route(a:Point,b:Point,mode:Mode,stepFree=false):Route|null{
 if(distance(a,b)<2)return {points:[a,b],distance:0,unknown:0,edges:[]};
 const g=graph(mode,stepFree),start=nearest(a,g),end=nearest(b,g);if(start.m>350||end.m>350)return null;
 const costs=new Map([[start.id,0]]),previous=new Map<string,{id:string;edge:Edge}>();
 const heap:{id:string;d:number}[]=[];const push=(v:{id:string;d:number})=>{heap.push(v);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p]!.d<=v.d)break;heap[i]=heap[p]!;i=p;}heap[i]=v;};
 const pop=()=>{const first=heap[0]!,last=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1]!.d<heap[c]!.d)c++;if(last.d<=heap[c]!.d)break;heap[i]=heap[c]!;i=c;}heap[i]=last;}return first;};push({id:start.id,d:0});
 while(heap.length){const cur=pop();if(cur.d!==costs.get(cur.id))continue;if(cur.id===end.id)break;for(const e of g.get(cur.id)||[]){const d=cur.d+e.m;if(d<(costs.get(e.to)??Infinity)){costs.set(e.to,d);previous.set(e.to,{id:cur.id,edge:e});push({id:e.to,d});}}}
 if(!costs.has(end.id))return null;const ids=[end.id],edges:Edge[]=[];let id=end.id;while(id!==start.id){const p=previous.get(id);if(!p)return null;edges.unshift(p.edge);id=p.id;ids.unshift(id);}
 return {points:[a,...ids.map(id=>nodes.get(id)!),b],distance:costs.get(end.id)!+start.m+end.m,unknown:mode==='walk'?edges.filter(e=>e.way.tags.wheelchair!=='yes').length:0,edges};
}
export type Stop={placeId:string;mode:Mode;parkingId:string;dwell:number};
export type Segment={label:string;mode:Mode;route:Route;minutes:number;wait:number;rest:number;barriers:number;shadedM:number};
export type Result={segments:Segment[];minutes:number;walkM:number;driveM:number;wait:number;dwell:number;barriers:number;unknown:number;error:string|null;parkingVisits:number;returnM:number;shadedWalkM:number};
function edgeShadedFraction(e:Edge, active:string[]):number {
 const base = Math.max(0, Math.min(1, Number(shadeData[e.way.id] ?? 0)));
 if (active.includes('seating') && distance(nodes.get(e.to)!, park) < 500) return 1;
 return base;
}
export function defaultStops():Stop[]{return [school,shop,park,homes[0]!].map(p=>({placeId:p.kind==='home'?'return-home':p.id,mode:'walk',parkingId:parking.slice().sort((a,b)=>distance(a,p)-distance(b,p))[0]!.id,dwell:p.kind==='school'?5:p.kind==='home'?0:10}));}
function near(dest:Place):string {
 return parking.slice().sort((a,b)=>distance(a,dest)-distance(b,dest))[0]!.id;
}
function stop(dest:Place, dwell:number):Stop {
 return {placeId: dest.kind==='home' ? 'return-home' : dest.id, mode:'walk', parkingId: near(dest), dwell};
}
export function defaultStopsFor(profileId:string):Stop[] {
 switch (profileId) {
  case 'parent': return [stop(school,5), stop(pharmacy,10), stop(homes[0]!,0)];
  case 'shift': return [stop(supermarket,10), stop(homes[0]!,0)];
  case 'wheel': return [stop(pharmacy,15), stop(supermarket,15), stop(homes[0]!,0)];
  case 'retired': return [stop(park,20), stop(pharmacy,10), stop(convenience,10), stop(homes[0]!,0)];
  default: return defaultStops();
 }
}
// Documented destination choices per persona (illustrative routines):
// - Aisyah (parent): SJK(T) Ladang Bukit Rajah → Watsons (nearest reachable pharmacy/chemist) → home, 07:30
// - Ravi (shift): 99 Speedmart (nearest reachable supermarket in reachable cluster) → home, 22:00
// - Mei Ling (wheel): Watsons → 99 Speedmart → home, 10:00; the only mapped clinic (Klinik Mediviron) sits in a disconnected OSM cluster from the default homes, so we use the nearest reachable chemist and supermarket
// - Uncle Tan: BBR Sales Gallery Park → Watsons → FamilyMart (reachable convenience) → home, 09:00
export function simulate(home:Place,stops:Stop[],profile:Profile,active:string[],searchMin=4,departure='08:00'):Result{
 const result:Result={segments:[],minutes:0,walkM:0,driveM:0,wait:0,dwell:0,barriers:0,unknown:0,error:null,parkingVisits:0,returnM:0,shadedWalkM:0};let person:Place=home,car:Place=home;
 const [sh,sm]=departure.split(':').map(Number);const startMin=(sh||0)*60+(sm||0);
 const leg=(from:Place,to:Place,mode:Mode,label:string)=>{
  const path=route(from,to,mode,profile.stepFree);if(!path){result.error=`No ${mode==='drive'?'driving':'walking/wheeling'} route found: ${from.name} → ${to.name}. Try a closer location or different parking.`;return false;}
  const hour=((startMin+result.minutes)/60)%24;const peak=(hour>=7&&hour<9)||(hour>=16&&hour<19);
  const nearSchool=path.points.some(p=>distance(p,school)<200);
  const crossing=nearSchool?(mode==='walk'?(active.includes('crossing')?.25:.75):(active.includes('crossing')?.25:0)):0;
  const conflict=nearSchool&&mode==='walk'&&active.includes('pickup')?.5:0;
  let shadedM=0;
  if (mode==='walk') for (const e of path.edges) shadedM += e.m * edgeShadedFraction(e, active);
  shadedM = Math.min(shadedM, path.distance);
  const unshadedM = Math.max(0, path.distance - shadedM);
  const barriers=mode==='walk'&&profile.rest>0?Math.max(0,Math.ceil(unshadedM/profile.restEvery)-1):0;
  const rest=barriers*profile.rest;
  let travelMin;
  if (mode==='drive') {
   travelMin = path.distance / ((peak?22:30)/3.6) / 60;
  } else {
   const isHot = hour >= 11 && hour < 16;
   const heatSlow = (profile.heatSensitive && isHot) ? 1.15 : 1;
   travelMin = (shadedM / profile.speed + unshadedM / (profile.speed / heatSlow)) / 60;
  }
  const minutes = travelMin + crossing + conflict + rest;
  result.segments.push({label,mode,route:path,minutes,wait:crossing+conflict,rest,barriers,shadedM:mode==='walk'?shadedM:0});
  result.minutes+=minutes;result.wait+=crossing+conflict;result.barriers+=barriers;result.unknown+=path.unknown;
  if(mode==='walk'){result.walkM+=path.distance;result.shadedWalkM+=shadedM;}else result.driveM+=path.distance;return true;
 };
 for(const s of stops){const target=s.placeId==='return-home'?home:places.find(p=>p.id===s.placeId);if(!target){result.error='A selected destination is missing.';break;}
  if(s.mode==='drive'){
   const lot=target.id===home.id?home:parking.find(p=>p.id===s.parkingId);if(!lot){result.error='Choose a parking location for every driving stop.';break;}
   if(distance(person,car)>2){const before=result.walkM;if(!leg(person,car,'walk','Return to parked car'))break;result.returnM+=result.walkM-before;}
   const moved=distance(car,lot)>2;if(!leg(car,lot,'drive',`Drive to ${lot.name}`))break;car=lot;
   if(target.id!==home.id&&moved){result.wait+=searchMin+1;result.minutes+=searchMin+1;result.parkingVisits++;}
   if(!leg(lot,target,'walk',`Parking → ${target.name}`))break;
  }else if(!leg(person,target,'walk',`${person.name} → ${target.name}`))break;
  const queue=target.kind==='school'?(active.includes('pickup')?3:7):0;
  result.wait+=queue;result.minutes+=queue+s.dwell;result.dwell+=s.dwell;person=target;
 } return result;
}

// Deterministic candidate homes sampled from residential-road OSM nodes.
function sampleHomeCandidates(step=7):Place[] {
 const seen = new Set<string>();
 for (const w of network.ways) {
  if (w.tags.highway !== 'residential') continue;
  if (['private','no'].includes(w.tags.access ?? '')) continue;
  for (const id of w.nodes) seen.add(id);
 }
 const ids = [...seen].sort();
 const out:Place[] = [];
 for (let i = 0; i < ids.length; i += step) {
  const n = nodes.get(ids[i]!);
  if (!n) continue;
  if (n.lat < 3.080 || n.lat > 3.105 || n.lon < 101.415 || n.lon > 101.445) continue;
  out.push({id:'home-c-'+n.id, name:'Residential node '+n.id, lat:n.lat, lon:n.lon, kind:'home', source:'Illustrative candidate home sampled every 7th OSM residential-road node'});
 }
 return out;
}
export const homeCandidates:Place[] = sampleHomeCandidates();

export type PrecinctHome = {home:Place; before:Result; after:Result; withinBefore:boolean; withinAfter:boolean};
export type PrecinctImpact = {
 perHome: PrecinctHome[];
 completeHomes: number;
 passRateBefore: number;
 passRateAfter: number;
 medianBefore: number;
 medianAfter: number;
 budget: number;
};
export function precinctImpact(stops:Stop[], profile:Profile, active:string[], budget=90, searchMin=4, departure='08:00'):PrecinctImpact {
 const perHome:PrecinctHome[] = [];
 for (const h of homeCandidates) {
  const before = simulate(h, stops, profile, [], searchMin, departure);
  const after = simulate(h, stops, profile, active, searchMin, departure);
  perHome.push({
   home: h, before, after,
   withinBefore: !before.error && before.minutes <= budget,
   withinAfter: !after.error && after.minutes <= budget,
  });
 }
 const complete = perHome.filter(r=>!r.before.error && !r.after.error);
 const med = (xs:number[]) => {const s=xs.slice().sort((a,b)=>a-b);const n=s.length;return n?(n%2?s[(n-1)/2]!:(s[n/2-1]!+s[n/2]!)/2):NaN;};
 return {
  perHome,
  completeHomes: complete.length,
  passRateBefore: perHome.length ? perHome.filter(r=>r.withinBefore).length/perHome.length : 0,
  passRateAfter: perHome.length ? perHome.filter(r=>r.withinAfter).length/perHome.length : 0,
  medianBefore: med(complete.map(r=>r.before.minutes)),
  medianAfter: med(complete.map(r=>r.after.minutes)),
  budget,
 };
}
