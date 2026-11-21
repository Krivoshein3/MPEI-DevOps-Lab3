import test from 'node:test';
import assert from 'node:assert/strict';
import {rankAlternatives, fetchAllPages} from './logic.mjs';
const event = (id, price_rub, extra = {}) => ({id, price_rub, genre_code:'concert', status:'published', starts_at:'2027-03-01T19:00:00+03:00', ...extra});
test('same genre, no original, no unpublished; absolute difference in both directions', () => {
 const selected = event('source', 1000);
 const events = [selected,event('expensive',1100),event('cheap',700),event('same',1000),event('other',1000,{genre_code:'cinema'}),event('cancelled',1000,{status:'cancelled'})];
 assert.deepEqual(rankAlternatives(events,selected).map(e=>e.id),['same','expensive','cheap']);
 assert.equal(events.length,6);
});
test('zero price and ties by date then ID', () => {
 const selected = event('source',0);
 assert.deepEqual(rankAlternatives([event('b',100),event('a',100),event('free',0),event('earlier',100,{starts_at:'2027-02-01T19:00:00+03:00'})],selected).map(e=>e.id),['free','earlier','a','b']);
 assert.deepEqual(rankAlternatives([],selected),[]);
});
test('reads all pages before ranking, including the closest event on the final page',async()=>{
 const calls=[];
 const result=await fetchAllPages(async page=>{calls.push(page);return {data:page===1?[event('far',900)]:[event('near',99)],meta:{total:2}};});
 assert.deepEqual(calls,[1,2]); assert.equal(rankAlternatives(result,event('source',100))[0].id,'near');
});
test('empty collection and interrupted pagination',async()=>{
 assert.deepEqual(await fetchAllPages(async()=>({data:[],meta:{total:0}})),[]);
 await assert.rejects(fetchAllPages(async()=>({data:[],meta:{total:1}})),/Каталог изменился/);
 await assert.rejects(fetchAllPages(async()=>{throw new Error('offline');}),/offline/);
});
