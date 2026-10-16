import {describe,it,expect} from 'vitest';
import {defaultStops,homes,profiles,simulate,route,school,park,parking,type Stop} from './engine';
const home=homes[0]!,p=profiles[0]!;
describe('Bandar Bukit Raja geographic journeys',()=>{
 it('routes every default mobility profile across the imported network',()=>{for(const person of profiles){const r=simulate(home,defaultStops(),person,[]);expect(r.error).toBeNull();expect(r.walkM).toBeGreaterThan(1000);expect(r.segments).toHaveLength(4);}});
 it('includes parking search, access walks and return to the parked car',()=>{const stops=defaultStops().map(s=>({...s,mode:'drive' as const}));const r=simulate(home,stops,p,[],4);expect(r.error).toBeNull();expect(r.parkingVisits).toBe(3);expect(r.returnM).toBeGreaterThan(0);expect(r.walkM).toBeGreaterThan(r.returnM);const longer=simulate(home,stops,p,[],7);expect(longer.minutes-r.minutes).toBeCloseTo(9,5);});
 it('keeps the vehicle in its parking location during an intervening walk',()=>{const stops=defaultStops();stops[0]!.mode='drive';stops[2]!.mode='drive';const r=simulate(home,stops,p,[]);expect(r.error).toBeNull();const retrieval=r.segments.find(s=>s.label==='Return to parked car');expect(retrieval).toBeDefined();const lot=parking.find(l=>l.id===stops[0]!.parkingId)!;expect(retrieval!.route.points.at(-1)).toMatchObject({lat:lot.lat,lon:lot.lon});});
 it('does not report a straight-line route outside coverage',()=>{expect(route(home,{lat:4,lon:102},'walk')).toBeNull();});
 it('includes activity time in the elapsed day',()=>{const a=defaultStops(),b=a.map(s=>({...s,dwell:s.dwell+5}));expect(simulate(home,b,p,[]).minutes-simulate(home,a,p,[]).minutes).toBeCloseTo(20);});
 it('applies spatial interventions only when the route reaches them',()=>{const r=simulate(home,[],profiles[3]!,['seating','crossing','pickup']);expect(r.minutes).toBe(0);expect(r.barriers).toBe(0);});
 it('returns deterministic comparison results without mutating stops',()=>{const s=defaultStops(),snapshot=JSON.stringify(s);const a=simulate(home,s,p,['crossing','pickup']);const b=simulate(home,s,p,['pickup','crossing']);expect(a.minutes).toBe(b.minutes);expect(JSON.stringify(s)).toBe(snapshot);});
 it('charges home arrivals no parking-search time',()=>{const stops:Stop[]=[{placeId:home.id,mode:'drive',parkingId:parking[0]!.id,dwell:0}];expect(simulate(home,stops,p,[]).parkingVisits).toBe(0);});
});
