import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isIsolatedVault} from '../src/isolation.mjs';
test('existing PersonalVault vault is rejected before any filesystem read or write',async()=>{let reads=0;assert.equal(await isIsolatedVault({getName:()=> 'PersonalVault',adapter:{read:async()=>{reads++;throw Error();}}}),false);assert.equal(reads,0);});
test('test-like name alone cannot enable plugin without explicit marker',async()=>{assert.equal(await isIsolatedVault({getName:()=> 'Realtime-Lab-MacBook',adapter:{read:async()=>{throw Error('missing');}}}),false);});
test('explicit independent test vault marker enables plugin',async()=>{assert.equal(await isIsolatedVault({getName:()=> 'Realtime-Lab-iPhone',adapter:{read:async()=>'{"isolatedLab":true}'}}),true);});
