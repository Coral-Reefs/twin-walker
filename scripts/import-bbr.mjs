import fs from 'node:fs';
// Supply an OSM JSON conversion with {nodes: [{id,lat,lon,tags}], ways: [{id,nodes,tags}]}.
// This explicit input keeps network retrieval separate from the reproducible importer.
if (!process.argv[2]) throw new Error('Usage: node scripts/import-bbr.mjs <osm-converted.json>');
const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
const byId = new Map(raw.nodes.map(n=>[n.id,n]));
const ways=raw.ways.filter(w=>w.tags.highway && !['construction','proposed'].includes(w.tags.highway));
const ids=new Set(ways.flatMap(w=>w.nodes));
const nodes=raw.nodes.filter(n=>ids.has(n.id)).map(n=>({id:n.id,lat:n.lat,lon:n.lon,tags:n.tags}));
const places=raw.nodes.filter(n=>n.tags.name && (n.tags.amenity || n.tags.shop)).map(n=>({id:n.id,name:n.tags.name,lat:n.lat,lon:n.lon,kind:n.tags.amenity||n.tags.shop,source:'OpenStreetMap'}));
for(const w of raw.ways.filter(w=>w.tags.name && (w.tags.amenity || w.tags.leisure))){
 const ns=w.nodes.map(id=>byId.get(id)).filter(Boolean); if(!ns.length)continue;
 places.push({id:w.id,name:w.tags.name,lat:ns.reduce((a,n)=>a+n.lat,0)/ns.length,lon:ns.reduce((a,n)=>a+n.lon,0)/ns.length,kind:w.tags.amenity||w.tags.leisure,source:'OpenStreetMap; polygon centre, entrance unverified'});
}
const parking=raw.ways.filter(w=>['parking','parking_space'].includes(w.tags.amenity)).map(w=>{const ns=w.nodes.map(id=>byId.get(id)).filter(Boolean);return {id:w.id,name:w.tags.name||'Mapped parking bay',lat:ns.reduce((a,n)=>a+n.lat,0)/ns.length,lon:ns.reduce((a,n)=>a+n.lon,0)/ns.length,kind:'parking',source:'OpenStreetMap; access, fees and availability unverified'};});
// Cluster adjacent mapped bays for a useful parking selector, retaining source IDs.
const lots=[]; for(const p of parking){if(!lots.some(l=>Math.hypot(l.lat-p.lat,l.lon-p.lon)<0.0015))lots.push({...p,name:`Mapped parking area ${lots.length+1}`});}
fs.mkdirSync(new URL('../lib/bbr/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../lib/bbr/network.json',import.meta.url),JSON.stringify({date:'2026-10-16',bounds:[[3.080,101.415],[3.105,101.445]],nodes,ways,places,parking:lots}));
console.log(`${nodes.length} road nodes, ${ways.length} ways, ${places.length} destinations, ${lots.length} parking groups`);
